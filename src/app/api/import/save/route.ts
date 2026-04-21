import { and, eq, sql } from 'drizzle-orm'
import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { db, schema } from '@/lib/db'
import { deleteFile } from '@/lib/storage'
import { inngest } from '@/lib/inngest/client'
import { writeAuditLog } from '@/lib/db/queries/audit-log'
import { createNotification } from '@/lib/db/queries/notifications'
import { markForecastStale } from '@/lib/db/queries/forecast-results'
import { handleRouteError, jsonResponse, parseJsonBody, RouteError } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'
import {
  reserveIdempotencySlot,
  completeIdempotencySlot,
  getIdempotencyKey,
  toIdempotencyResponse,
} from '@/lib/server/idempotency'
import { FALLBACK_BY_ACCOUNT_TYPE, isValidStandardMapping } from '@/lib/standards/standard-mappings'

const importAccountSchema = z.object({
  name: z.string().min(1),
  code: z.string().max(20).optional(),
  accountType: z.enum(['revenue', 'expense', 'asset', 'liability', 'equity']),
  // Accept any string but validate/fallback at save time — allows legacy values from old imports
  standardMapping: z.string().max(100).optional(),
  parentId: z.string().uuid().nullable().optional(),
  level: z.number().int().min(0).max(4).default(0),
  isGroup: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
})

const importActualSchema = z.object({
  accountName: z.string().min(1),
  period: z.string().min(1),
  amount: z.number().int(),
})

const importSaveRequestSchema = z.object({
  companyId: z.string().uuid(),
  fileKey: z.string().optional(), // R2 key to delete after successful save
  accounts: z.array(importAccountSchema).min(1).max(500),
  actuals: z.array(importActualSchema).min(1).max(5000),
  replaceExisting: z.boolean().default(false),
})

const monthLookup: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase()
}

function extractStoragePath(fileKey: string) {
  if (fileKey.startsWith('ut:')) {
    const separatorIndex = fileKey.indexOf(':', 3)
    if (separatorIndex < 0) return null
    return fileKey.slice(separatorIndex + 1)
  }

  return fileKey
}

function normalizePeriod(value: string) {
  if (/^\d{4}-\d{2}-01$/.test(value)) {
    return value
  }

  const match = value.trim().match(/^([A-Za-z]{3})-(\d{2})$/)
  if (!match) {
    throw new RouteError(422, `Unsupported period format: ${value}`)
  }

  const month = monthLookup[match[1].toLowerCase()]
  if (!month) {
    throw new RouteError(422, `Unsupported month label: ${value}`)
  }

  const year = Number(match[2]) + 2000
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-01`
}

export async function POST(request: NextRequest) {
  let idempotencyCtx: { key: string; companyId: string; route: string; method: string } | null = null
  try {
    const userId = await requireUserId()
    const body = await parseJsonBody(request, importSaveRequestSchema)
    const company = await requireOwnedCompany(userId, body.companyId)

    // Idempotency: reserve a slot before processing to prevent concurrent duplicate imports.
    // - 'completed'  → return cached response immediately
    // - 'in_progress' → concurrent replay, return 409
    // - 'proceed'    → we own the slot, continue processing
    const idempotencyKey = getIdempotencyKey(request)
    idempotencyCtx = idempotencyKey
      ? { key: idempotencyKey, companyId: company.id, route: '/api/import/save', method: 'POST' }
      : null

    if (idempotencyCtx) {
      const reservation = await reserveIdempotencySlot(idempotencyCtx)
      if (reservation.status === 'completed') return toIdempotencyResponse(reservation.cached)
      if (reservation.status === 'in_progress') {
        return jsonResponse(
          { error: 'A duplicate import is already in progress. Please wait and retry.' },
          { status: 409 }
        )
      }
    }

    const result = await db.transaction(async (tx) => {
      const existingAccounts = await tx.query.accounts.findMany({
        where: eq(schema.accounts.companyId, company.id),
      })

      const accountIdByName = new Map(
        existingAccounts.map((account) => [normalizeKey(account.name), account.id])
      )

      // ── Batch accounts: split into new vs existing ──────────────────────
      const toInsert: typeof body.accounts = []
      const toUpdate: Array<{ id: string; account: typeof body.accounts[number] }> = []

      for (const account of body.accounts) {
        const key = normalizeKey(account.name)
        const existingId = accountIdByName.get(key)
        if (existingId) {
          toUpdate.push({ id: existingId, account })
        } else {
          toInsert.push(account)
        }
      }

      // Batch insert new accounts (single query)
      // onConflictDoUpdate handles the race where two concurrent imports try to insert the same account
      if (toInsert.length > 0) {
        const inserted = await tx
          .insert(schema.accounts)
          .values(toInsert.map((a) => ({
            companyId: company.id,
            code: a.code,
            name: a.name,
            accountType: a.accountType,
            // Validate standardMapping — use fallback if missing or invalid legacy value
            standardMapping: isValidStandardMapping(a.standardMapping)
              ? a.standardMapping
              : FALLBACK_BY_ACCOUNT_TYPE[a.accountType],
            parentId: a.parentId,
            level: a.level,
            isGroup: a.isGroup,
            sortOrder: a.sortOrder,
          })))
          .onConflictDoUpdate({
            target: [schema.accounts.companyId, schema.accounts.name],
            set: {
              code: sql`excluded.code`,
              accountType: sql`excluded.account_type`,
              standardMapping: sql`excluded.standard_mapping`,
              level: sql`excluded.level`,
              isGroup: sql`excluded.is_group`,
              sortOrder: sql`excluded.sort_order`,
            },
          })
          .returning()
        for (const row of inserted) {
          accountIdByName.set(normalizeKey(row.name), row.id)
        }
      }

      // Update existing accounts in parallel (bounded concurrency)
      const CHUNK = 20
      for (let i = 0; i < toUpdate.length; i += CHUNK) {
        await Promise.all(
          toUpdate.slice(i, i + CHUNK).map(({ id, account }) =>
            tx
              .update(schema.accounts)
              .set({
                code: account.code,
                name: account.name,
                accountType: account.accountType,
                // Validate standardMapping on update too
                standardMapping: isValidStandardMapping(account.standardMapping)
                  ? account.standardMapping
                  : FALLBACK_BY_ACCOUNT_TYPE[account.accountType],
                parentId: account.parentId,
                level: account.level,
                isGroup: account.isGroup,
                sortOrder: account.sortOrder,
              })
              .where(
                and(
                  eq(schema.accounts.id, id),
                  eq(schema.accounts.companyId, company.id)
                )
              )
          )
        )
      }

      if (body.replaceExisting) {
        await tx
          .delete(schema.monthlyActuals)
          .where(eq(schema.monthlyActuals.companyId, company.id))
      }

      // ── Batch insert actuals (chunked to avoid SQLite param limits) ──────
      const ACTUALS_CHUNK = 100
      let savedActuals = 0

      for (let i = 0; i < body.actuals.length; i += ACTUALS_CHUNK) {
        const chunk = body.actuals.slice(i, i + ACTUALS_CHUNK)
        const values = chunk.map((actual) => {
          const accountId = accountIdByName.get(normalizeKey(actual.accountName))
          if (!accountId) {
            throw new RouteError(422, `Unknown account for actual: ${actual.accountName}`)
          }
          return {
            companyId: company.id,
            accountId,
            period: normalizePeriod(actual.period),
            amount: actual.amount,
          }
        })

        await tx
          .insert(schema.monthlyActuals)
          .values(values)
          .onConflictDoUpdate({
            target: [
              schema.monthlyActuals.companyId,
              schema.monthlyActuals.accountId,
              schema.monthlyActuals.period,
            ],
            set: { amount: sql`excluded.amount` },
          })

        savedActuals += chunk.length
      }

      return {
        createdAccounts: toInsert.length,
        updatedAccounts: toUpdate.length,
        savedActuals,
      }
    })

    // Mark onboarding complete on first real import (fire-and-forget)
    db.update(schema.userProfiles)
      .set({ onboardingCompleted: true })
      .where(eq(schema.userProfiles.clerkUserId, userId))
      .catch(() => {})

    // Fire background recompute event (non-critical)
    inngest.send({
      name: 'forecast/config.updated',
      data: { companyId: company.id, changeType: 'import' },
    }).catch(() => {})

    // Mark forecast stale immediately so UI shows recalculating state
    // (Inngest job will set it back to 'ready' when done)
    await markForecastStale(company.id).catch(() => {})

    // Audit log + notification
    await writeAuditLog({
      companyId: company.id,
      clerkUserId: userId,
      action: 'import.completed',
      entityType: 'import',
      newValue: { accounts: result.createdAccounts + result.updatedAccounts, actuals: result.savedActuals },
    }).catch((err) => {
      console.error('[AuditLog] Failed to write import.completed:', err)
    })

    await createNotification({
      companyId: company.id,
      clerkUserId: userId,
      type: 'import_complete',
      title: 'Import complete',
      body: `${result.createdAccounts + result.updatedAccounts} accounts and ${result.savedActuals} actuals imported`,
      actionUrl: '/forecast',
    }).catch(() => {})

    // Clean up uploaded file from R2 after successful save (fire-and-forget)
    if (body.fileKey) {
      const storagePath = extractStoragePath(body.fileKey)
      const expectedPrefix = `uploads/${company.id}/`
      if (storagePath?.startsWith(expectedPrefix)) {
        deleteFile(body.fileKey).catch(() => {
          console.warn('[IMPORT_SAVE] Failed to delete uploaded file:', body.fileKey)
        })
      } else {
        console.warn('[IMPORT_SAVE] Skipped deleting unexpected file key:', body.fileKey)
      }
    }

    const responseBody = {
      companyId: company.id,
      ...result,
    }

    // Mark idempotency slot as completed so concurrent retries get the cached response
    if (idempotencyCtx) {
      completeIdempotencySlot(idempotencyCtx, 200, responseBody).catch(() => {})
    }

    return jsonResponse(responseBody)
  } catch (error) {
    // If we reserved an idempotency slot but the request failed, delete it so
    // the user can retry without hitting the "duplicate in progress" wall.
    if (idempotencyCtx) {
      db.delete(schema.idempotencyKeys)
        .where(
          and(
            eq(schema.idempotencyKeys.companyId, idempotencyCtx.companyId),
            eq(schema.idempotencyKeys.key, idempotencyCtx.key),
            eq(schema.idempotencyKeys.route, idempotencyCtx.route),
            eq(schema.idempotencyKeys.method, idempotencyCtx.method)
          )
        )
        .catch(() => {})
    }
    console.error('[IMPORT_SAVE] Error:', error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack?.split('\n').slice(0, 5).join(' | ') : '')
    return handleRouteError('IMPORT_SAVE_POST', error)
  }
}
