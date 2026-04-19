import { describe, it, expect } from 'vitest'
import { aggregateAnnual } from '../annual-aggregator'
import type { ThreeWayMonth } from '../../engine/three-way/builder'

/**
 * Property 1: Round-trip summation for P&L
 * Validates: Requirements 1.2, 1.6
 * 
 * For all valid arrays of 12 ThreeWayMonth objects,
 * aggregateAnnual(months).pl.totalRevenue SHALL equal the sum of month.pl.totalRevenue
 */
describe('aggregateAnnual - P&L Round-trip Summation Property', () => {
  it('sums totalRevenue correctly across 12 months', () => {
    const months: ThreeWayMonth[] = Array.from({ length: 12 }, (_, i) => ({
      pl: {
        revenue: 100000,
        cogs: 50000,
        grossProfit: 50000,
        expense: 20000,
        depreciation: 5000,
        netIncome: 25000,
        revenueFromOps: 90000,
        otherIncome: 10000,
        totalRevenue: 100000,
        employeeBenefits: 10000,
        financeCosts: 2000,
        amortisation: 1000,
        otherExpenses: 7000,
        totalExpenses: 75000,
        profitBeforeExceptional: 25000,
        exceptionalItems: 0,
        profitBeforeTax: 25000,
        taxExpense: 5000,
        profitAfterTax: 20000,
      },
      bs: {
        cash: 50000,
        ar: 30000,
        fixedAssets: 100000,
        accDepreciation: 20000,
        totalAssets: 160000,
        ap: 20000,
        debt: 40000,
        totalLiabilities: 60000,
        equity: 50000,
        retainedEarnings: 50000,
        totalEquity: 100000,
        shareCapital: 50000,
        securitiesPremium: 0,
        generalReserve: 0,
        totalShareholdersEquity: 100000,
        ltBorrowings: 30000,
        stBorrowings: 10000,
        otherCurrentLiabilities: 0,
        stProvisions: 0,
        totalNonCurrentLiabilities: 30000,
        totalCurrentLiabilities: 30000,
        netPPE: 80000,
        intangibles: 10000,
        accAmortisation: 2000,
        netIntangibles: 8000,
        inventories: 20000,
        tradeReceivables: 30000,
        stLoansAdvances: 5000,
        otherCurrentAssets: 5000,
        totalCurrentAssets: 110000,
        totalNonCurrentAssets: 88000,
      },
      cf: {
        cashIn: 80000,
        cashOut: 60000,
        operatingCashFlow: 20000,
        investingCashFlow: -10000,
        financingCashFlow: 5000,
        netCashFlow: 15000,
        indirect: {
          netIncome: 25000,
          depreciation: 5000,
          changeInAR: -10000,
          changeInAP: 5000,
        },
        operatingIndirect: {
          profitBeforeTax: 25000,
          addDepreciation: 5000,
          addAmortisation: 1000,
          addFinanceCosts: 2000,
          lessOtherIncome: -10000,
          changeInInventories: -5000,
          changeInTradeReceivables: -10000,
          changeInSTLoansAdvances: -1000,
          changeInOtherCurrentAssets: -1000,
          changeInTradePayables: 5000,
          changeInOtherCurrentLiabilities: 0,
          changeInSTProvisions: 0,
          cashFromOperations: 21000,
          lessIncomeTaxPaid: -1000,
        },
        netOperatingCF: 20000,
        purchaseOfPPE: -10000,
        purchaseOfIntangibles: 0,
        proceedsFromAssetSale: 0,
        netInvestingCF: -10000,
        proceedsFromBorrowings: 10000,
        repaymentOfBorrowings: -3000,
        financeCostsPaid: -2000,
        dividendsPaid: 0,
        proceedsFromShareIssue: 0,
        netFinancingCF: 5000,
        openingCash: 35000,
        closingCash: 50000,
      },
    }))

    const annual = aggregateAnnual(months)

    // Verify round-trip summation: annual total = sum of monthly totals
    const expectedTotalRevenue = months.reduce((sum, m) => sum + m.pl.totalRevenue, 0)
    expect(annual.pl.totalRevenue).toBe(expectedTotalRevenue)
    expect(annual.pl.totalRevenue).toBe(100000 * 12) // 1,200,000
  })

  it('sums profitAfterTax correctly across 12 months', () => {
    const months: ThreeWayMonth[] = Array.from({ length: 12 }, (_, i) => ({
      pl: {
        revenue: 100000,
        cogs: 50000,
        grossProfit: 50000,
        expense: 20000,
        depreciation: 5000,
        netIncome: 25000,
        revenueFromOps: 90000,
        otherIncome: 10000,
        totalRevenue: 100000,
        employeeBenefits: 10000,
        financeCosts: 2000,
        amortisation: 1000,
        otherExpenses: 7000,
        totalExpenses: 75000,
        profitBeforeExceptional: 25000,
        exceptionalItems: 0,
        profitBeforeTax: 25000,
        taxExpense: 5000,
        profitAfterTax: 20000,
      },
      bs: {
        cash: 50000,
        ar: 30000,
        fixedAssets: 100000,
        accDepreciation: 20000,
        totalAssets: 160000,
        ap: 20000,
        debt: 40000,
        totalLiabilities: 60000,
        equity: 50000,
        retainedEarnings: 50000,
        totalEquity: 100000,
        shareCapital: 50000,
        securitiesPremium: 0,
        generalReserve: 0,
        totalShareholdersEquity: 100000,
        ltBorrowings: 30000,
        stBorrowings: 10000,
        otherCurrentLiabilities: 0,
        stProvisions: 0,
        totalNonCurrentLiabilities: 30000,
        totalCurrentLiabilities: 30000,
        netPPE: 80000,
        intangibles: 10000,
        accAmortisation: 2000,
        netIntangibles: 8000,
        inventories: 20000,
        tradeReceivables: 30000,
        stLoansAdvances: 5000,
        otherCurrentAssets: 5000,
        totalCurrentAssets: 110000,
        totalNonCurrentAssets: 88000,
      },
      cf: {
        cashIn: 80000,
        cashOut: 60000,
        operatingCashFlow: 20000,
        investingCashFlow: -10000,
        financingCashFlow: 5000,
        netCashFlow: 15000,
        indirect: {
          netIncome: 25000,
          depreciation: 5000,
          changeInAR: -10000,
          changeInAP: 5000,
        },
        operatingIndirect: {
          profitBeforeTax: 25000,
          addDepreciation: 5000,
          addAmortisation: 1000,
          addFinanceCosts: 2000,
          lessOtherIncome: -10000,
          changeInInventories: -5000,
          changeInTradeReceivables: -10000,
          changeInSTLoansAdvances: -1000,
          changeInOtherCurrentAssets: -1000,
          changeInTradePayables: 5000,
          changeInOtherCurrentLiabilities: 0,
          changeInSTProvisions: 0,
          cashFromOperations: 21000,
          lessIncomeTaxPaid: -1000,
        },
        netOperatingCF: 20000,
        purchaseOfPPE: -10000,
        purchaseOfIntangibles: 0,
        proceedsFromAssetSale: 0,
        netInvestingCF: -10000,
        proceedsFromBorrowings: 10000,
        repaymentOfBorrowings: -3000,
        financeCostsPaid: -2000,
        dividendsPaid: 0,
        proceedsFromShareIssue: 0,
        netFinancingCF: 5000,
        openingCash: 35000,
        closingCash: 50000,
      },
    }))

    const annual = aggregateAnnual(months)

    // Verify round-trip summation: annual PAT = sum of monthly PAT
    const expectedPAT = months.reduce((sum, m) => sum + m.pl.profitAfterTax, 0)
    expect(annual.pl.profitAfterTax).toBe(expectedPAT)
    expect(annual.pl.profitAfterTax).toBe(20000 * 12) // 240,000
  })

  it('sums all P&L flow fields correctly', () => {
    const months: ThreeWayMonth[] = Array.from({ length: 12 }, (_, i) => ({
      pl: {
        revenue: 100000 + i * 1000,
        cogs: 50000 + i * 500,
        grossProfit: 50000 + i * 500,
        expense: 20000 + i * 200,
        depreciation: 5000,
        netIncome: 25000 + i * 300,
        revenueFromOps: 90000 + i * 900,
        otherIncome: 10000 + i * 100,
        totalRevenue: 100000 + i * 1000,
        employeeBenefits: 10000 + i * 100,
        financeCosts: 2000,
        amortisation: 1000,
        otherExpenses: 7000 + i * 100,
        totalExpenses: 75000 + i * 700,
        profitBeforeExceptional: 25000 + i * 300,
        exceptionalItems: 0,
        profitBeforeTax: 25000 + i * 300,
        taxExpense: 5000 + i * 60,
        profitAfterTax: 20000 + i * 240,
      },
      bs: {
        cash: 50000,
        ar: 30000,
        fixedAssets: 100000,
        accDepreciation: 20000,
        totalAssets: 160000,
        ap: 20000,
        debt: 40000,
        totalLiabilities: 60000,
        equity: 50000,
        retainedEarnings: 50000,
        totalEquity: 100000,
        shareCapital: 50000,
        securitiesPremium: 0,
        generalReserve: 0,
        totalShareholdersEquity: 100000,
        ltBorrowings: 30000,
        stBorrowings: 10000,
        otherCurrentLiabilities: 0,
        stProvisions: 0,
        totalNonCurrentLiabilities: 30000,
        totalCurrentLiabilities: 30000,
        netPPE: 80000,
        intangibles: 10000,
        accAmortisation: 2000,
        netIntangibles: 8000,
        inventories: 20000,
        tradeReceivables: 30000,
        stLoansAdvances: 5000,
        otherCurrentAssets: 5000,
        totalCurrentAssets: 110000,
        totalNonCurrentAssets: 88000,
      },
      cf: {
        cashIn: 80000,
        cashOut: 60000,
        operatingCashFlow: 20000,
        investingCashFlow: -10000,
        financingCashFlow: 5000,
        netCashFlow: 15000,
        indirect: {
          netIncome: 25000,
          depreciation: 5000,
          changeInAR: -10000,
          changeInAP: 5000,
        },
        operatingIndirect: {
          profitBeforeTax: 25000,
          addDepreciation: 5000,
          addAmortisation: 1000,
          addFinanceCosts: 2000,
          lessOtherIncome: -10000,
          changeInInventories: -5000,
          changeInTradeReceivables: -10000,
          changeInSTLoansAdvances: -1000,
          changeInOtherCurrentAssets: -1000,
          changeInTradePayables: 5000,
          changeInOtherCurrentLiabilities: 0,
          changeInSTProvisions: 0,
          cashFromOperations: 21000,
          lessIncomeTaxPaid: -1000,
        },
        netOperatingCF: 20000,
        purchaseOfPPE: -10000,
        purchaseOfIntangibles: 0,
        proceedsFromAssetSale: 0,
        netInvestingCF: -10000,
        proceedsFromBorrowings: 10000,
        repaymentOfBorrowings: -3000,
        financeCostsPaid: -2000,
        dividendsPaid: 0,
        proceedsFromShareIssue: 0,
        netFinancingCF: 5000,
        openingCash: 35000,
        closingCash: 50000,
      },
    }))

    const annual = aggregateAnnual(months)

    // Verify all P&L fields are summed correctly
    expect(annual.pl.revenueFromOps).toBe(months.reduce((sum, m) => sum + m.pl.revenueFromOps, 0))
    expect(annual.pl.otherIncome).toBe(months.reduce((sum, m) => sum + m.pl.otherIncome, 0))
    expect(annual.pl.cogs).toBe(months.reduce((sum, m) => sum + m.pl.cogs, 0))
    expect(annual.pl.employeeBenefits).toBe(months.reduce((sum, m) => sum + m.pl.employeeBenefits, 0))
    expect(annual.pl.depreciation).toBe(months.reduce((sum, m) => sum + m.pl.depreciation, 0))
    expect(annual.pl.taxExpense).toBe(months.reduce((sum, m) => sum + m.pl.taxExpense, 0))
  })
})

/**
 * Property 2: Last-month point-in-time for BS
 * Validates: Requirements 1.3, 1.7
 * 
 * For all valid arrays of 12 ThreeWayMonth objects,
 * aggregateAnnual(months).bs.cash SHALL equal months[11].bs.cash
 */
describe('aggregateAnnual - Balance Sheet Point-in-Time Property', () => {
  it('takes cash from last month (not summed)', () => {
    const months: ThreeWayMonth[] = Array.from({ length: 12 }, (_, i) => ({
      pl: {
        revenue: 100000,
        cogs: 50000,
        grossProfit: 50000,
        expense: 20000,
        depreciation: 5000,
        netIncome: 25000,
        revenueFromOps: 90000,
        otherIncome: 10000,
        totalRevenue: 100000,
        employeeBenefits: 10000,
        financeCosts: 2000,
        amortisation: 1000,
        otherExpenses: 7000,
        totalExpenses: 75000,
        profitBeforeExceptional: 25000,
        exceptionalItems: 0,
        profitBeforeTax: 25000,
        taxExpense: 5000,
        profitAfterTax: 20000,
      },
      bs: {
        cash: 50000 + i * 10000, // Cash grows each month
        ar: 30000,
        fixedAssets: 100000,
        accDepreciation: 20000,
        totalAssets: 160000,
        ap: 20000,
        debt: 40000,
        totalLiabilities: 60000,
        equity: 50000,
        retainedEarnings: 50000,
        totalEquity: 100000,
        shareCapital: 50000,
        securitiesPremium: 0,
        generalReserve: 0,
        totalShareholdersEquity: 100000,
        ltBorrowings: 30000,
        stBorrowings: 10000,
        otherCurrentLiabilities: 0,
        stProvisions: 0,
        totalNonCurrentLiabilities: 30000,
        totalCurrentLiabilities: 30000,
        netPPE: 80000,
        intangibles: 10000,
        accAmortisation: 2000,
        netIntangibles: 8000,
        inventories: 20000,
        tradeReceivables: 30000,
        stLoansAdvances: 5000,
        otherCurrentAssets: 5000,
        totalCurrentAssets: 110000,
        totalNonCurrentAssets: 88000,
      },
      cf: {
        cashIn: 80000,
        cashOut: 60000,
        operatingCashFlow: 20000,
        investingCashFlow: -10000,
        financingCashFlow: 5000,
        netCashFlow: 15000,
        indirect: {
          netIncome: 25000,
          depreciation: 5000,
          changeInAR: -10000,
          changeInAP: 5000,
        },
        operatingIndirect: {
          profitBeforeTax: 25000,
          addDepreciation: 5000,
          addAmortisation: 1000,
          addFinanceCosts: 2000,
          lessOtherIncome: -10000,
          changeInInventories: -5000,
          changeInTradeReceivables: -10000,
          changeInSTLoansAdvances: -1000,
          changeInOtherCurrentAssets: -1000,
          changeInTradePayables: 5000,
          changeInOtherCurrentLiabilities: 0,
          changeInSTProvisions: 0,
          cashFromOperations: 21000,
          lessIncomeTaxPaid: -1000,
        },
        netOperatingCF: 20000,
        purchaseOfPPE: -10000,
        purchaseOfIntangibles: 0,
        proceedsFromAssetSale: 0,
        netInvestingCF: -10000,
        proceedsFromBorrowings: 10000,
        repaymentOfBorrowings: -3000,
        financeCostsPaid: -2000,
        dividendsPaid: 0,
        proceedsFromShareIssue: 0,
        netFinancingCF: 5000,
        openingCash: 35000,
        closingCash: 50000 + i * 10000,
      },
    }))

    const annual = aggregateAnnual(months)

    // Verify point-in-time: annual cash = last month's cash (not sum)
    const lastMonth = months[11]
    expect(annual.bs.cash).toBe(lastMonth.bs.cash)
    expect(annual.bs.cash).toBe(50000 + 11 * 10000) // 160,000
    
    // Verify it's NOT the sum
    const sumOfAllCash = months.reduce((sum, m) => sum + m.bs.cash, 0)
    expect(annual.bs.cash).not.toBe(sumOfAllCash)
  })

  it('takes totalAssets from last month (not summed)', () => {
    const months: ThreeWayMonth[] = Array.from({ length: 12 }, (_, i) => ({
      pl: {
        revenue: 100000,
        cogs: 50000,
        grossProfit: 50000,
        expense: 20000,
        depreciation: 5000,
        netIncome: 25000,
        revenueFromOps: 90000,
        otherIncome: 10000,
        totalRevenue: 100000,
        employeeBenefits: 10000,
        financeCosts: 2000,
        amortisation: 1000,
        otherExpenses: 7000,
        totalExpenses: 75000,
        profitBeforeExceptional: 25000,
        exceptionalItems: 0,
        profitBeforeTax: 25000,
        taxExpense: 5000,
        profitAfterTax: 20000,
      },
      bs: {
        cash: 50000,
        ar: 30000,
        fixedAssets: 100000,
        accDepreciation: 20000,
        totalAssets: 160000 + i * 5000, // Assets grow each month
        ap: 20000,
        debt: 40000,
        totalLiabilities: 60000,
        equity: 50000,
        retainedEarnings: 50000,
        totalEquity: 100000,
        shareCapital: 50000,
        securitiesPremium: 0,
        generalReserve: 0,
        totalShareholdersEquity: 100000,
        ltBorrowings: 30000,
        stBorrowings: 10000,
        otherCurrentLiabilities: 0,
        stProvisions: 0,
        totalNonCurrentLiabilities: 30000,
        totalCurrentLiabilities: 30000,
        netPPE: 80000,
        intangibles: 10000,
        accAmortisation: 2000,
        netIntangibles: 8000,
        inventories: 20000,
        tradeReceivables: 30000,
        stLoansAdvances: 5000,
        otherCurrentAssets: 5000,
        totalCurrentAssets: 110000,
        totalNonCurrentAssets: 88000,
      },
      cf: {
        cashIn: 80000,
        cashOut: 60000,
        operatingCashFlow: 20000,
        investingCashFlow: -10000,
        financingCashFlow: 5000,
        netCashFlow: 15000,
        indirect: {
          netIncome: 25000,
          depreciation: 5000,
          changeInAR: -10000,
          changeInAP: 5000,
        },
        operatingIndirect: {
          profitBeforeTax: 25000,
          addDepreciation: 5000,
          addAmortisation: 1000,
          addFinanceCosts: 2000,
          lessOtherIncome: -10000,
          changeInInventories: -5000,
          changeInTradeReceivables: -10000,
          changeInSTLoansAdvances: -1000,
          changeInOtherCurrentAssets: -1000,
          changeInTradePayables: 5000,
          changeInOtherCurrentLiabilities: 0,
          changeInSTProvisions: 0,
          cashFromOperations: 21000,
          lessIncomeTaxPaid: -1000,
        },
        netOperatingCF: 20000,
        purchaseOfPPE: -10000,
        purchaseOfIntangibles: 0,
        proceedsFromAssetSale: 0,
        netInvestingCF: -10000,
        proceedsFromBorrowings: 10000,
        repaymentOfBorrowings: -3000,
        financeCostsPaid: -2000,
        dividendsPaid: 0,
        proceedsFromShareIssue: 0,
        netFinancingCF: 5000,
        openingCash: 35000,
        closingCash: 50000,
      },
    }))

    const annual = aggregateAnnual(months)

    // Verify point-in-time: annual totalAssets = last month's totalAssets
    const lastMonth = months[11]
    expect(annual.bs.totalAssets).toBe(lastMonth.bs.totalAssets)
    expect(annual.bs.totalAssets).toBe(160000 + 11 * 5000) // 215,000
  })

  it('takes all BS fields from last month', () => {
    const months: ThreeWayMonth[] = Array.from({ length: 12 }, (_, i) => ({
      pl: {
        revenue: 100000,
        cogs: 50000,
        grossProfit: 50000,
        expense: 20000,
        depreciation: 5000,
        netIncome: 25000,
        revenueFromOps: 90000,
        otherIncome: 10000,
        totalRevenue: 100000,
        employeeBenefits: 10000,
        financeCosts: 2000,
        amortisation: 1000,
        otherExpenses: 7000,
        totalExpenses: 75000,
        profitBeforeExceptional: 25000,
        exceptionalItems: 0,
        profitBeforeTax: 25000,
        taxExpense: 5000,
        profitAfterTax: 20000,
      },
      bs: {
        cash: 50000 + i * 1000,
        ar: 30000 + i * 500,
        fixedAssets: 100000 + i * 2000,
        accDepreciation: 20000 + i * 500,
        totalAssets: 160000 + i * 3000,
        ap: 20000 + i * 300,
        debt: 40000 + i * 1000,
        totalLiabilities: 60000 + i * 1300,
        equity: 50000,
        retainedEarnings: 50000 + i * 1700,
        totalEquity: 100000 + i * 1700,
        shareCapital: 50000,
        securitiesPremium: 0,
        generalReserve: 0,
        totalShareholdersEquity: 100000 + i * 1700,
        ltBorrowings: 30000 + i * 700,
        stBorrowings: 10000 + i * 300,
        otherCurrentLiabilities: 0,
        stProvisions: 0,
        totalNonCurrentLiabilities: 30000 + i * 700,
        totalCurrentLiabilities: 30000 + i * 600,
        netPPE: 80000 + i * 1500,
        intangibles: 10000,
        accAmortisation: 2000 + i * 100,
        netIntangibles: 8000 - i * 100,
        inventories: 20000 + i * 400,
        tradeReceivables: 30000 + i * 500,
        stLoansAdvances: 5000 + i * 100,
        otherCurrentAssets: 5000 + i * 100,
        totalCurrentAssets: 110000 + i * 2200,
        totalNonCurrentAssets: 88000 + i * 1400,
      },
      cf: {
        cashIn: 80000,
        cashOut: 60000,
        operatingCashFlow: 20000,
        investingCashFlow: -10000,
        financingCashFlow: 5000,
        netCashFlow: 15000,
        indirect: {
          netIncome: 25000,
          depreciation: 5000,
          changeInAR: -10000,
          changeInAP: 5000,
        },
        operatingIndirect: {
          profitBeforeTax: 25000,
          addDepreciation: 5000,
          addAmortisation: 1000,
          addFinanceCosts: 2000,
          lessOtherIncome: -10000,
          changeInInventories: -5000,
          changeInTradeReceivables: -10000,
          changeInSTLoansAdvances: -1000,
          changeInOtherCurrentAssets: -1000,
          changeInTradePayables: 5000,
          changeInOtherCurrentLiabilities: 0,
          changeInSTProvisions: 0,
          cashFromOperations: 21000,
          lessIncomeTaxPaid: -1000,
        },
        netOperatingCF: 20000,
        purchaseOfPPE: -10000,
        purchaseOfIntangibles: 0,
        proceedsFromAssetSale: 0,
        netInvestingCF: -10000,
        proceedsFromBorrowings: 10000,
        repaymentOfBorrowings: -3000,
        financeCostsPaid: -2000,
        dividendsPaid: 0,
        proceedsFromShareIssue: 0,
        netFinancingCF: 5000,
        openingCash: 35000,
        closingCash: 50000 + i * 1000,
      },
    }))

    const annual = aggregateAnnual(months)
    const lastMonth = months[11]

    // Verify all BS fields are point-in-time from last month
    expect(annual.bs.cash).toBe(lastMonth.bs.cash)
    expect(annual.bs.tradeReceivables).toBe(lastMonth.bs.tradeReceivables)
    expect(annual.bs.netPPE).toBe(lastMonth.bs.netPPE)
    expect(annual.bs.inventories).toBe(lastMonth.bs.inventories)
    expect(annual.bs.totalAssets).toBe(lastMonth.bs.totalAssets)
    expect(annual.bs.ltBorrowings).toBe(lastMonth.bs.ltBorrowings)
    expect(annual.bs.stBorrowings).toBe(lastMonth.bs.stBorrowings)
    expect(annual.bs.retainedEarnings).toBe(lastMonth.bs.retainedEarnings)
    expect(annual.bs.totalShareholdersEquity).toBe(lastMonth.bs.totalShareholdersEquity)
  })
})



/**
 * Edge Cases
 * Validates: Requirements 1.5
 */
describe('aggregateAnnual - Edge Cases', () => {
  it('handles fewer than 12 months correctly', () => {
    const months: ThreeWayMonth[] = Array.from({ length: 6 }, (_, i) => ({
      pl: {
        revenue: 100000,
        cogs: 50000,
        grossProfit: 50000,
        expense: 20000,
        depreciation: 5000,
        netIncome: 25000,
        revenueFromOps: 90000,
        otherIncome: 10000,
        totalRevenue: 100000,
        employeeBenefits: 10000,
        financeCosts: 2000,
        amortisation: 1000,
        otherExpenses: 7000,
        totalExpenses: 75000,
        profitBeforeExceptional: 25000,
        exceptionalItems: 0,
        profitBeforeTax: 25000,
        taxExpense: 5000,
        profitAfterTax: 20000,
      },
      bs: {
        cash: 50000 + i * 10000,
        ar: 30000,
        fixedAssets: 100000,
        accDepreciation: 20000,
        totalAssets: 160000,
        ap: 20000,
        debt: 40000,
        totalLiabilities: 60000,
        equity: 50000,
        retainedEarnings: 50000,
        totalEquity: 100000,
        shareCapital: 50000,
        securitiesPremium: 0,
        generalReserve: 0,
        totalShareholdersEquity: 100000,
        ltBorrowings: 30000,
        stBorrowings: 10000,
        otherCurrentLiabilities: 0,
        stProvisions: 0,
        totalNonCurrentLiabilities: 30000,
        totalCurrentLiabilities: 30000,
        netPPE: 80000,
        intangibles: 10000,
        accAmortisation: 2000,
        netIntangibles: 8000,
        inventories: 20000,
        tradeReceivables: 30000,
        stLoansAdvances: 5000,
        otherCurrentAssets: 5000,
        totalCurrentAssets: 110000,
        totalNonCurrentAssets: 88000,
      },
      cf: {
        cashIn: 80000,
        cashOut: 60000,
        operatingCashFlow: 20000,
        investingCashFlow: -10000,
        financingCashFlow: 5000,
        netCashFlow: 15000,
        indirect: {
          netIncome: 25000,
          depreciation: 5000,
          changeInAR: -10000,
          changeInAP: 5000,
        },
        operatingIndirect: {
          profitBeforeTax: 25000,
          addDepreciation: 5000,
          addAmortisation: 1000,
          addFinanceCosts: 2000,
          lessOtherIncome: -10000,
          changeInInventories: -5000,
          changeInTradeReceivables: -10000,
          changeInSTLoansAdvances: -1000,
          changeInOtherCurrentAssets: -1000,
          changeInTradePayables: 5000,
          changeInOtherCurrentLiabilities: 0,
          changeInSTProvisions: 0,
          cashFromOperations: 21000,
          lessIncomeTaxPaid: -1000,
        },
        netOperatingCF: 20000,
        purchaseOfPPE: -10000,
        purchaseOfIntangibles: 0,
        proceedsFromAssetSale: 0,
        netInvestingCF: -10000,
        proceedsFromBorrowings: 10000,
        repaymentOfBorrowings: -3000,
        financeCostsPaid: -2000,
        dividendsPaid: 0,
        proceedsFromShareIssue: 0,
        netFinancingCF: 5000,
        openingCash: 35000,
        closingCash: 50000 + i * 10000,
      },
    }))

    const annual = aggregateAnnual(months)

    // Verify metadata reflects actual month count
    expect(annual.metadata.monthCount).toBe(6)
    
    // Verify P&L sums only 6 months
    expect(annual.pl.totalRevenue).toBe(100000 * 6) // 600,000
    expect(annual.pl.profitAfterTax).toBe(20000 * 6) // 120,000
    
    // Verify BS takes last available month (month 5)
    expect(annual.bs.cash).toBe(50000 + 5 * 10000) // 100,000
  })

  it('handles exactly 12 months correctly', () => {
    const months: ThreeWayMonth[] = Array.from({ length: 12 }, (_, i) => ({
      pl: {
        revenue: 100000,
        cogs: 50000,
        grossProfit: 50000,
        expense: 20000,
        depreciation: 5000,
        netIncome: 25000,
        revenueFromOps: 90000,
        otherIncome: 10000,
        totalRevenue: 100000,
        employeeBenefits: 10000,
        financeCosts: 2000,
        amortisation: 1000,
        otherExpenses: 7000,
        totalExpenses: 75000,
        profitBeforeExceptional: 25000,
        exceptionalItems: 0,
        profitBeforeTax: 25000,
        taxExpense: 5000,
        profitAfterTax: 20000,
      },
      bs: {
        cash: 50000,
        ar: 30000,
        fixedAssets: 100000,
        accDepreciation: 20000,
        totalAssets: 160000,
        ap: 20000,
        debt: 40000,
        totalLiabilities: 60000,
        equity: 50000,
        retainedEarnings: 50000,
        totalEquity: 100000,
        shareCapital: 50000,
        securitiesPremium: 0,
        generalReserve: 0,
        totalShareholdersEquity: 100000,
        ltBorrowings: 30000,
        stBorrowings: 10000,
        otherCurrentLiabilities: 0,
        stProvisions: 0,
        totalNonCurrentLiabilities: 30000,
        totalCurrentLiabilities: 30000,
        netPPE: 80000,
        intangibles: 10000,
        accAmortisation: 2000,
        netIntangibles: 8000,
        inventories: 20000,
        tradeReceivables: 30000,
        stLoansAdvances: 5000,
        otherCurrentAssets: 5000,
        totalCurrentAssets: 110000,
        totalNonCurrentAssets: 88000,
      },
      cf: {
        cashIn: 80000,
        cashOut: 60000,
        operatingCashFlow: 20000,
        investingCashFlow: -10000,
        financingCashFlow: 5000,
        netCashFlow: 15000,
        indirect: {
          netIncome: 25000,
          depreciation: 5000,
          changeInAR: -10000,
          changeInAP: 5000,
        },
        operatingIndirect: {
          profitBeforeTax: 25000,
          addDepreciation: 5000,
          addAmortisation: 1000,
          addFinanceCosts: 2000,
          lessOtherIncome: -10000,
          changeInInventories: -5000,
          changeInTradeReceivables: -10000,
          changeInSTLoansAdvances: -1000,
          changeInOtherCurrentAssets: -1000,
          changeInTradePayables: 5000,
          changeInOtherCurrentLiabilities: 0,
          changeInSTProvisions: 0,
          cashFromOperations: 21000,
          lessIncomeTaxPaid: -1000,
        },
        netOperatingCF: 20000,
        purchaseOfPPE: -10000,
        purchaseOfIntangibles: 0,
        proceedsFromAssetSale: 0,
        netInvestingCF: -10000,
        proceedsFromBorrowings: 10000,
        repaymentOfBorrowings: -3000,
        financeCostsPaid: -2000,
        dividendsPaid: 0,
        proceedsFromShareIssue: 0,
        netFinancingCF: 5000,
        openingCash: 35000,
        closingCash: 50000,
      },
    }))

    const annual = aggregateAnnual(months)

    // Verify metadata reflects 12 months
    expect(annual.metadata.monthCount).toBe(12)
    
    // Verify P&L sums all 12 months
    expect(annual.pl.totalRevenue).toBe(100000 * 12) // 1,200,000
  })

  it('handles all-zero months without errors', () => {
    const months: ThreeWayMonth[] = Array.from({ length: 12 }, () => ({
      pl: {
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        expense: 0,
        depreciation: 0,
        netIncome: 0,
        revenueFromOps: 0,
        otherIncome: 0,
        totalRevenue: 0,
        employeeBenefits: 0,
        financeCosts: 0,
        amortisation: 0,
        otherExpenses: 0,
        totalExpenses: 0,
        profitBeforeExceptional: 0,
        exceptionalItems: 0,
        profitBeforeTax: 0,
        taxExpense: 0,
        profitAfterTax: 0,
      },
      bs: {
        cash: 0,
        ar: 0,
        fixedAssets: 0,
        accDepreciation: 0,
        totalAssets: 0,
        ap: 0,
        debt: 0,
        totalLiabilities: 0,
        equity: 0,
        retainedEarnings: 0,
        totalEquity: 0,
        shareCapital: 0,
        securitiesPremium: 0,
        generalReserve: 0,
        totalShareholdersEquity: 0,
        ltBorrowings: 0,
        stBorrowings: 0,
        otherCurrentLiabilities: 0,
        stProvisions: 0,
        totalNonCurrentLiabilities: 0,
        totalCurrentLiabilities: 0,
        netPPE: 0,
        intangibles: 0,
        accAmortisation: 0,
        netIntangibles: 0,
        inventories: 0,
        tradeReceivables: 0,
        stLoansAdvances: 0,
        otherCurrentAssets: 0,
        totalCurrentAssets: 0,
        totalNonCurrentAssets: 0,
      },
      cf: {
        cashIn: 0,
        cashOut: 0,
        operatingCashFlow: 0,
        investingCashFlow: 0,
        financingCashFlow: 0,
        netCashFlow: 0,
        indirect: {
          netIncome: 0,
          depreciation: 0,
          changeInAR: 0,
          changeInAP: 0,
        },
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
        openingCash: 0,
        closingCash: 0,
      },
    }))

    // Should not throw any errors
    const annual = aggregateAnnual(months)

    // Verify all values are zero
    expect(annual.pl.totalRevenue).toBe(0)
    expect(annual.pl.profitAfterTax).toBe(0)
    expect(annual.bs.cash).toBe(0)
    expect(annual.bs.totalAssets).toBe(0)
    expect(annual.cf.netCashFlow).toBe(0)
    
    // No NaN or Infinity values
    expect(Number.isNaN(annual.pl.totalRevenue)).toBe(false)
    expect(Number.isFinite(annual.pl.totalRevenue)).toBe(true)
  })

  it('throws error for empty months array', () => {
    expect(() => aggregateAnnual([])).toThrow('aggregateAnnual: months array cannot be empty')
  })
})
