import { describe, it, expect } from 'vitest';
import { generateAssetMicroForecast } from './asset';
import { overlayMicroForecast } from '../overlay';
import { runThreeWayIntegration, MonthlyInput, OpeningBalances } from '../../three-way/builder';

const LAKH = 10_000_000;

describe('Asset Purchase Wizard Engine', () => {
  it('Should add fixed asset, depreciation starting NEXT month, and capex', () => {
    const inputs = {
      assetName: 'CNC Machine',
      purchaseAmount: 12 * LAKH,
      purchaseMonth: 'Aug-25',
      usefulLifeMonths: 12,
      salvageValue: 0
    };

    const forecastMonths = [
      "Apr-25", "May-25", "Jun-25", "Jul-25", "Aug-25", "Sep-25",
      "Oct-25", "Nov-25", "Dec-25", "Jan-26", "Feb-26", "Mar-26"
    ];

    const result = generateAssetMicroForecast('mf-asset-1', inputs, forecastMonths);

    expect(result.lines.length).toBe(1);
    const line = result.lines[0];

    // Check Capex (purchaseMonth = index 4 = Aug-25)
    expect(line.cashImpacts[4]).toBe(12 * LAKH); // Investing Cash Outflow

    // FIX audit3 M3: Depreciation now starts the month AFTER purchase
    // Purchase month (index 4) should have 0 depreciation
    expect(line.plImpacts[4]).toBe(0);
    // First depreciation month (index 5 = Sep-25)
    expect(line.plImpacts[5]).toBe(1 * LAKH);
    // Last month in forecast (index 11 = Mar-26)
    expect(line.plImpacts[11]).toBe(1 * LAKH);
    // Months before purchase should have 0
    expect(line.plImpacts[3]).toBe(0);

    const baselineInputs: MonthlyInput[] = Array(12).fill(null).map(() => ({
      revenue: 0,
      cashIn: 0,
      cogs: 0,
      cogsPaid: 0,
      expense: 0,
      expensePaid: 0,
      assetPurchases: 0,
      depreciation: 0
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
      // Three-way balance must hold
      const diff = Math.abs(res.bs.totalAssets - (res.bs.totalLiabilities + res.bs.totalEquity));
      expect(diff).toBeLessThanOrEqual(1);

      if (m < 4) {
        // Before purchase
        expect(res.bs.fixedAssets).toBe(0);
        expect(res.bs.accDepreciation).toBe(0);
      } else if (m === 4) {
        // Purchase month — asset capitalized, NO depreciation yet
        expect(res.bs.fixedAssets).toBe(12 * LAKH);
        expect(res.bs.accDepreciation).toBe(0);
        expect(res.cf.investingCashFlow).toBe(-12 * LAKH);
      } else {
        // Months after purchase — depreciation accumulates (starts m=5)
        expect(res.bs.fixedAssets).toBe(12 * LAKH);
        const monthsDepreciated = m - 5 + 1; // starts at index 5
        expect(res.bs.accDepreciation).toBe(monthsDepreciated * 1 * LAKH);
        expect(res.pl.netIncome).toBe(-1 * LAKH);
        expect(res.cf.investingCashFlow).toBe(0);
      }
    });
  });
});
