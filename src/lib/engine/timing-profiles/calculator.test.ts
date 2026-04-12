import { describe, it, expect } from 'vitest';
import { applyTimingProfile } from './calculator';
import { ReceivablesTimingProfile } from './types';

describe('applyTimingProfile', () => {
  it('correctly allocates cash flow and balances without historical carryover', () => {
    const profile: ReceivablesTimingProfile = {
      type: 'receivables',
      accountId: 'rev-1',
      month_0: 0.3,
      month_1: 0.7
    };
    
    // 3 forecast months
    const historicalValues: number[] = [0, 0];
    const forecastValues: number[] = [100000, 200000, 150000];
    
    const result = applyTimingProfile(historicalValues, forecastValues, profile);
    
    // Month 1 revenue = 100,000. Month 1 cash = 30,000. Balance = 70,000.
    // Month 2 revenue = 200,000. Month 2 cash = 60,000 (30% of M2) + 70,000 (70% of M1) = 130,000. Balance = 70,000 + 200,000 - 130,000 = 140,000.
    // Month 3 revenue = 150,000. Month 3 cash = 45,000 (30% of M3) + 140,000 (70% of M2) = 185,000.
    expect(result.cashFlows).toEqual([30000, 130000, 185000]);
    // Ending AR balances:
    expect(result.balances).toEqual([70000, 140000, 105000]);
  });

  it('correctly handles historical carryover', () => {
    const profile: ReceivablesTimingProfile = {
      type: 'receivables',
      accountId: 'rev-1',
      month_0: 0.5,
      month_1: 0.5
    };
    
    // Historical month -1 had 100000 revenue. 50% was collected then, 50,000 carries over to forecast month 0.
    const historicalValues: number[] = [100000]; 
    const forecastValues: number[] = [200000]; // Forecast month 0
    
    const result = applyTimingProfile(historicalValues, forecastValues, profile);
    
    // Month 0 cash = 100,000 (50% of M0) + 50,000 (50% of H-1) = 150,000.
    expect(result.cashFlows).toEqual([150000]);
    // M0 AR Balance = Opening AR(50000) + Revenue(200000) - Cash(150000) = 100000.
    expect(result.balances).toEqual([100000]);
  });

  it('correctly handles bad debt', () => {
    const profile: ReceivablesTimingProfile = {
      type: 'receivables',
      accountId: 'rev-1',
      month_0: 0.60,
      month_1: 0.38,
      bad_debt: 0.02
    };
    
    const historicalValues: number[] = [];
    const forecastValues: number[] = [100000, 0];
    
    const result = applyTimingProfile(historicalValues, forecastValues, profile);
    
    // Month 0 cash = 60,000. Month 1 cash = 38,000.
    // Month 0 AR = 40,000. Month 1 AR = 40,000 - 38,000 = 2,000 (this is the permanent bad debt!).
    expect(result.cashFlows).toEqual([60000, 38000]);
    expect(result.balances).toEqual([40000, 2000]);
  });
  
  it('throws error if profile does not sum to 1.0', () => {
    const profile: ReceivablesTimingProfile = {
      type: 'receivables',
      accountId: 'rev-1',
      month_0: 0.5,
      // sums to 0.5
    };
    expect(() => applyTimingProfile([], [100], profile)).toThrowError();
  });
});
