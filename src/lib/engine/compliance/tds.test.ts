import { describe, expect, it } from 'vitest';
import { generatePeriods } from '../../utils/date-utils';
import { runThreeWayIntegration } from '../three-way/builder';
import { applyComplianceAdjustments } from './apply';
import { calculateSalaryTDSForecast } from './tds';
import { assertThreeWayBalances, lakh, rupees } from './test-helpers';

describe('TDS compliance engine', () => {
  it('calculates salary TDS under the AY 2026-27 new regime and deposits it on the 7th of the following month', () => {
    const periods = generatePeriods(new Date(2025, 3, 1), 12);
    const openingCash = lakh(80);
    const monthlyGrossSalary = rupees(150_000);

    const tds = calculateSalaryTDSForecast({
      periods,
      projectedGrossSalaries: new Array(periods.length).fill(monthlyGrossSalary),
    });

    expect(tds.annualGrossSalary).toBe(rupees(1_800_000));
    expect(tds.taxableIncome).toBe(rupees(1_725_000));
    expect(tds.annualTax).toBe(rupees(150_800));
    expect(tds.months[0].dueDate).toBe('2025-05-07');
    expect(tds.months.reduce((sum, month) => sum + month.salaryTDS, 0)).toBe(rupees(150_800));
    expect(
      Math.max(...tds.months.map((month) => month.salaryTDS)) -
        Math.min(...tds.months.map((month) => month.salaryTDS))
    ).toBeLessThanOrEqual(1);

    const base = runThreeWayIntegration(
      {
        cash: openingCash,
        ar: 0,
        ap: 0,
        equity: openingCash,
        retainedEarnings: 0,
      },
      periods.map((_, index) => ({
        revenue: lakh(25),
        cashIn: lakh(25),
        cogs: lakh(8),
        cogsPaid: lakh(8),
        expense: monthlyGrossSalary,
        expensePaid: monthlyGrossSalary - tds.months[index].salaryTDS,
      }))
    );

    const withCompliance = applyComplianceAdjustments({
      periods,
      baseMonths: base,
      adjustments: tds.adjustments,
    });

    expect(withCompliance[0].bs.ap).toBe(0);
    expect(withCompliance[0].bs.tdsPayable).toBe(tds.months[0].salaryTDS);
    expect(withCompliance[1].cf.tdsPaid).toBe(tds.months[0].salaryTDS);
    expect(withCompliance[1].bs.tdsPayable).toBe(tds.months[1].salaryTDS);

    assertThreeWayBalances(withCompliance, openingCash);
  });
});
