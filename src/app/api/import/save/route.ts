import { and, eq } from 'drizzle-orm'
import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { db, schema } from '@/lib/db'
import { handleRouteError, jsonResponse, parseJsonBody, RouteError } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

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

    const result = await db.transaction(async (tx) => {
      const existingAccounts = await tx.query.accounts.findMany({
        where: eq(schema.accounts.companyId, company.id),
      })

      const accountIdByName = new Map(
        existingAccounts.map((account) => [normalizeKey(account.name), account.id])
      )

      let createdAccounts = 0
      let updatedAccounts = 0

      for (const account of body.accounts) {
        const key = normalizeKey(account.name)
        const existingAccountId = accountIdByName.get(key)

        if (existingAccountId) {
          await tx
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
                eq(schema.accounts.id, existingAccountId),
                eq(schema.accounts.companyId, company.id)
              )
            )

          updatedAccounts += 1
          continue
        }

        const [inserted] = await tx
          .insert(schema.accounts)
          .values({
            companyId: company.id,
            code: account.code,
            name: account.name,
            accountType: account.accountType,
            standardMapping: account.standardMapping,
            parentId: account.parentId,
            level: account.level,
            isGroup: account.isGroup,
            sortOrder: account.sortOrder,
          })
          .returning()

        accountIdByName.set(key, inserted.id)
        createdAccounts += 1
      }

      if (body.replaceExisting) {
        await tx
          .delete(schema.monthlyActuals)
          .where(eq(schema.monthlyActuals.companyId, company.id))
      }

      let savedActuals = 0
      for (const actual of body.actuals) {
        const accountId = accountIdByName.get(normalizeKey(actual.accountName))
        if (!accountId) {
          throw new RouteError(422, `Unknown account for actual: ${actual.accountName}`)
        }

        await tx
          .insert(schema.monthlyActuals)
          .values({
            companyId: company.id,
            accountId,
            period: normalizePeriod(actual.period),
            amount: actual.amount,
          })
          .onConflictDoUpdate({
            target: [
              schema.monthlyActuals.companyId,
              schema.monthlyActuals.accountId,
              schema.monthlyActuals.period,
            ],
            set: { amount: actual.amount },
          })

        savedActuals += 1
      }

      return {
        createdAccounts,
        updatedAccounts,
        savedActuals,
      }
    })

    return jsonResponse({
      companyId: company.id,
      ...result,
    })
  } catch (error) {
    return handleRouteError('IMPORT_SAVE_POST', error)
  }
}
