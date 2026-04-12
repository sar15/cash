import { describe, expect, it } from 'vitest';
import { generatePeriods } from '../../utils/date-utils';
import { runThreeWayIntegration } from '../three-way/builder';
import { applyComplianceAdjustments } from './apply';
import { calculatePFESIForecast } from './pf-esi';
import { assertThreeWayBalances, lakh, rupees } from './test-helpers';

describe('PF/ESI compliance engine', () => {
  it('accrues employer PF and ESI, reclassifies withheld employee ESI, and pays the dues in the following month', () => {
    const periods = generatePeriods(new Date(2025, 3, 1), 3);
    const openingCash = lakh(15);

    const payroll = calculatePFESIForecast({
      periods,
      projectedGrossSalaries: [rupees(20_000), rupees(20_000), rupees(20_000)],
      basicSalaryPct: 50,
    });

    expect(payroll.months[0].employerPF).toBe(rupees(1_200));
    expect(payroll.months[0].employerESI).toBe(rupees(650));
    expect(payroll.months[0].employeeESI).toBe(rupees(150));
    expect(payroll.months[0].dueDate).toBe('2025-05-15');

    const base = runThreeWayIntegration(
      {
        cash: openingCash,
        ar: 0,
        ap: 0,
        equity: openingCash,
        retainedEarnings: 0,
      },
      payroll.months.map((month) => ({
        revenue: lakh(4),
        cashIn: lakh(4),
        cogs: lakh(1.5),
        cogsPaid: lakh(1.5),
        expense: month.grossSalary,
        expensePaid: month.grossSalary - month.employeeESI,
      }))
    );

    const withCompliance = applyComplianceAdjustments({
      periods,
      baseMonths: base,
      adjustments: payroll.adjustments,
    });

    expect(withCompliance[0].bs.ap).toBe(0);
    expect(withCompliance[0].bs.pfPayable).toBe(rupees(1_200));
    expect(withCompliance[0].bs.esiPayable).toBe(rupees(800));
    expect(withCompliance[0].pl.expense).toBe(rupees(21_850));
    expect(withCompliance[1].cf.pfPaid).toBe(rupees(1_200));
    expect(withCompliance[1].cf.esiPaid).toBe(rupees(800));

    assertThreeWayBalances(withCompliance, openingCash);
  });

  it('skips ESI above the Rs. 21,000 monthly threshold while still accruing employer PF', () => {
    const periods = generatePeriods(new Date(2025, 3, 1), 2);
    const openingCash = lakh(10);

    const payroll = calculatePFESIForecast({
      periods,
      projectedGrossSalaries: [rupees(25_000), rupees(25_000)],
      basicSalaryPct: 50,
    });

    expect(payroll.months[0].employerPF).toBe(rupees(1_500));
    expect(payroll.months[0].employerESI).toBe(0);
    expect(payroll.months[0].employeeESI).toBe(0);

    const base = runThreeWayIntegration(
      {
        cash: openingCash,
        ar: 0,
        ap: 0,
        equity: openingCash,
        retainedEarnings: 0,
      },
      payroll.months.map((month) => ({
        revenue: lakh(3),
        cashIn: lakh(3),
        cogs: lakh(1),
        cogsPaid: lakh(1),
        expense: month.grossSalary,
        expensePaid: month.grossSalary,
      }))
    );

    const withCompliance = applyComplianceAdjustments({
      periods,
      baseMonths: base,
      adjustments: payroll.adjustments,
    });

    expect(withCompliance[0].bs.pfPayable).toBe(rupees(1_500));
    expect(withCompliance[0].bs.esiPayable).toBe(0);
    expect(withCompliance[0].pl.expense).toBe(rupees(26_500));

    assertThreeWayBalances(withCompliance, openingCash);
  });
});
