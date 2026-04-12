import { describe, it, expect } from 'vitest';
import { generateLoanMicroForecast } from './loan';
import { overlayMicroForecast } from '../overlay';
import { runThreeWayIntegration, MonthlyInput, OpeningBalances } from '../../three-way/builder';

const LAKH = 10_000_000;

describe('New Loan Wizard Engine', () => {
  it('Should handle drawdown, principle repayment, and interest expense correctly', () => {
    const inputs = {
      loanName: 'Machinery Loan',
      principalAmount: 12 * LAKH,
      startMonth: 'Aug-25',
      termMonths: 12,
      annualInterestRate: 10, // 10%
    };

    const forecastMonths = [
      "Apr-25", "May-25", "Jun-25", "Jul-25", "Aug-25", "Sep-25",
      "Oct-25", "Nov-25", "Dec-25", "Jan-26", "Feb-26", "Mar-26"
    ];

    const result = generateLoanMicroForecast('mf-loan-1', inputs, forecastMonths);

    expect(result.lines.length).toBe(1);
    const line = result.lines[0];

    // Check August (Drawdown and first month interest/repayment)
    expect(line.cashImpacts[4]).toBe(12 * LAKH - (1 * LAKH)); // Drawdown (+12L) minus 1L principal repayment = +11L net
    
    // Monthly interest for 1M on 12M term
    // Let's see what we calculate in the wizard for interest

    const baselineInputs: MonthlyInput[] = Array(12).fill(null).map(() => ({
      revenue: 0,
      cashIn: 0,
      cogs: 0,
      cogsPaid: 0,
      expense: 0,
      expensePaid: 0,
      assetPurchases: 0,
      depreciation: 0,
      newDebt: 0,
      debtRepayment: 0
    }));

    const combinedInputs = overlayMicroForecast(baselineInputs, result);
    
    const opening: OpeningBalances = {
      cash: 20 * LAKH,
      ar: 0,
      ap: 0,
      equity: 20 * LAKH,
      retainedEarnings: 0,
      fixedAssets: 0,
      accDepreciation: 0,
      debt: 0
    };

    const integratedResult = runThreeWayIntegration(opening, combinedInputs);

    integratedResult.forEach((res, m) => {
      // Three-way balance holds
      const diff = Math.abs(res.bs.totalAssets - (res.bs.totalLiabilities + res.bs.totalEquity));
      expect(diff).toBeLessThanOrEqual(1);

      if (m < 4) {
        expect(res.bs.debt).toBe(0);
      } else {
        // Debt should be declining
        const monthsPassed = m - 4 + 1;
        const remainingDebt = 12 * LAKH - (monthsPassed * 1 * LAKH); // Since repayment is 1L/month
        expect(res.bs.debt).toBe(remainingDebt);

        // Interest should hit P&L
        expect(res.pl.expense).toBeGreaterThan(0);
      }
    });
  });
});
