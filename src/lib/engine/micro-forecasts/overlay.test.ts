import { describe, it, expect } from 'vitest';
import { overlayMicroForecast, MicroForecast } from './overlay';
import { runThreeWayIntegration, MonthlyInput, OpeningBalances } from '../three-way/builder';

const LAKH = 10_000_000;

describe('Micro-Forecast Overlay Engine', () => {
  it('Add ₹1,00,000 to Salaries every month starting Aug-25', () => {
    // forecastMonths length: 12
    // Let's assume indices map to: 0=Apr-25, 1=May, 2=Jun, 3=Jul, 4=Aug-25
    const baselineInputs: MonthlyInput[] = Array(12).fill(null).map(() => ({
      revenue: 0,
      cashIn: 0,
      cogs: 0,
      cogsPaid: 0,
      expense: 5 * LAKH,
      expensePaid: 5 * LAKH
    }));

    const plImpacts = Array(12).fill(0);
    const cashImpacts = Array(12).fill(0);
    for (let m = 4; m < 12; m++) {
      // Add 1L to expense for Aug-25 onwards
      plImpacts[m] = 1 * LAKH;
      cashImpacts[m] = 1 * LAKH;
    }

    const microForecast: MicroForecast = {
      id: 'mf-salary',
      name: 'Add Salaries',
      lines: [
        {
          category: 'Operating Expenses',
          plImpacts,
          cashImpacts
        }
      ]
    };

    const combinedInputs = overlayMicroForecast(baselineInputs, microForecast);

    // Verify P&L and CF Inputs properly overlaid
    expect(combinedInputs[3].expense).toBe(5 * LAKH); // Jul-25 baseline unmodified
    expect(combinedInputs[4].expense).toBe(6 * LAKH); // Aug-25 modified

    // Run cascade
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

    const baselineResult = runThreeWayIntegration(opening, baselineInputs);
    const combinedResult = runThreeWayIntegration(opening, combinedInputs);

    // Verify conditions on the combined result
    combinedResult.forEach((res, m) => {
      // Strict three-way balance: assets === liabilities + equity
      const diff = Math.abs(res.bs.totalAssets - (res.bs.totalLiabilities + res.bs.totalEquity));
      expect(diff).toBeLessThanOrEqual(1); // within 1 paise tolerance
      
      // Verify P&L tie to Net Income difference
      expect(res.pl.netIncome).toBe(res.pl.grossProfit - res.pl.expense);

      if (m >= 4) {
        // P&L: Salaries increase by 1L
        expect(res.pl.expense).toBe(baselineResult[m].pl.expense + 1 * LAKH);
        
        // CF: Operating CF decreases correspondingly by 1L each month
        expect(res.cf.operatingCashFlow).toBe(baselineResult[m].cf.operatingCashFlow - 1 * LAKH);
      }
    });

    // BS: Cumulative Cash decreases by exactly 1L * number of months active
    // At Aug-25 (m=4), exactly 1L has been decreased from cash
    expect(combinedResult[4].bs.cash).toBe(baselineResult[4].bs.cash - 1 * LAKH);

    // At Mar-26 (m=11), 8 months of 1L decrease = 8L less cumulative cash
    expect(combinedResult[11].bs.cash).toBe(baselineResult[11].bs.cash - 8 * LAKH);
  });
});
