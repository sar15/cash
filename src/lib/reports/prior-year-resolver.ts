/**
 * Prior Year Resolver
 *
 * Resolves prior year data from monthlyActuals table.
 * Groups actuals by period, sums by account type to reconstruct
 * Schedule III-compatible annual totals.
 *
 * Strategy:
 * 1. Compute the 12 months immediately before currentForecastStartDate
 * 2. Query monthlyActuals joined with accounts for those periods
 * 3. Aggregate into AnnualStatement-compatible structure
 * 4. Return dataSource: 'actuals' | 'mixed' | 'forecast'
 */

import { db } from '@/lib/db'
import { monthlyActuals, accounts } from '@/lib/db/schema'
import { and, eq, gte, lt } from 'drizzle-orm'
import type { AnnualStatement } from './annual-aggregator'

export interface PriorYearResult {
  annual: AnnualStatement | null
  dataSource: 'actuals' | 'mixed' | 'forecast'
  actualsCount: number // number of months with actuals data
}

/**
 * Compute the 12 prior month period strings (YYYY-MM-01) before a given start date.
 */
function getPriorYearPeriods(currentForecastStartDate: string): string[] {
  const [year, month] = currentForecastStartDate.split('-').map(Number)
  const periods: string[] = []
  for (let i = 12; i >= 1; i--) {
    let m = month - i
    let y = year
    while (m <= 0) { m += 12; y -= 1 }
    periods.push(`${y}-${String(m).padStart(2, '0')}-01`)
  }
  return periods
}

/**
 * Resolve prior year annual statement from monthlyActuals.
 *
 * @param companyId - Company ID
 * @param currentForecastStartDate - First month of current forecast (YYYY-MM-01)
 * @param periodLabel - Label for the prior year (e.g. "FY24-25")
 */
export async function resolvePriorYear(
  companyId: string,
  currentForecastStartDate: string,
  periodLabel: string
): Promise<PriorYearResult> {
  try {
    const priorPeriods = getPriorYearPeriods(currentForecastStartDate)
    const startPeriod = priorPeriods[0]
    const endPeriod = priorPeriods[priorPeriods.length - 1]

    // Fetch all actuals for the prior 12 months with account info
    const rows = await db
      .select({
        period: monthlyActuals.period,
        amount: monthlyActuals.amount,
        accountType: accounts.accountType,
        standardMapping: accounts.standardMapping,
      })
      .from(monthlyActuals)
      .innerJoin(accounts, eq(monthlyActuals.accountId, accounts.id))
      .where(
        and(
          eq(monthlyActuals.companyId, companyId),
          gte(monthlyActuals.period, startPeriod),
          // Use the period after endPeriod as the exclusive upper bound
          lt(monthlyActuals.period, (() => {
            const [y, m] = endPeriod.split('-').map(Number)
            const nextM = m === 12 ? 1 : m + 1
            const nextY = m === 12 ? y + 1 : y
            return `${nextY}-${String(nextM).padStart(2, '0')}-01`
          })())
        )
      )

    if (rows.length === 0) {
      return { annual: null, dataSource: 'forecast', actualsCount: 0 }
    }

    // Count distinct periods with data
    const periodsWithData = new Set(rows.map(r => r.period))
    const actualsCount = periodsWithData.size
    const dataSource = actualsCount >= 12 ? 'actuals' : actualsCount > 0 ? 'mixed' : 'forecast'

    // Aggregate by account type and standard mapping
    const totals = {
      revenue: 0, revenueFromOps: 0, otherIncome: 0,
      cogs: 0, employeeBenefits: 0, financeCosts: 0,
      depreciation: 0, amortisation: 0, otherExpenses: 0,
      // BS (last period values — use the latest period available)
      cash: 0, tradeReceivables: 0, netPPE: 0, netIntangibles: 0,
      inventories: 0, stLoansAdvances: 0, otherCurrentAssets: 0,
      shareCapital: 0, securitiesPremium: 0, generalReserve: 0,
      retainedEarnings: 0, ltBorrowings: 0, stBorrowings: 0,
      otherCurrentLiabilities: 0, stProvisions: 0,
    }

    // P&L: sum all periods
    for (const row of rows) {
      const sm = row.standardMapping ?? ''
      const amt = row.amount

      if (row.accountType === 'revenue') {
        if (sm.includes('OTHER_INCOME') || sm.includes('INTEREST') || sm.includes('DIVIDEND')) {
          totals.otherIncome += amt
        } else {
          totals.revenueFromOps += amt
        }
        totals.revenue += amt
      } else if (row.accountType === 'expense') {
        if (sm.includes('COGS') || sm.includes('MATERIAL') || sm.includes('PURCHASE')) {
          totals.cogs += amt
        } else if (sm.includes('EMPLOYEE') || sm.includes('SALARY') || sm.includes('WAGES')) {
          totals.employeeBenefits += amt
        } else if (sm.includes('FINANCE') || sm.includes('INTEREST_EXP')) {
          totals.financeCosts += amt
        } else if (sm.includes('DEPRECIATION')) {
          totals.depreciation += amt
        } else if (sm.includes('AMORTISATION') || sm.includes('AMORTIZATION')) {
          totals.amortisation += amt
        } else {
          totals.otherExpenses += amt
        }
      }
    }

    // BS: use the latest period's values (point-in-time)
    const latestPeriod = [...periodsWithData].sort().pop() ?? ''
    const latestRows = rows.filter(r => r.period === latestPeriod)
    for (const row of latestRows) {
      const sm = row.standardMapping ?? ''
      const amt = row.amount
      if (row.accountType === 'asset') {
        if (sm.includes('CASH') || sm.includes('BANK')) totals.cash += amt
        else if (sm.includes('TRADE_REC') || sm.includes('RECEIVABLE') || sm.includes('DEBTOR')) totals.tradeReceivables += amt
        else if (sm.includes('PPE') || sm.includes('FIXED') || sm.includes('PLANT')) totals.netPPE += amt
        else if (sm.includes('INTANGIBLE')) totals.netIntangibles += amt
        else if (sm.includes('INVENTOR') || sm.includes('STOCK')) totals.inventories += amt
        else if (sm.includes('ST_LOAN') || sm.includes('PREPAID') || sm.includes('ADVANCE')) totals.stLoansAdvances += amt
        else totals.otherCurrentAssets += amt
      } else if (row.accountType === 'liability') {
        if (sm.includes('LT_BORROW') || sm.includes('TERM_LOAN')) totals.ltBorrowings += amt
        else if (sm.includes('ST_BORROW') || sm.includes('OD') || sm.includes('CC')) totals.stBorrowings += amt
        else if (sm.includes('PROVISION')) totals.stProvisions += amt
        else totals.otherCurrentLiabilities += amt
      } else if (row.accountType === 'equity') {
        if (sm.includes('SHARE_CAP') || sm.includes('CAPITAL')) totals.shareCapital += amt
        else if (sm.includes('SECURITIES_PREM') || sm.includes('PREMIUM')) totals.securitiesPremium += amt
        else if (sm.includes('GENERAL_RES') || sm.includes('RESERVE')) totals.generalReserve += amt
        else totals.retainedEarnings += amt
      }
    }

    // Compute derived totals
    const totalRevenue = totals.revenueFromOps + totals.otherIncome
    const totalExpenses = totals.cogs + totals.employeeBenefits + totals.financeCosts +
      totals.depreciation + totals.amortisation + totals.otherExpenses
    const profitBeforeExceptional = totalRevenue - totalExpenses
    const profitBeforeTax = profitBeforeExceptional
    const profitAfterTax = profitBeforeTax // no tax data in actuals for prior year

    const totalShareholdersEquity = totals.shareCapital + totals.securitiesPremium +
      totals.generalReserve + totals.retainedEarnings
    const totalNonCurrentLiabilities = totals.ltBorrowings
    const totalCurrentLiabilities = totals.stBorrowings + totals.otherCurrentLiabilities + totals.stProvisions
    const totalNonCurrentAssets = totals.netPPE + totals.netIntangibles
    const totalCurrentAssets = totals.cash + totals.tradeReceivables + totals.inventories +
      totals.stLoansAdvances + totals.otherCurrentAssets
    const totalAssets = totalNonCurrentAssets + totalCurrentAssets

    const annual: AnnualStatement = {
      pl: {
        revenueFromOps: totals.revenueFromOps,
        otherIncome: totals.otherIncome,
        totalRevenue,
        cogs: totals.cogs,
        employeeBenefits: totals.employeeBenefits,
        financeCosts: totals.financeCosts,
        depreciation: totals.depreciation,
        amortisation: totals.amortisation,
        otherExpenses: totals.otherExpenses,
        totalExpenses,
        profitBeforeExceptional,
        exceptionalItems: 0,
        profitBeforeTax,
        taxExpense: 0,
        profitAfterTax,
        revenue: totals.revenue,
        grossProfit: totals.revenueFromOps - totals.cogs,
        expense: totals.employeeBenefits + totals.financeCosts + totals.otherExpenses,
        netIncome: profitAfterTax,
      },
      bs: {
        shareCapital: totals.shareCapital,
        securitiesPremium: totals.securitiesPremium,
        generalReserve: totals.generalReserve,
        retainedEarnings: totals.retainedEarnings,
        totalShareholdersEquity,
        ltBorrowings: totals.ltBorrowings,
        stBorrowings: totals.stBorrowings,
        otherCurrentLiabilities: totals.otherCurrentLiabilities,
        stProvisions: totals.stProvisions,
        totalNonCurrentLiabilities,
        totalCurrentLiabilities,
        cash: totals.cash,
        tradeReceivables: totals.tradeReceivables,
        netPPE: totals.netPPE,
        intangibles: totals.netIntangibles,
        accAmortisation: 0,
        netIntangibles: totals.netIntangibles,
        inventories: totals.inventories,
        stLoansAdvances: totals.stLoansAdvances,
        otherCurrentAssets: totals.otherCurrentAssets,
        totalCurrentAssets,
        totalNonCurrentAssets,
        totalAssets,
        ar: totals.tradeReceivables,
        fixedAssets: totals.netPPE,
        accDepreciation: 0,
        ap: totals.otherCurrentLiabilities,
        debt: totals.ltBorrowings + totals.stBorrowings,
        totalLiabilities: totalNonCurrentLiabilities + totalCurrentLiabilities,
        equity: totals.shareCapital,
        totalEquity: totalShareholdersEquity,
      },
      cf: {
        operatingIndirect: {
          profitBeforeTax,
          addDepreciation: totals.depreciation,
          addAmortisation: totals.amortisation,
          addFinanceCosts: totals.financeCosts,
          lessOtherIncome: -totals.otherIncome,
          changeInInventories: 0,
          changeInTradeReceivables: 0,
          changeInSTLoansAdvances: 0,
          changeInOtherCurrentAssets: 0,
          changeInTradePayables: 0,
          changeInOtherCurrentLiabilities: 0,
          changeInSTProvisions: 0,
          cashFromOperations: profitBeforeTax + totals.depreciation + totals.amortisation,
          lessIncomeTaxPaid: 0,
        },
        netOperatingCF: profitBeforeTax + totals.depreciation + totals.amortisation,
        purchaseOfPPE: 0,
        purchaseOfIntangibles: 0,
        proceedsFromAssetSale: 0,
        netInvestingCF: 0,
        proceedsFromBorrowings: 0,
        repaymentOfBorrowings: 0,
        financeCostsPaid: -totals.financeCosts,
        dividendsPaid: 0,
        proceedsFromShareIssue: 0,
        netFinancingCF: -totals.financeCosts,
        netCashFlow: profitBeforeTax + totals.depreciation + totals.amortisation - totals.financeCosts,
        openingCash: 0,
        closingCash: totals.cash,
        cashIn: 0, cashOut: 0,
        operatingCashFlow: profitBeforeTax + totals.depreciation + totals.amortisation,
        investingCashFlow: 0,
        financingCashFlow: -totals.financeCosts,
        indirect: { netIncome: profitBeforeTax, depreciation: totals.depreciation, changeInAR: 0, changeInAP: 0 },
      },
      metadata: { monthCount: actualsCount, periodLabel },
    }

    return { annual, dataSource, actualsCount }
  } catch (err) {
    console.error('[resolvePriorYear] DB error, falling back to no prior year:', err)
    return { annual: null, dataSource: 'forecast', actualsCount: 0 }
  }
}
