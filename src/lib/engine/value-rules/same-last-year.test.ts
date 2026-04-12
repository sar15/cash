import { describe, it, expect } from 'vitest';
import { evaluateSameLastYear } from './same-last-year';
import { SameLastYearConfig, ForecastContext } from './types';

describe('Value Rule: same_last_year', () => {
  it('mirrors exactly twelve months ago', () => {
    const config: SameLastYearConfig = { type: 'same_last_year', accountId: 'rev-1' };
    const context: ForecastContext = {
      // 12 months historical data
      historicalValues: [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210],
      forecastMonths: 3
    };
    
    const result = evaluateSameLastYear(config, context);
    // Month 1 should mirror historicalValues[0] = 100
    // Month 2 should mirror 110
    // Month 3 should mirror 120
    expect(result).toEqual([100, 110, 120]);
  });
  
  it('handles edge case: insufficient historical data (<12 months)', () => {
    // If fewer than 12 months exist, the missing counterpart should be 0.
    const config: SameLastYearConfig = { type: 'same_last_year', accountId: 'rev-1' };
    const context: ForecastContext = {
      historicalValues: [180, 190, 200, 210], // only 4 months
      forecastMonths: 5
    };
    
    // For month i, we look back 12 months.
    // If context only has 4 months, last historical is index 3.
    // the "12 months ago" from the first forecast month would be index -8 relative to the array start? No, index length - 12.
    // 4 - 12 = -8 (out of bounds -> 0)
    const result = evaluateSameLastYear(config, context);
    expect(result).toEqual([0, 0, 0, 0, 0]);
  });
  
  it('mirrors when some exist and some dont', () => {
    const config: SameLastYearConfig = { type: 'same_last_year', accountId: 'rev-1' };
    const context: ForecastContext = {
      historicalValues: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // 10 months
      forecastMonths: 3
    };
    
    // history length = 10
    // 1st forecast month corresponds to 12 months ago -> history[10 - 12] -> history[-2] -> 0
    // 2nd forecast month -> history[10 - 11] -> history[-1] -> 0
    // 3rd forecast month -> history[10 - 10] -> history[0] -> 1
    const result = evaluateSameLastYear(config, context);
    expect(result).toEqual([0, 0, 1]);
  });
});
