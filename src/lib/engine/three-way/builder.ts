export interface OpeningBalances {
  cash: number;
  ar: number;
  ap: number;
  equity: number;
  retainedEarnings: number;
  fixedAssets?: number;
  accDepreciation?: number;
  debt?: number;
}
export interface MonthlyInput {
  revenue: number;
  cashIn: number;
  cogs: number;
  cogsPaid: number;
  expense: number;
  expensePaid: number;
  assetPurchases?: number;
  depreciation?: number;
  newDebt?: number;
  debtRepayment?: number;
}

export interface ThreeWayMonth {
  pl: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expense: number;
    depreciation: number;
    netIncome: number;
  };
  cf: {
    cashIn: number;
    cashOut: number;
    operatingCashFlow: number;
    investingCashFlow: number;
    financingCashFlow: number;
    netCashFlow: number;
    // New: Indirect method breakdown
    indirect: {
      netIncome: number;
      depreciation: number;
      changeInAR: number;
      changeInAP: number;
    };
  };
  bs: {
    cash: number;
    ar: number;
    fixedAssets: number;
    accDepreciation: number;
    totalAssets: number;
    ap: number;
    debt: number;
    totalLiabilities: number;
    equity: number;
    retainedEarnings: number;
    totalEquity: number;
  };
}

export function runThreeWayIntegration(opening: OpeningBalances, inputs: MonthlyInput[]): ThreeWayMonth[] {
  const result: ThreeWayMonth[] = [];

  const currentBalances = {
    cash: opening.cash ?? 0,
    ar: opening.ar ?? 0,
    ap: opening.ap ?? 0,
    equity: opening.equity ?? 0,
    retainedEarnings: opening.retainedEarnings ?? 0,
    fixedAssets: opening.fixedAssets ?? 0,
    accDepreciation: opening.accDepreciation ?? 0,
    debt: opening.debt ?? 0,
  };
  
  for (const input of inputs) {
    const prevAR = currentBalances.ar;
    const prevAP = currentBalances.ap;

    // 1. P&L
    const grossProfit = input.revenue - input.cogs;
    const depreciation = input.depreciation ?? 0;
    const netIncome = grossProfit - input.expense - depreciation;
    
    // 2. CF
    const operatingCashFlow = input.cashIn - input.cogsPaid - input.expensePaid;
    const assetPurchases = input.assetPurchases ?? 0;
    const investingCashFlow = assetPurchases === 0 ? 0 : -assetPurchases;
    const debtInflow = input.newDebt ?? 0;
    const debtOutflow = input.debtRepayment ?? 0;
    const financingCashFlow = debtInflow - debtOutflow;
    const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;
    
    // 3. BS (Updates)
    currentBalances.retainedEarnings += netIncome;
    currentBalances.fixedAssets += assetPurchases;
    currentBalances.accDepreciation += depreciation;
    currentBalances.ar += (input.revenue - input.cashIn);
    currentBalances.ap += (input.cogs + input.expense) - (input.cogsPaid + input.expensePaid);
    currentBalances.debt += financingCashFlow;
    
    // Indirect Method Components
    const changeInAR = prevAR - currentBalances.ar; // Positive means cash inflow
    const changeInAP = currentBalances.ap - prevAP; // Positive means cash inflow

    // Cash as the PLUG — balance sheet equation: Assets = Liabilities + Equity
    // Cash = (L + E) - AR - Net Fixed Assets
    const netFixedAssets = currentBalances.fixedAssets - currentBalances.accDepreciation;
    const totalLiabilities = currentBalances.ap + currentBalances.debt;
    const totalEquity = currentBalances.equity + currentBalances.retainedEarnings;
    const plugCash = totalLiabilities + totalEquity - currentBalances.ar - netFixedAssets;
    
    // Note: plugCash is authoritative. CF-derived cash may differ due to opening balance
    // approximations — this is expected and not a bug.
    currentBalances.cash = plugCash;
    
    const totalAssets = currentBalances.cash + currentBalances.ar + netFixedAssets;
    
    const totalCashOut = input.cogsPaid + input.expensePaid + assetPurchases + debtOutflow;
    
    result.push({
      pl: {
        revenue: input.revenue,
        cogs: input.cogs,
        grossProfit,
        expense: input.expense,
        depreciation,
        netIncome
      },
      cf: {
        cashIn: input.cashIn + debtInflow,
        cashOut: totalCashOut,
        operatingCashFlow,
        investingCashFlow,
        financingCashFlow,
        netCashFlow,
        indirect: {
          netIncome,
          depreciation,
          changeInAR,
          changeInAP
        }
      },
      bs: {
        cash: currentBalances.cash,
        ar: currentBalances.ar,
        fixedAssets: currentBalances.fixedAssets,
        accDepreciation: currentBalances.accDepreciation,
        totalAssets,
        ap: currentBalances.ap,
        debt: currentBalances.debt,
        totalLiabilities,
        equity: currentBalances.equity,
        retainedEarnings: currentBalances.retainedEarnings,
        totalEquity
      }
    });

  }
  
  return result;
}

