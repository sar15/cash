// validator.ts

export interface BalanceValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface StatementData {
  pl?: {
    revenues: number;
    cogs: number;
    expenses: number;
    netProfit: number; // Raw file's net profit
  };
  bs?: {
    assets: number;
    liabilities: number;
    equity: number;
    retainedEarnings: number; // For diff check
  };
  openingRetainedEarnings?: number;
}

export function validateHistoricalStatement(data: StatementData, periodName: string = 'Current'): BalanceValidationResult {
  const errors: string[] = [];

  // P&L Validation
  if (data.pl) {
    const calculatedNetProfit = data.pl.revenues - data.pl.cogs - data.pl.expenses;
    // Allow small arithmetic tolerance due to potential rounding in source file
    if (Math.abs(calculatedNetProfit - data.pl.netProfit) > 100) {
      errors.push(`[${periodName}] P&L does not balance: Calculated Net Profit (${calculatedNetProfit}) != Stated Net Profit (${data.pl.netProfit})`);
    }
  }

  // BS Validation
  if (data.bs) {
    const lPlusE = data.bs.liabilities + data.bs.equity;
    if (Math.abs(data.bs.assets - lPlusE) > 100) {
      errors.push(`[${periodName}] Balance Sheet does not balance: Assets (${data.bs.assets}) != Liabilities + Equity (${lPlusE})`);
    }

    if (data.pl && data.openingRetainedEarnings !== undefined) {
      const calculatedRE = data.openingRetainedEarnings + data.pl.netProfit;
      if (Math.abs(data.bs.retainedEarnings - calculatedRE) > 100) {
         errors.push(`[${periodName}] Retained Earnings mismatch: Opening RE (${data.openingRetainedEarnings}) + Net Profit (${data.pl.netProfit}) != Closing RE (${data.bs.retainedEarnings})`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
