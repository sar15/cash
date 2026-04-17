import { eq } from 'drizzle-orm'
import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { db, schema } from '@/lib/db'
import { handleRouteError, jsonResponse, parseJsonBody } from '@/lib/server/api'
import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'

const requestSchema = z.object({
  companyId: z.string().uuid(),
})

// Indian manufacturing SME demo data — Pune-based auto components manufacturer
// Revenue: ~₹50-65L/month, growing ~5% over the year
// Gross margin: ~38%, Net margin: ~8-12%
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

// Values in lakhs — realistic Indian auto components manufacturer
// Revenue grows from ~₹50L to ~₹65L over the year (~30% annual growth)
// Gross margin ~38%, Net margin ~10%
const DEMO_VALUES: Record<string, number[]> = {
  // Revenue: steady growth with seasonal dip in Aug (monsoon slowdown)
  'Product Sales':       [46.5, 49.2, 51.8, 53.4, 50.1, 54.8, 55.2, 57.6, 59.8, 58.4, 62.1, 65.3],
  'Service Revenue':     [4.2,  4.5,  4.8,  5.0,  4.6,  5.2,  5.4,  5.6,  5.9,  5.8,  6.2,  6.5 ],

  // COGS: ~38% of revenue (raw materials ~22%, labour ~10%, overhead ~6%)
  'Raw Materials':       [19.2, 20.3, 21.4, 22.1, 20.7, 22.6, 22.8, 23.8, 24.7, 24.1, 25.7, 27.0],
  'Direct Labour':       [9.3,  9.8,  10.4, 10.7, 10.0, 10.9, 11.0, 11.5, 11.9, 11.6, 12.4, 13.1],

  // OpEx: relatively fixed with some variable components
  'Salaries & Wages':    [8.5,  8.5,  8.5,  9.5,  9.5,  9.5,  9.5,  9.5,  9.5,  10.5, 10.5, 10.5],
  'Rent':                [2.2,  2.2,  2.2,  2.2,  2.2,  2.2,  2.2,  2.2,  2.2,  2.2,  2.2,  2.2 ],
  'Utilities':           [1.8,  2.1,  1.6,  1.3,  1.4,  1.4,  1.5,  1.4,  1.9,  1.6,  1.5,  1.6 ],
  'Marketing':           [0.8,  0.8,  1.2,  0.8,  0.8,  1.5,  0.8,  0.8,  1.2,  0.8,  0.8,  2.0 ],

  // Balance sheet — closing balances each month
  // Cash grows from ₹18L to ₹28L as business becomes more profitable
  'Cash & Bank':         [18.2, 19.5, 21.1, 22.8, 21.5, 23.9, 24.8, 26.2, 27.8, 27.1, 29.4, 31.2],
  // AR: ~25 days of revenue
  'Accounts Receivable': [13.5, 14.2, 15.0, 15.5, 14.6, 15.9, 16.1, 16.8, 17.4, 17.0, 18.2, 19.1],
  // Fixed assets: stable (no major capex this year)
  'Fixed Assets':        [85.0, 85.0, 85.0, 85.0, 85.0, 85.0, 85.0, 85.0, 85.0, 85.0, 85.0, 85.0],
  // AP: ~20 days of COGS
  'Accounts Payable':    [9.5,  10.1, 10.7, 11.0, 10.4, 11.3, 11.4, 11.9, 12.3, 12.1, 12.9, 13.5],
  // Loan: being repaid at ₹1L/month
  'Bank Loan':           [28.0, 27.0, 26.0, 25.0, 24.0, 23.0, 22.0, 21.0, 20.0, 19.0, 18.0, 17.0],
  // Equity: stable
  'Share Capital':       [50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0],
  // Retained earnings: growing as profits accumulate
  'Retained Earnings':   [33.4, 35.1, 37.2, 39.1, 38.0, 40.8, 42.4, 44.9, 47.4, 46.7, 50.1, 53.5],
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
