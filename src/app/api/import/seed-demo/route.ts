import { eq } from 'drizzle-orm'
import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { db, schema } from '@/lib/db'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

const requestSchema = z.object({
  companyId: z.string().uuid(),
})

// Indian manufacturing SME demo data
// All amounts in paise (1 rupee = 100 paise, 1 lakh = 10,000,000 paise)
const L = 10_000_000 // 1 lakh in paise

const DEMO_ACCOUNTS = [
  { name: 'Product Sales',       accountType: 'revenue'   as const, standardMapping: 'revenue.product',    level: 0, isGroup: false, sortOrder: 10 },
  { name: 'Service Revenue',     accountType: 'revenue'   as const, standardMapping: 'revenue.service',    level: 0, isGroup: false, sortOrder: 11 },
  { name: 'Raw Materials',       accountType: 'expense'   as const, standardMapping: 'cogs.materials',     level: 0, isGroup: false, sortOrder: 20 },
  { name: 'Direct Labour',       accountType: 'expense'   as const, standardMapping: 'cogs.labour',        level: 0, isGroup: false, sortOrder: 21 },
  { name: 'Salaries & Wages',    accountType: 'expense'   as const, standardMapping: 'opex.salaries',      level: 0, isGroup: false, sortOrder: 30 },
  { name: 'Rent',                accountType: 'expense'   as const, standardMapping: 'opex.rent',          level: 0, isGroup: false, sortOrder: 31 },
  { name: 'Utilities',           accountType: 'expense'   as const, standardMapping: 'opex.utilities',     level: 0, isGroup: false, sortOrder: 32 },
  { name: 'Marketing',           accountType: 'expense'   as const, standardMapping: 'opex.marketing',     level: 0, isGroup: false, sortOrder: 33 },
  { name: 'Cash & Bank',         accountType: 'asset'     as const, standardMapping: 'asset.cash',         level: 0, isGroup: false, sortOrder: 40 },
  { name: 'Accounts Receivable', accountType: 'asset'     as const, standardMapping: 'asset.receivable',   level: 0, isGroup: false, sortOrder: 41 },
  { name: 'Fixed Assets',        accountType: 'asset'     as const, standardMapping: 'asset.fixed',        level: 0, isGroup: false, sortOrder: 42 },
  { name: 'Accounts Payable',    accountType: 'liability' as const, standardMapping: 'liability.payable',  level: 0, isGroup: false, sortOrder: 50 },
  { name: 'Bank Loan',           accountType: 'liability' as const, standardMapping: 'liability.loan',     level: 0, isGroup: false, sortOrder: 51 },
  { name: 'Share Capital',       accountType: 'equity'    as const, standardMapping: 'equity.capital',     level: 0, isGroup: false, sortOrder: 60 },
  { name: 'Retained Earnings',   accountType: 'equity'    as const, standardMapping: 'equity.retained',    level: 0, isGroup: false, sortOrder: 61 },
]

// 12 months: Apr-24 to Mar-25
const PERIODS = [
  '2024-04-01', '2024-05-01', '2024-06-01', '2024-07-01', '2024-08-01', '2024-09-01',
  '2024-10-01', '2024-11-01', '2024-12-01', '2025-01-01', '2025-02-01', '2025-03-01',
]

// Values in lakhs, will be multiplied by L
const DEMO_VALUES: Record<string, number[]> = {
  'Product Sales':       [45.2, 48.1, 49.5, 50.2, 47.8, 52.1, 51.5, 53.2, 55.4, 54.1, 58.2, 60.5],
  'Service Revenue':     [5.1,  5.2,  5.0,  5.5,  5.8,  6.0,  6.1,  6.2,  6.5,  6.4,  6.8,  7.0 ],
  'Raw Materials':       [18.5, 19.2, 19.8, 20.1, 19.0, 20.8, 20.5, 21.2, 22.1, 21.6, 23.2, 24.1],
  'Direct Labour':       [10.0, 10.6, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0],
  'Salaries & Wages':    [8.5,  8.5,  8.5,  9.2,  9.2,  9.2,  9.2,  9.2,  9.2,  9.8,  9.8,  9.8 ],
  'Rent':                [2.0,  2.0,  2.0,  2.0,  2.0,  2.0,  2.0,  2.0,  2.0,  2.0,  2.0,  2.0 ],
  'Utilities':           [1.6,  1.9,  1.5,  1.2,  1.3,  1.3,  1.4,  1.3,  1.8,  1.5,  1.4,  1.5 ],
  'Marketing':           [1.0,  1.0,  1.5,  1.0,  1.0,  2.0,  1.0,  1.0,  1.5,  1.0,  1.0,  2.5 ],
  'Cash & Bank':         [15.5, 16.2, 14.8, 15.1, 14.0, 15.8, 15.5, 16.2, 17.1, 16.6, 18.2, 18.5],
  'Accounts Receivable': [12.0, 13.5, 14.0, 13.8, 12.5, 14.2, 13.9, 14.8, 15.5, 15.0, 16.2, 17.0],
  'Fixed Assets':        [80.0, 80.0, 80.0, 80.0, 80.0, 80.0, 80.0, 80.0, 80.0, 80.0, 80.0, 80.0],
  'Accounts Payable':    [8.0,  8.5,  9.0,  9.2,  8.8,  9.5,  9.3,  9.8,  10.2, 10.0, 10.8, 11.2],
  'Bank Loan':           [30.0, 30.0, 29.0, 29.0, 28.0, 28.0, 27.0, 27.0, 26.0, 26.0, 25.0, 25.0],
  'Share Capital':       [50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0],
  'Retained Earnings':   [19.5, 20.2, 19.8, 20.1, 19.0, 20.8, 20.5, 21.2, 22.1, 21.6, 23.2, 24.1],
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId()
    const body = await parseJsonBody(request, requestSchema)
    const company = await requireOwnedCompany(userId, body.companyId)
    const companyId = company.id

    await db.transaction(async (tx) => {
      // Clear existing data for this company
      await tx.delete(schema.monthlyActuals).where(eq(schema.monthlyActuals.companyId, companyId))
      await tx.delete(schema.accounts).where(eq(schema.accounts.companyId, companyId))

      // Insert accounts and collect name → id map
      const accountIdByName = new Map<string, string>()
      for (const account of DEMO_ACCOUNTS) {
        const [inserted] = await tx
          .insert(schema.accounts)
          .values({ ...account, companyId })
          .returning({ id: schema.accounts.id, name: schema.accounts.name })
        accountIdByName.set(inserted.name, inserted.id)
      }

      // Insert actuals
      for (const [accountName, values] of Object.entries(DEMO_VALUES)) {
        const accountId = accountIdByName.get(accountName)
        if (!accountId) continue
        for (let i = 0; i < PERIODS.length; i++) {
          await tx
            .insert(schema.monthlyActuals)
            .values({
              companyId,
              accountId,
              period: PERIODS[i],
              amount: Math.round((values[i] ?? 0) * L),
            })
            .onConflictDoUpdate({
              target: [
                schema.monthlyActuals.companyId,
                schema.monthlyActuals.accountId,
                schema.monthlyActuals.period,
              ],
              set: { amount: Math.round((values[i] ?? 0) * L) },
            })
        }
      }
    })

    return jsonResponse({
      companyId,
      seeded: true,
      accounts: DEMO_ACCOUNTS.length,
      periods: PERIODS.length,
    })
  } catch (error) {
    return handleRouteError('SEED_DEMO_POST', error)
  }
}
