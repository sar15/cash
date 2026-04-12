import { describe, expect, it } from 'vitest';
import { generatePeriods } from '../../utils/date-utils';
import { runThreeWayIntegration } from '../three-way/builder';
import { applyComplianceAdjustments } from './apply';
import { calculateAdvanceTaxForecast } from './advance-tax';
import { assertThreeWayBalances, lakh } from './test-helpers';

describe('Advance tax compliance engine', () => {
  it('creates the standard 15/45/75/100 quarterly payment schedule and books it as a balance-sheet asset', () => {
    const periods = generatePeriods(new Date(2025, 3, 1), 12);
    const openingCash = lakh(120);

    const advanceTax = calculateAdvanceTaxForecast({
      periods,
      projectedProfitBeforeTax: new Array(periods.length).fill(lakh(4)),
      taxRatePct: 25,
    });

    expect(advanceTax.annualProjectedProfitBeforeTax).toBe(lakh(48));
    expect(advanceTax.annualEstimatedTax).toBe(lakh(12));
    expect(advanceTax.installments.map((item) => item.dueDate)).toEqual([
      '2025-06-15',
      '2025-09-15',
      '2025-12-15',
      '2026-03-15',
    ]);
    expect(advanceTax.installments.map((item) => item.installmentAmount)).toEqual([
      lakh(1.8),
      lakh(3.6),
      lakh(3.6),
      lakh(3),
    ]);

    const base = runThreeWayIntegration(
      {
        cash: openingCash,
        ar: 0,
        ap: 0,
        equity: openingCash,
        retainedEarnings: 0,
      },
      periods.map(() => ({
        revenue: lakh(18),
        cashIn: lakh(18),
        cogs: lakh(8),
        cogsPaid: lakh(8),
        expense: lakh(6),
        expensePaid: lakh(6),
      }))
    );

    const withCompliance = applyComplianceAdjustments({
      periods,
      baseMonths: base,
      adjustments: advanceTax.adjustments,
    });

    expect(withCompliance[2].cf.advanceTaxPaid).toBe(lakh(1.8));
    expect(withCompliance[2].bs.advanceTaxPaid).toBe(lakh(1.8));
    expect(withCompliance[5].bs.advanceTaxPaid).toBe(lakh(5.4));
    expect(withCompliance[8].bs.advanceTaxPaid).toBe(lakh(9));
    expect(withCompliance[11].bs.advanceTaxPaid).toBe(lakh(12));

    assertThreeWayBalances(withCompliance, openingCash);
  });
});
