import { describe, expect, it } from 'vitest';
import { generatePeriods } from '../../utils/date-utils';
import { runThreeWayIntegration } from '../three-way/builder';
import { buildComplianceForecast } from './index';
import { assertThreeWayBalances, lakh } from './test-helpers';

describe('Compliance summary builder', () => {
  it('builds due-date events and raises shortfall alerts from the compliance schedule', () => {
    const periods = generatePeriods(new Date(2025, 3, 1), 3);
    const openingCash = lakh(1.5);

    const raw = runThreeWayIntegration(
      {
        cash: openingCash,
        ar: 0,
        ap: 0,
        equity: openingCash,
        retainedEarnings: 0,
      },
      [
        {
          revenue: lakh(10),
          cashIn: lakh(10),
          cogs: lakh(2),
          cogsPaid: lakh(2),
          expense: lakh(7),
          expensePaid: lakh(8.3),
        },
        {
          revenue: lakh(1),
          cashIn: lakh(1),
          cogs: lakh(0.5),
          cogsPaid: lakh(0.5),
          expense: lakh(2.5),
          expensePaid: lakh(2.5),
        },
        {
          revenue: lakh(1),
          cashIn: lakh(1),
          cogs: lakh(0.5),
          cogsPaid: lakh(0.5),
          expense: lakh(0.4),
          expensePaid: lakh(0.4),
        },
      ]
    );

    const compliance = buildComplianceForecast({
      periods,
      rawIntegrationResults: raw,
      accountForecasts: {
        'exp-1': [0, 0, 0],
      },
      salaryForecast: [0, 0, 0],
    });

    expect(compliance.events[0].type).toBe('GST');
    expect(compliance.events[0].dueDate).toBe('2025-05-20');
    expect(compliance.alerts[0].type).toBe('GST');
    expect(compliance.alerts[0].shortfall).toBeGreaterThan(0);

    assertThreeWayBalances(compliance.integrationResults, openingCash);
  });
});
