import { describe, it, expect } from 'vitest';
import { evaluateGrowth } from './growth';
import { GrowthConfig, ForecastContext } from './types';

describe('Value Rule: growth', () => {
  it('calculates normally growing from last historical month', () => {
    const config: GrowthConfig = { type: 'growth', accountId: 'rev-1', monthlyGrowthRate: 0.10 }; // 10% monthly growth
    const context: ForecastContext = {
      historicalValues: [100000],
      forecastMonths: 3
    };
    
    const result = evaluateGrowth(config, context);
    
    // Month 1 = 100000 + 10% = 110000
    // Month 2 = 110000 + 10% = 121000
    // Month 3 = 121000 + 10% = 133100
    expect(result).toEqual([110000, 121000, 133100]);
  });

  it('handles edge case: zero historical data', () => {
    // If no historical data to base the growth on, return 0s
    const config: GrowthConfig = { type: 'growth', accountId: 'rev-1', monthlyGrowthRate: 0.05 };
    const context: ForecastContext = {
      historicalValues: [],
      forecastMonths: 2
    };
    
    const result = evaluateGrowth(config, context);
    expect(result).toEqual([0, 0]);
  });
  
  it('handles negative growth (decline)', () => {
    const config: GrowthConfig = { type: 'growth', accountId: 'rev-1', monthlyGrowthRate: -0.50 }; // 50% drop
    const context: ForecastContext = {
      historicalValues: [100000],
      forecastMonths: 2
    };
    
    const result = evaluateGrowth(config, context);
    // Month 1 = 50000
    // Month 2 = 25000
    expect(result).toEqual([50000, 25000]);
  });
});
