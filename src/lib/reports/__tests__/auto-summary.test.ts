import { describe, it, expect } from 'vitest'
import { buildAutoSummary } from '../auto-summary'
import type { AnnualStatement } from '../annual-aggregator'

describe('buildAutoSummary', () => {
  const mockAnnualStatement: AnnualStatement = {
    pl: {
      revenueFromOps: 10000000, // 100L
      otherIncome: 1000000, // 10L
      totalRevenue: 11000000, // 110L
      cogs: 6000000, // 60L
      employeeBenefits: 2000000,
      financeCosts: 500000,
      depreciation: 300000,
      amortisation: 100000,
      otherExpenses: 1000000,
      totalExpenses: 9900000,
      profitBeforeExceptional: 1100000,
      exceptionalItems: 0,
      profitBeforeTax: 1100000,
      taxExpense: 275000,
      profitAfterTax: 825000,
      revenue: 11000000,
      grossProfit: 5000000,
      expense: 3500000,
      netIncome: 825000,
    },
    bs: {
      shareCapital: 5000000,
      securitiesPremium: 1000000,
      generalReserve: 500000,
      retainedEarnings: 2000000,
      totalShareholdersEquity: 8500000,
      ltBorrowings: 3000000,
      stBorrowings: 1000000,
      otherCurrentLiabilities: 500000,
      stProvisions: 200000,
      totalNonCurrentLiabilities: 3000000,
      totalCurrentLiabilities: 1700000,
      cash: 2000000,
      tradeReceivables: 3000000,
      netPPE: 5000000,
      intangibles: 1000000,
      accAmortisation: 200000,
      netIntangibles: 800000,
      inventories: 2000000,
      stLoansAdvances: 500000,
      otherCurrentAssets: 500000,
      totalCurrentAssets: 8000000,
      totalNonCurrentAssets: 5800000,
      totalAssets: 13800000,
      ar: 3000000,
      fixedAssets: 5000000,
      accDepreciation: 1000000,
      ap: 500000,
      debt: 4000000,
      totalLiabilities: 4700000,
      equity: 5000000,
      totalEquity: 8500000,
    },
    cf: {
      operatingIndirect: {
        profitBeforeTax: 1100000,
        addDepreciation: 300000,
        addAmortisation: 100000,
        addFinanceCosts: 500000,
        lessOtherIncome: -1000000,
        changeInInventories: -500000,
        changeInTradeReceivables: -1000000,
        changeInSTLoansAdvances: -200000,
        changeInOtherCurrentAssets: -100000,
        changeInTradePayables: 300000,
        changeInOtherCurrentLiabilities: 100000,
        changeInSTProvisions: 50000,
        cashFromOperations: 650000,
        lessIncomeTaxPaid: -275000,
      },
      netOperatingCF: 375000,
      purchaseOfPPE: -1000000,
      purchaseOfIntangibles: -200000,
      proceedsFromAssetSale: 100000,
      netInvestingCF: -1100000,
      proceedsFromBorrowings: 1000000,
      repaymentOfBorrowings: -500000,
      financeCostsPaid: -500000,
      dividendsPaid: -200000,
      proceedsFromShareIssue: 0,
      netFinancingCF: -200000,
      netCashFlow: -925000,
      openingCash: 2925000,
      closingCash: 2000000,
      cashIn: 8000000,
      cashOut: 7000000,
      operatingCashFlow: 375000,
      investingCashFlow: -1100000,
      financingCashFlow: -200000,
      indirect: {
        netIncome: 1100000,
        depreciation: 300000,
        changeInAR: -1000000,
        changeInAP: 300000,
      },
    },
    metadata: {
      monthCount: 12,
      periodLabel: 'FY25-26',
    },
  }

  describe('P&L Summary', () => {
    it('generates P&L summary without prior year', () => {
      const bullets = buildAutoSummary('PL', mockAnnualStatement, null)

      expect(bullets).toContain('Gross margin is 40.0%')
      expect(bullets).toContain('PAT margin is 7.5%')
      expect(bullets.length).toBeGreaterThan(0)
    })

    it('generates P&L summary with prior year (growth)', () => {
      const priorYear = {
        ...mockAnnualStatement,
        pl: {
          ...mockAnnualStatement.pl,
          revenueFromOps: 8000000, // 80L (prior year)
        },
      }

      const bullets = buildAutoSummary('PL', mockAnnualStatement, priorYear)

      expect(bullets.some(b => b.includes('grew 25.0% year-over-year'))).toBe(true)
    })

    it('generates P&L summary with prior year (decline)', () => {
      const priorYear = {
        ...mockAnnualStatement,
        pl: {
          ...mockAnnualStatement.pl,
          revenueFromOps: 12000000, // 120L (prior year - higher)
        },
      }

      const bullets = buildAutoSummary('PL', mockAnnualStatement, priorYear)

      expect(bullets.some(b => b.includes('declined') && b.includes('16.7%'))).toBe(true)
    })

    it('handles zero revenue gracefully', () => {
      const zeroRevenue = {
        ...mockAnnualStatement,
        pl: {
          ...mockAnnualStatement.pl,
          revenueFromOps: 0,
          totalRevenue: 0,
        },
      }

      const bullets = buildAutoSummary('PL', zeroRevenue, null)

      // Should not include margin metrics when revenue is zero
      expect(bullets.every(b => !b.includes('NaN'))).toBe(true)
      expect(bullets.every(b => !b.includes('Infinity'))).toBe(true)
    })
  })

  describe('Balance Sheet Summary', () => {
    it('generates BS summary', () => {
      const bullets = buildAutoSummary('BS', mockAnnualStatement, null)

      expect(bullets.some(b => b.includes('Closing cash'))).toBe(true)
      expect(bullets.some(b => b.includes('Total debt'))).toBe(true)
      expect(bullets.some(b => b.includes('Debt-to-equity ratio: 0.47'))).toBe(true)
      expect(bullets.some(b => b.includes('Working capital'))).toBe(true)
      expect(bullets.some(b => b.includes('Current ratio'))).toBe(true)
    })

    it('handles zero equity gracefully', () => {
      const zeroEquity = {
        ...mockAnnualStatement,
        bs: {
          ...mockAnnualStatement.bs,
          totalShareholdersEquity: 0,
        },
      }

      const bullets = buildAutoSummary('BS', zeroEquity, null)

      // Should not include debt-to-equity when equity is zero
      expect(bullets.every(b => !b.includes('NaN'))).toBe(true)
      expect(bullets.every(b => !b.includes('Infinity'))).toBe(true)
    })
  })

  describe('Cash Flow Summary', () => {
    it('generates CF summary with positive operating cash flow', () => {
      const bullets = buildAutoSummary('CF', mockAnnualStatement, null)

      expect(bullets.some(b => b.includes('Net operating cash flow'))).toBe(true)
      expect(bullets.some(b => b.includes('Net investing cash flow'))).toBe(true)
      expect(bullets.some(b => b.includes('Net financing cash flow'))).toBe(true)
      expect(bullets.some(b => b.includes('Net cash flow'))).toBe(true)
      expect(bullets.some(b => b.includes('Operating cash flow is positive'))).toBe(true)
    })

    it('generates CF summary with negative operating cash flow', () => {
      const negativeOCF = {
        ...mockAnnualStatement,
        cf: {
          ...mockAnnualStatement.cf,
          netOperatingCF: -500000,
        },
      }

      const bullets = buildAutoSummary('CF', negativeOCF, null)

      expect(bullets.some(b => b.includes('Operating cash flow is negative'))).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('returns empty array for invalid statement type', () => {
      // @ts-expect-error - Testing invalid input
      const bullets = buildAutoSummary('INVALID', mockAnnualStatement, null)

      expect(bullets).toEqual([])
    })

    it('handles all-zero statement', () => {
      const zeroStatement: AnnualStatement = {
        pl: {
          revenueFromOps: 0,
          otherIncome: 0,
          totalRevenue: 0,
          cogs: 0,
          employeeBenefits: 0,
          financeCosts: 0,
          depreciation: 0,
          amortisation: 0,
          otherExpenses: 0,
          totalExpenses: 0,
          profitBeforeExceptional: 0,
          exceptionalItems: 0,
          profitBeforeTax: 0,
          taxExpense: 0,
          profitAfterTax: 0,
          revenue: 0,
          grossProfit: 0,
          expense: 0,
          netIncome: 0,
        },
        bs: {
          shareCapital: 0,
          securitiesPremium: 0,
          generalReserve: 0,
          retainedEarnings: 0,
          totalShareholdersEquity: 0,
          ltBorrowings: 0,
          stBorrowings: 0,
          otherCurrentLiabilities: 0,
          stProvisions: 0,
          totalNonCurrentLiabilities: 0,
          totalCurrentLiabilities: 0,
          cash: 0,
          tradeReceivables: 0,
          netPPE: 0,
          intangibles: 0,
          accAmortisation: 0,
          netIntangibles: 0,
          inventories: 0,
          stLoansAdvances: 0,
          otherCurrentAssets: 0,
          totalCurrentAssets: 0,
          totalNonCurrentAssets: 0,
          totalAssets: 0,
          ar: 0,
          fixedAssets: 0,
          accDepreciation: 0,
          ap: 0,
          debt: 0,
          totalLiabilities: 0,
          equity: 0,
          totalEquity: 0,
        },
        cf: {
          operatingIndirect: {
            profitBeforeTax: 0,
            addDepreciation: 0,
            addAmortisation: 0,
            addFinanceCosts: 0,
            lessOtherIncome: 0,
            changeInInventories: 0,
            changeInTradeReceivables: 0,
            changeInSTLoansAdvances: 0,
            changeInOtherCurrentAssets: 0,
            changeInTradePayables: 0,
            changeInOtherCurrentLiabilities: 0,
            changeInSTProvisions: 0,
            cashFromOperations: 0,
            lessIncomeTaxPaid: 0,
          },
          netOperatingCF: 0,
          purchaseOfPPE: 0,
          purchaseOfIntangibles: 0,
          proceedsFromAssetSale: 0,
          netInvestingCF: 0,
          proceedsFromBorrowings: 0,
          repaymentOfBorrowings: 0,
          financeCostsPaid: 0,
          dividendsPaid: 0,
          proceedsFromShareIssue: 0,
          netFinancingCF: 0,
          netCashFlow: 0,
          openingCash: 0,
          closingCash: 0,
          cashIn: 0,
          cashOut: 0,
          operatingCashFlow: 0,
          investingCashFlow: 0,
          financingCashFlow: 0,
          indirect: {
            netIncome: 0,
            depreciation: 0,
            changeInAR: 0,
            changeInAP: 0,
          },
        },
        metadata: {
          monthCount: 12,
          periodLabel: 'FY25-26',
        },
      }

      const bullets = buildAutoSummary('PL', zeroStatement, null)

      // Should not produce NaN or Infinity
      expect(bullets.every(b => !b.includes('NaN'))).toBe(true)
      expect(bullets.every(b => !b.includes('Infinity'))).toBe(true)
    })
  })
})
