import { describe, it, expect } from 'vitest';
import { evaluateRollingAvg } from './rolling-avg';
import { RollingAvgConfig, ForecastContext } from './types';

describe('Value Rule: rolling_avg', () => {
  it('calculates normally when sufficient historical data exists', () => {
    const config: RollingAvgConfig = { type: 'rolling_avg', accountId: 'rev-1', lookbackMonths: 3 };
    const context: ForecastContext = {
      historicalValues: [100000, 200000, 300000],
      forecastMonths: 3
    };
    
    const result = evaluateRollingAvg(config, context);
    
    // Average of [100000, 200000, 300000] = 200000
    // Month 1 forecast = 200000
    // The rolling average generally just produces a flat line based on the last N months, OR does it use its own forecasts dynamically?
    // Often, a simple rolling average for forecasting takes the average of the last N historical months and projects that flat line.
    // Let's assume a flat line projection for simplicity, or dynamic. The standard for basic SME forecasting is flat. Let's do flat.
    expect(result).toEqual([200000, 200000, 200000]);
  });

  it('handles edge case: insufficient historical data according to user rules', () => {
    // User Rule: If lookback is 6 but only 3 months exist, average those 3. Never inject a default.
    const config: RollingAvgConfig = { type: 'rolling_avg', accountId: 'rev-1', lookbackMonths: 6 };
    const context: ForecastContext = {
      historicalValues: [100000, 50000, 150000], // Only 3 months
      forecastMonths: 2
    };
    
    const result = evaluateRollingAvg(config, context);
    // Average of 3 is 100000
    expect(result).toEqual([100000, 100000]);
  });

  it('handles edge case: zero historical data', () => {
    // User Rule: If zero historical months exist for an account, return 0 for all forecast months.
    const config: RollingAvgConfig = { type: 'rolling_avg', accountId: 'rev-1', lookbackMonths: 3 };
    const context: ForecastContext = {
      historicalValues: [],
      forecastMonths: 2
    };
    
    const result = evaluateRollingAvg(config, context);
    expect(result).toEqual([0, 0]);
  });

  it('handles edge case: zero input values', () => {
    const config: RollingAvgConfig = { type: 'rolling_avg', accountId: 'rev-1', lookbackMonths: 2 };
    const context: ForecastContext = {
      historicalValues: [0, 0],
      forecastMonths: 1
    };
    const result = evaluateRollingAvg(config, context);
    expect(result).toEqual([0]);
  });
});
