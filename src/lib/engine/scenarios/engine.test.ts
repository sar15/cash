import { describe, expect, it } from 'vitest';
import { demoData, forecastMonths, demoValueRules, demoTimingProfiles } from '../../demo-data';
import { generateRevenueMicroForecast } from '../micro-forecasts/wizards/revenue';
import { runScenarioForecastEngine } from './engine';
import type { ScenarioDefinition } from './types';

// Common engine options using demo data
const baseOptions = {
  accounts: demoData,
  forecastMonthLabels: forecastMonths,
  valueRules: demoValueRules,
  timingProfiles: demoTimingProfiles,
};

function assertBalanced(
  months: Array<{
    bs: { cash: number; totalAssets: number; totalLiabilities: number; totalEquity: number };
    cf: { netCashFlow: number };
  }>
) {
  const openingCash =
    demoData.find((account) => account.id === 'ast-1')?.historicalValues.at(-1) ?? 0;
  let runningCash = openingCash;

  months.forEach((month) => {
    runningCash += month.cf.netCashFlow;
    expect(Math.abs(month.bs.cash - runningCash)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(month.bs.totalAssets - (month.bs.totalLiabilities + month.bs.totalEquity))
    ).toBeLessThanOrEqual(1);
  });
}

describe('Scenario engine', () => {
  it('applies baseline adjustment overrides and preserves three-way balance', () => {
    const baseline = runScenarioForecastEngine(baseOptions);
    const pessimistic: ScenarioDefinition = {
      id: 'scenario-pessimistic',
      name: 'Pessimistic',
      baselineAdjustments: [{ accountId: 'rev-1', adjustmentPct: -15 }],
      timingProfileOverrides: [],
      microForecastToggles: [],
    };

    const result = runScenarioForecastEngine({ ...baseOptions, scenario: pessimistic });

    expect(result.accountForecasts['rev-1'][0]).toBe(
      Math.round((baseline.accountForecasts['rev-1'][0] * 85) / 100)
    );
    expect(result.integrationResults[0].pl.revenue).toBeLessThan(
      baseline.integrationResults[0].pl.revenue
    );
    expect(result.integrationResults.at(-1)?.bs.cash ?? 0).toBeLessThan(
      baseline.integrationResults.at(-1)?.bs.cash ?? 0
    );

    assertBalanced(result.integrationResults);
  });

  it('applies timing profile overrides to slow collections while keeping the model balanced', () => {
    const baseline = runScenarioForecastEngine(baseOptions);
    const delayedCollections: ScenarioDefinition = {
      id: 'scenario-delay',
      name: 'Delayed collections',
      baselineAdjustments: [],
      timingProfileOverrides: [
        {
          accountId: 'rev-1',
          profile: {
            type: 'receivables',
            accountId: 'rev-1',
            month_0: 0.25,
            month_1: 0.5,
            month_2: 0.25,
          },
        },
      ],
      microForecastToggles: [],
    };

    const result = runScenarioForecastEngine({ ...baseOptions, scenario: delayedCollections });

    expect(result.integrationResults[0].cf.cashIn).toBeLessThan(
      baseline.integrationResults[0].cf.cashIn
    );
    expect(result.integrationResults[0].bs.ar).toBeGreaterThan(
      baseline.integrationResults[0].bs.ar
    );

    assertBalanced(result.integrationResults);
  });

  it('supports micro-forecast toggles and falls back to the base forecast when disabled', () => {
    const baseline = runScenarioForecastEngine(baseOptions);
    const growthPush = {
      id: 'mf-growth-push',
      type: 'revenue' as const,
      isActive: true,
      microForecast: generateRevenueMicroForecast(
        'mf-growth-push',
        {
          clientName: 'Anchor Client',
          monthlyAmount: 8_000_000,
          startMonth: forecastMonths[2],
          gstRate: 18,
        },
        forecastMonths
      ),
    };

    const withMicro = runScenarioForecastEngine({
      ...baseOptions,
      microForecastItems: [growthPush],
    });

    const disabledScenario: ScenarioDefinition = {
      id: 'scenario-disable-micro',
      name: 'Disable growth push',
      baselineAdjustments: [],
      timingProfileOverrides: [],
      microForecastToggles: [{ microForecastId: growthPush.id, isActive: false }],
    };

    const disabled = runScenarioForecastEngine({
      ...baseOptions,
      scenario: disabledScenario,
      microForecastItems: [growthPush],
    });

    expect(withMicro.integrationResults[2].pl.revenue).toBeGreaterThan(
      baseline.integrationResults[2].pl.revenue
    );
    expect(disabled.integrationResults[2].pl.revenue).toBe(
      baseline.integrationResults[2].pl.revenue
    );
    expect(disabled.integrationResults[2].cf.netCashFlow).toBe(
      baseline.integrationResults[2].cf.netCashFlow
    );

    assertBalanced(disabled.integrationResults);
  });
});
