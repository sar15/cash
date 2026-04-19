/**
 * Annual Aggregation Engine
 * 
 * Aggregates 12 monthly ThreeWayMonth results into a single AnnualStatement.
 * 
 * Key rules:
 * - P&L: Sum all flow fields across 12 months
 * - Balance Sheet: Take last month's closing balances (point-in-time)
 * - Cash Flow: Sum all flow fields across 12 months
 */

import type { ThreeWayMonth } from '../engine/three-way/builder'

/**
 * Annual statement structure matching Schedule III format
 */
export interface AnnualStatement {
  pl: {
    // Schedule III P&L fields (all flows - summed)
    revenueFromOps: number
    otherIncome: number
    totalRevenue: number
    cogs: number
    employeeBenefits: number
    financeCosts: number
    depreciation: number
    amortisation: number
    otherExpenses: number
    totalExpenses: number
    profitBeforeExceptional: number
    exceptionalItems: number
    profitBeforeTax: number
    taxExpense: number
    profitAfterTax: number
    
    // Legacy fields for backward compatibility
    revenue: number
    grossProfit: number
    expense: number
    netIncome: number
  }
  
  bs: {
    // Schedule III Balance Sheet fields (point-in-time - last month)
    // Equity & Liabilities
    shareCapital: number
    securitiesPremium: number
    generalReserve: number
    retainedEarnings: number
    totalShareholdersEquity: number
    
    ltBorrowings: number
    stBorrowings: number
    otherCurrentLiabilities: number
    stProvisions: number
    totalNonCurrentLiabilities: number
    totalCurrentLiabilities: number
    
    // Assets
    cash: number
    tradeReceivables: number
    netPPE: number
    intangibles: number
    accAmortisation: number
    netIntangibles: number
    inventories: number
    stLoansAdvances: number
    otherCurrentAssets: number
    totalCurrentAssets: number
    totalNonCurrentAssets: number
    totalAssets: number
    
    // Legacy fields for backward compatibility
    ar: number
    fixedAssets: number
    accDepreciation: number
    ap: number
    debt: number
    totalLiabilities: number
    equity: number
    totalEquity: number
  }
  
  cf: {
    // AS 3 Cash Flow fields (all flows - summed)
    // Operating Activities (Indirect Method)
    operatingIndirect: {
      profitBeforeTax: number
      addDepreciation: number
      addAmortisation: number
      addFinanceCosts: number
      lessOtherIncome: number
      changeInInventories: number
      changeInTradeReceivables: number
      changeInSTLoansAdvances: number
      changeInOtherCurrentAssets: number
      changeInTradePayables: number
      changeInOtherCurrentLiabilities: number
      changeInSTProvisions: number
      cashFromOperations: number
      lessIncomeTaxPaid: number
    }
    netOperatingCF: number
    
    // Investing Activities
    purchaseOfPPE: number
    purchaseOfIntangibles: number
    proceedsFromAssetSale: number
    netInvestingCF: number
    
    // Financing Activities
    proceedsFromBorrowings: number
    repaymentOfBorrowings: number
    financeCostsPaid: number
    dividendsPaid: number
    proceedsFromShareIssue: number
    netFinancingCF: number
    
    // Net cash flow
    netCashFlow: number
    openingCash: number
    closingCash: number
    
    // Legacy fields for backward compatibility
    cashIn: number
    cashOut: number
    operatingCashFlow: number
    investingCashFlow: number
    financingCashFlow: number
    indirect: {
      netIncome: number
      depreciation: number
      changeInAR: number
      changeInAP: number
    }
  }
  
  metadata: {
    monthCount: number
    periodLabel: string
  }
}

/**
 * Aggregate 12 monthly ThreeWayMonth results into an annual statement.
 * 
 * Algorithm:
 * 1. P&L: Sum all flow fields across all months
 * 2. Balance Sheet: Take the last month's closing balances
 * 3. Cash Flow: Sum all flow fields across all months
 * 
 * @param months - Array of ThreeWayMonth objects (typically 12 months)
 * @returns AnnualStatement with aggregated P&L, BS, and CF
 * 
 * @example
 * const annual = aggregateAnnual(months)
 * console.log(annual.pl.profitAfterTax) // Sum of 12 months PAT
 * console.log(annual.bs.cash) // Last month's closing cash
 */
export function aggregateAnnual(months: ThreeWayMonth[]): AnnualStatement {
  // Validate input
  if (!months || months.length === 0) {
    throw new Error('aggregateAnnual: months array cannot be empty')
  }
  
  // Get last month for Balance Sheet point-in-time values
  const lastMonth = months[months.length - 1]
  
  // Initialize accumulators for P&L (sum all months)
  let plRevenueFromOps = 0
  let plOtherIncome = 0
  let plTotalRevenue = 0
  let plCogs = 0
  let plEmployeeBenefits = 0
  let plFinanceCosts = 0
  let plDepreciation = 0
  let plAmortisation = 0
  let plOtherExpenses = 0
  let plTotalExpenses = 0
  let plProfitBeforeExceptional = 0
  let plExceptionalItems = 0
  let plProfitBeforeTax = 0
  let plTaxExpense = 0
  let plProfitAfterTax = 0
  let plRevenue = 0
  let plGrossProfit = 0
  let plExpense = 0
  let plNetIncome = 0
  
  // Initialize accumulators for Cash Flow (sum all months)
  let cfProfitBeforeTax = 0
  let cfAddDepreciation = 0
  let cfAddAmortisation = 0
  let cfAddFinanceCosts = 0
  let cfLessOtherIncome = 0
  let cfChangeInInventories = 0
  let cfChangeInTradeReceivables = 0
  let cfChangeInSTLoansAdvances = 0
  let cfChangeInOtherCurrentAssets = 0
  let cfChangeInTradePayables = 0
  let cfChangeInOtherCurrentLiabilities = 0
  let cfChangeInSTProvisions = 0
  let cfCashFromOperations = 0
  let cfLessIncomeTaxPaid = 0
  let cfNetOperatingCF = 0
  let cfPurchaseOfPPE = 0
  let cfPurchaseOfIntangibles = 0
  let cfProceedsFromAssetSale = 0
  let cfNetInvestingCF = 0
  let cfProceedsFromBorrowings = 0
  let cfRepaymentOfBorrowings = 0
  let cfFinanceCostsPaid = 0
  let cfDividendsPaid = 0
  let cfProceedsFromShareIssue = 0
  let cfNetFinancingCF = 0
  let cfNetCashFlow = 0
  let cfCashIn = 0
  let cfCashOut = 0
  let cfOperatingCashFlow = 0
  let cfInvestingCashFlow = 0
  let cfFinancingCashFlow = 0
  let cfIndirectNetIncome = 0
  let cfIndirectDepreciation = 0
  let cfIndirectChangeInAR = 0
  let cfIndirectChangeInAP = 0
  
  // Sum all flow fields across all months
  for (const month of months) {
    // P&L flows
    plRevenueFromOps += month.pl.revenueFromOps ?? 0
    plOtherIncome += month.pl.otherIncome ?? 0
    plTotalRevenue += month.pl.totalRevenue ?? 0
    plCogs += month.pl.cogs ?? 0
    plEmployeeBenefits += month.pl.employeeBenefits ?? 0
    plFinanceCosts += month.pl.financeCosts ?? 0
    plDepreciation += month.pl.depreciation ?? 0
    plAmortisation += month.pl.amortisation ?? 0
    plOtherExpenses += month.pl.otherExpenses ?? 0
    plTotalExpenses += month.pl.totalExpenses ?? 0
    plProfitBeforeExceptional += month.pl.profitBeforeExceptional ?? 0
    plExceptionalItems += month.pl.exceptionalItems ?? 0
    plProfitBeforeTax += month.pl.profitBeforeTax ?? 0
    plTaxExpense += month.pl.taxExpense ?? 0
    plProfitAfterTax += month.pl.profitAfterTax ?? 0
    plRevenue += month.pl.revenue ?? 0
    plGrossProfit += month.pl.grossProfit ?? 0
    plExpense += month.pl.expense ?? 0
    plNetIncome += month.pl.netIncome ?? 0
    
    // Cash Flow flows
    cfProfitBeforeTax += month.cf.operatingIndirect.profitBeforeTax ?? 0
    cfAddDepreciation += month.cf.operatingIndirect.addDepreciation ?? 0
    cfAddAmortisation += month.cf.operatingIndirect.addAmortisation ?? 0
    cfAddFinanceCosts += month.cf.operatingIndirect.addFinanceCosts ?? 0
    cfLessOtherIncome += month.cf.operatingIndirect.lessOtherIncome ?? 0
    cfChangeInInventories += month.cf.operatingIndirect.changeInInventories ?? 0
    cfChangeInTradeReceivables += month.cf.operatingIndirect.changeInTradeReceivables ?? 0
    cfChangeInSTLoansAdvances += month.cf.operatingIndirect.changeInSTLoansAdvances ?? 0
    cfChangeInOtherCurrentAssets += month.cf.operatingIndirect.changeInOtherCurrentAssets ?? 0
    cfChangeInTradePayables += month.cf.operatingIndirect.changeInTradePayables ?? 0
    cfChangeInOtherCurrentLiabilities += month.cf.operatingIndirect.changeInOtherCurrentLiabilities ?? 0
    cfChangeInSTProvisions += month.cf.operatingIndirect.changeInSTProvisions ?? 0
    cfCashFromOperations += month.cf.operatingIndirect.cashFromOperations ?? 0
    cfLessIncomeTaxPaid += month.cf.operatingIndirect.lessIncomeTaxPaid ?? 0
    cfNetOperatingCF += month.cf.netOperatingCF ?? 0
    cfPurchaseOfPPE += month.cf.purchaseOfPPE ?? 0
    cfPurchaseOfIntangibles += month.cf.purchaseOfIntangibles ?? 0
    cfProceedsFromAssetSale += month.cf.proceedsFromAssetSale ?? 0
    cfNetInvestingCF += month.cf.netInvestingCF ?? 0
    cfProceedsFromBorrowings += month.cf.proceedsFromBorrowings ?? 0
    cfRepaymentOfBorrowings += month.cf.repaymentOfBorrowings ?? 0
    cfFinanceCostsPaid += month.cf.financeCostsPaid ?? 0
    cfDividendsPaid += month.cf.dividendsPaid ?? 0
    cfProceedsFromShareIssue += month.cf.proceedsFromShareIssue ?? 0
    cfNetFinancingCF += month.cf.netFinancingCF ?? 0
    cfNetCashFlow += month.cf.netCashFlow ?? 0
    cfCashIn += month.cf.cashIn ?? 0
    cfCashOut += month.cf.cashOut ?? 0
    cfOperatingCashFlow += month.cf.operatingCashFlow ?? 0
    cfInvestingCashFlow += month.cf.investingCashFlow ?? 0
    cfFinancingCashFlow += month.cf.financingCashFlow ?? 0
    cfIndirectNetIncome += month.cf.indirect.netIncome ?? 0
    cfIndirectDepreciation += month.cf.indirect.depreciation ?? 0
    cfIndirectChangeInAR += month.cf.indirect.changeInAR ?? 0
    cfIndirectChangeInAP += month.cf.indirect.changeInAP ?? 0
  }
  
  // Opening cash is the first month's opening cash
  const openingCash = months[0]?.cf.openingCash ?? 0
  
  // Closing cash is the last month's closing cash
  const closingCash = lastMonth.cf.closingCash ?? 0
  
  // Build the annual statement
  return {
    pl: {
      revenueFromOps: plRevenueFromOps,
      otherIncome: plOtherIncome,
      totalRevenue: plTotalRevenue,
      cogs: plCogs,
      employeeBenefits: plEmployeeBenefits,
      financeCosts: plFinanceCosts,
      depreciation: plDepreciation,
      amortisation: plAmortisation,
      otherExpenses: plOtherExpenses,
      totalExpenses: plTotalExpenses,
      profitBeforeExceptional: plProfitBeforeExceptional,
      exceptionalItems: plExceptionalItems,
      profitBeforeTax: plProfitBeforeTax,
      taxExpense: plTaxExpense,
      profitAfterTax: plProfitAfterTax,
      revenue: plRevenue,
      grossProfit: plGrossProfit,
      expense: plExpense,
      netIncome: plNetIncome,
    },
    
    bs: {
      // Point-in-time values from last month
      shareCapital: lastMonth.bs.shareCapital ?? 0,
      securitiesPremium: lastMonth.bs.securitiesPremium ?? 0,
      generalReserve: lastMonth.bs.generalReserve ?? 0,
      retainedEarnings: lastMonth.bs.retainedEarnings ?? 0,
      totalShareholdersEquity: lastMonth.bs.totalShareholdersEquity ?? 0,
      
      ltBorrowings: lastMonth.bs.ltBorrowings ?? 0,
      stBorrowings: lastMonth.bs.stBorrowings ?? 0,
      otherCurrentLiabilities: lastMonth.bs.otherCurrentLiabilities ?? 0,
      stProvisions: lastMonth.bs.stProvisions ?? 0,
      totalNonCurrentLiabilities: lastMonth.bs.totalNonCurrentLiabilities ?? 0,
      totalCurrentLiabilities: lastMonth.bs.totalCurrentLiabilities ?? 0,
      
      cash: lastMonth.bs.cash ?? 0,
      tradeReceivables: lastMonth.bs.tradeReceivables ?? 0,
      netPPE: lastMonth.bs.netPPE ?? 0,
      intangibles: lastMonth.bs.intangibles ?? 0,
      accAmortisation: lastMonth.bs.accAmortisation ?? 0,
      netIntangibles: lastMonth.bs.netIntangibles ?? 0,
      inventories: lastMonth.bs.inventories ?? 0,
      stLoansAdvances: lastMonth.bs.stLoansAdvances ?? 0,
      otherCurrentAssets: lastMonth.bs.otherCurrentAssets ?? 0,
      totalCurrentAssets: lastMonth.bs.totalCurrentAssets ?? 0,
      totalNonCurrentAssets: lastMonth.bs.totalNonCurrentAssets ?? 0,
      totalAssets: lastMonth.bs.totalAssets ?? 0,
      
      // Legacy fields
      ar: lastMonth.bs.ar ?? 0,
      fixedAssets: lastMonth.bs.fixedAssets ?? 0,
      accDepreciation: lastMonth.bs.accDepreciation ?? 0,
      ap: lastMonth.bs.ap ?? 0,
      debt: lastMonth.bs.debt ?? 0,
      totalLiabilities: lastMonth.bs.totalLiabilities ?? 0,
      equity: lastMonth.bs.equity ?? 0,
      totalEquity: lastMonth.bs.totalEquity ?? 0,
    },
    
    cf: {
      operatingIndirect: {
        profitBeforeTax: cfProfitBeforeTax,
        addDepreciation: cfAddDepreciation,
        addAmortisation: cfAddAmortisation,
        addFinanceCosts: cfAddFinanceCosts,
        lessOtherIncome: cfLessOtherIncome,
        changeInInventories: cfChangeInInventories,
        changeInTradeReceivables: cfChangeInTradeReceivables,
        changeInSTLoansAdvances: cfChangeInSTLoansAdvances,
        changeInOtherCurrentAssets: cfChangeInOtherCurrentAssets,
        changeInTradePayables: cfChangeInTradePayables,
        changeInOtherCurrentLiabilities: cfChangeInOtherCurrentLiabilities,
        changeInSTProvisions: cfChangeInSTProvisions,
        cashFromOperations: cfCashFromOperations,
        lessIncomeTaxPaid: cfLessIncomeTaxPaid,
      },
      netOperatingCF: cfNetOperatingCF,
      
      purchaseOfPPE: cfPurchaseOfPPE,
      purchaseOfIntangibles: cfPurchaseOfIntangibles,
      proceedsFromAssetSale: cfProceedsFromAssetSale,
      netInvestingCF: cfNetInvestingCF,
      
      proceedsFromBorrowings: cfProceedsFromBorrowings,
      repaymentOfBorrowings: cfRepaymentOfBorrowings,
      financeCostsPaid: cfFinanceCostsPaid,
      dividendsPaid: cfDividendsPaid,
      proceedsFromShareIssue: cfProceedsFromShareIssue,
      netFinancingCF: cfNetFinancingCF,
      
      netCashFlow: cfNetCashFlow,
      openingCash: openingCash,
      closingCash: closingCash,
      
      // Legacy fields
      cashIn: cfCashIn,
      cashOut: cfCashOut,
      operatingCashFlow: cfOperatingCashFlow,
      investingCashFlow: cfInvestingCashFlow,
      financingCashFlow: cfFinancingCashFlow,
      indirect: {
        netIncome: cfIndirectNetIncome,
        depreciation: cfIndirectDepreciation,
        changeInAR: cfIndirectChangeInAR,
        changeInAP: cfIndirectChangeInAP,
      },
    },
    
    metadata: {
      monthCount: months.length,
      periodLabel: '', // Will be set by caller using generatePeriodKey()
    },
  }
}
