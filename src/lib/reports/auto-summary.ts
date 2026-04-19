/**
 * Auto-Summary Generator
 * 
 * Generates rule-based bullet-point summaries for financial statements.
 * NO LLM or external AI - pure deterministic rules.
 */

import type { AnnualStatement } from './annual-aggregator'

/**
 * Build auto-summary bullets for a financial statement.
 * 
 * Algorithm:
 * - P&L: Revenue growth %, gross margin %, PAT margin %
 * - BS: Closing cash, total debt, debt-to-equity ratio, working capital
 * - CF: Net operating/investing/financing cash flows
 * 
 * Handles division-by-zero gracefully by omitting metrics instead of returning NaN.
 * 
 * @param statementType - 'PL' | 'BS' | 'CF'
 * @param annual - Current year annual statement
 * @param priorAnnual - Prior year annual statement (optional)
 * @returns Array of bullet strings
 * 
 * @example
 * const bullets = buildAutoSummary('PL', currentYear, priorYear)
 * // ["Revenue grew 15.2% year-over-year", "Gross margin is 45.3%", ...]
 */
export function buildAutoSummary(
  statementType: 'PL' | 'BS' | 'CF',
  annual: AnnualStatement,
  priorAnnual: AnnualStatement | null
): string[] {
  const bullets: string[] = []

  if (statementType === 'PL') {
    // Revenue growth (only if prior year available)
    if (priorAnnual && priorAnnual.pl.revenueFromOps !== 0) {
      const growth = ((annual.pl.revenueFromOps - priorAnnual.pl.revenueFromOps) / priorAnnual.pl.revenueFromOps) * 100
      bullets.push(`Revenue ${growth >= 0 ? 'grew' : 'declined'} ${Math.abs(growth).toFixed(1)}% year-over-year`)
    }

    // Gross margin
    if (annual.pl.revenueFromOps !== 0) {
      const grossMargin = ((annual.pl.revenueFromOps - annual.pl.cogs) / annual.pl.revenueFromOps) * 100
      bullets.push(`Gross margin is ${grossMargin.toFixed(1)}%`)
    }

    // PAT margin
    if (annual.pl.totalRevenue !== 0) {
      const patMargin = (annual.pl.profitAfterTax / annual.pl.totalRevenue) * 100
      bullets.push(`PAT margin is ${patMargin.toFixed(1)}%`)
    }

    // EBITDA (if we have the components)
    const ebitda = annual.pl.profitBeforeTax + annual.pl.financeCosts + annual.pl.depreciation + annual.pl.amortisation
    if (annual.pl.totalRevenue !== 0) {
      const ebitdaMargin = (ebitda / annual.pl.totalRevenue) * 100
      bullets.push(`EBITDA margin is ${ebitdaMargin.toFixed(1)}%`)
    }
  } else if (statementType === 'BS') {
    // Closing cash
    bullets.push(`Closing cash: ₹${formatAmount(annual.bs.cash)}`)

    // Total debt
    const totalDebt = annual.bs.ltBorrowings + annual.bs.stBorrowings
    bullets.push(`Total debt: ₹${formatAmount(totalDebt)}`)

    // Debt-to-equity ratio
    if (annual.bs.totalShareholdersEquity !== 0) {
      const debtToEquity = totalDebt / annual.bs.totalShareholdersEquity
      bullets.push(`Debt-to-equity ratio: ${debtToEquity.toFixed(2)}`)
    }

    // Working capital
    const workingCapital = annual.bs.totalCurrentAssets - annual.bs.totalCurrentLiabilities
    bullets.push(`Working capital: ₹${formatAmount(workingCapital)}`)

    // Current ratio
    if (annual.bs.totalCurrentLiabilities !== 0) {
      const currentRatio = annual.bs.totalCurrentAssets / annual.bs.totalCurrentLiabilities
      bullets.push(`Current ratio: ${currentRatio.toFixed(2)}`)
    }
  } else if (statementType === 'CF') {
    // Net operating cash flow
    bullets.push(`Net operating cash flow: ₹${formatAmount(annual.cf.netOperatingCF)}`)

    // Net investing cash flow
    bullets.push(`Net investing cash flow: ₹${formatAmount(annual.cf.netInvestingCF)}`)

    // Net financing cash flow
    bullets.push(`Net financing cash flow: ₹${formatAmount(annual.cf.netFinancingCF)}`)

    // Net cash flow
    bullets.push(`Net cash flow: ₹${formatAmount(annual.cf.netCashFlow)}`)

    // Cash flow health indicator
    if (annual.cf.netOperatingCF > 0) {
      bullets.push('Operating cash flow is positive')
    } else {
      bullets.push('Operating cash flow is negative')
    }
  }

  return bullets
}

/**
 * Format amount in paise to human-readable string.
 * Converts to lakhs/crores based on magnitude.
 */
function formatAmount(paise: number): string {
  const rupees = paise / 100
  const absRupees = Math.abs(rupees)
  
  if (absRupees >= 10000000) {
    // Crores
    return `${(rupees / 10000000).toFixed(2)}Cr`
  } else if (absRupees >= 100000) {
    // Lakhs
    return `${(rupees / 100000).toFixed(2)}L`
  } else if (absRupees >= 1000) {
    // Thousands
    return `${(rupees / 1000).toFixed(2)}K`
  } else {
    return rupees.toFixed(2)
  }
}
