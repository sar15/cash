import { describe, it, expect } from 'vitest';
import { generateNewHireMicroForecast } from './new-hire';
import { overlayMicroForecast } from '../overlay';
import { runThreeWayIntegration, MonthlyInput, OpeningBalances } from '../../three-way/builder';

const LAKH = 10_000_000;

describe('New Hire Wizard Engine', () => {
  it('Should correctly split cash timing across net salary and statutory payments resulting in AP liability', () => {
    // Inputs for New Hire
    const inputs = {
      role: 'Senior Developer',
      monthlyCTC: 1 * LAKH,   // 1 Lakh CTC (Expense)
      startMonth: 'Aug-25',
      // We'll hardcode statutory deductions or calculate it
      // Let's assume net salary paid in same month (80k), statutory paid in next month (20k)
      netSalaryPct: 0.8,
      statutoryPct: 0.2, 
    };

    const forecastMonths = [
      "Apr-25", "May-25", "Jun-25", "Jul-25", "Aug-25", "Sep-25",
      "Oct-25", "Nov-25", "Dec-25", "Jan-26", "Feb-26", "Mar-26"
    ];

    const result = generateNewHireMicroForecast('mf-hire-1', inputs, forecastMonths);

    expect(result.lines.length).toBe(1);
    const line = result.lines[0];
    
    // Check Aug-25 (index 4)
    expect(line.plImpacts[4]).toBe(1 * LAKH); // Full expense in P&L
    expect(line.cashImpacts[4]).toBe(0.8 * LAKH); // Only net salary paid out

    // Check Sep-25 (index 5)
    expect(line.plImpacts[5]).toBe(1 * LAKH);
    // Net salary for Sep (0.8) + Statutory for Aug (0.2)
    expect(line.cashImpacts[5]).toBe(1 * LAKH); 

    // Let's overlay this and verify three-way balance!
    const baselineInputs: MonthlyInput[] = Array(12).fill(null).map(() => ({
      revenue: 0,
      cashIn: 0,
      cogs: 0,
      cogsPaid: 0,
      expense: 0,
      expensePaid: 0
    }));

    const combinedInputs = overlayMicroForecast(baselineInputs, result);
    
    const opening: OpeningBalances = {
      cash: 20 * LAKH,
      ar: 0,
      ap: 0,  // Accounts Payable
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
        expect(res.pl.expense).toBe(0);
        expect(res.bs.ap).toBe(0); // No liability before hire
      } else if (m === 4) { // Aug-25
        expect(res.pl.expense).toBe(1 * LAKH);
        expect(res.cf.operatingCashFlow).toBe(-0.8 * LAKH);
        expect(res.bs.cash).toBe(opening.cash - 0.8 * LAKH);
        // AP should increase by 0.2 Lakh because expense (1L) > expensePaid (0.8L)
        expect(res.bs.ap).toBe(0.2 * LAKH); 
      } else { // Sep-25 onwards
        expect(res.pl.expense).toBe(1 * LAKH);
        expect(res.cf.operatingCashFlow).toBe(-1 * LAKH);
        // AP holds steady at 0.2 Lakh because every month generates 0.2 new liability,
        // but pays off 0.2 from previous month
        expect(res.bs.ap).toBe(0.2 * LAKH);
      }
    });
  });
});
