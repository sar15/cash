import { and, eq, sql } from 'drizzle-orm'
import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { db, schema } from '@/lib/db'
import { deleteFile } from '@/lib/storage'
import { inngest } from '@/lib/inngest/client'
import { writeAuditLog } from '@/lib/db/queries/audit-log'
import { createNotification } from '@/lib/db/queries/notifications'
import { handleRouteError, jsonResponse, parseJsonBody, RouteError } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'
import {
  findIdempotentResponse,
  getIdempotencyKey,
  saveIdempotentResponse,
  toIdempotencyResponse,
} from '@/lib/server/idempotency'

const importAccountSchema = z.object({
  name: z.string().min(1),
  code: z.string().max(20).optional(),
  accountType: z.enum(['revenue', 'expense', 'asset', 'liability', 'equity']),
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
  try {
    const userId = await requireUserId()
    const body = await parseJsonBody(request, importSaveRequestSchema)
    const company = await requireOwnedCompany(userId, body.companyId)

    // Idempotency: if the client sends an Idempotency-Key header, return the
    // cached response for duplicate submissions (e.g. double-click, retry on slow connection)
    const idempotencyKey = getIdempotencyKey(request)
    if (idempotencyKey) {
      const cached = await findIdempotentResponse({
        key: idempotencyKey,
        companyId: company.id,
        route: '/api/import/save',
        method: 'POST',
      })
      if (cached) return toIdempotencyResponse(cached)
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
      if (toInsert.length > 0) {
        const inserted = await tx
          .insert(schema.accounts)
          .values(toInsert.map((a) => ({
            companyId: company.id,
            code: a.code,
            name: a.name,
            accountType: a.accountType,
            standardMapping: a.standardMapping,
            parentId: a.parentId,
            level: a.level,
            isGroup: a.isGroup,
            sortOrder: a.sortOrder,
          })))
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
                standardMapping: account.standardMapping,
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
    import('@/lib/db/queries/forecast-results').then(({ markForecastStale }) => {
      markForecastStale(company.id).catch(() => {})
    }).catch(() => {})

    // Audit log + notification (non-blocking)
    writeAuditLog({
      companyId: company.id,
      clerkUserId: userId,
      action: 'import.completed',
      entityType: 'import',
      newValue: { accounts: result.createdAccounts + result.updatedAccounts, actuals: result.savedActuals },
    }).catch(() => {})

    createNotification({
      companyId: company.id,
      clerkUserId: userId,
      type: 'import_complete',
      title: 'Import complete',
      body: `${result.createdAccounts + result.updatedAccounts} accounts and ${result.savedActuals} actuals imported`,
      actionUrl: '/forecast',
    }).catch(() => {})

    // Clean up uploaded file from R2 after successful save (fire-and-forget)
    if (body.fileKey) {
      deleteFile(body.fileKey).catch(() => {
        console.warn('[IMPORT_SAVE] Failed to delete uploaded file:', body.fileKey)
      })
    }

    const responseBody = {
      companyId: company.id,
      ...result,
    }

    // Cache the response for idempotent retries (fire-and-forget)
    if (idempotencyKey) {
      saveIdempotentResponse(
        { key: idempotencyKey, companyId: company.id, route: '/api/import/save', method: 'POST' },
        200,
        responseBody
      ).catch(() => {})
    }

    return jsonResponse(responseBody)
  } catch (error) {
    return handleRouteError('IMPORT_SAVE_POST', error)
  }
}
