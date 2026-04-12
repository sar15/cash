import { describe, it, expect } from 'vitest';
import { evaluateDirectEntry } from './direct-entry';
import { DirectEntryConfig, ForecastContext } from './types';

describe('Value Rule: direct_entry', () => {
  it('applies direct entries correctly and pads with zeros or nulls if nulls allowed', () => {
    // Usually if a direct entry is specified as [null, 500, null], it means it falls back
    // However, in our simple engine, we might treat nulls differently or expect the user to provide all.
    // Let's assume it returns what is passed. If there are fewer entries than forecast months, pad with 0.
    const config: DirectEntryConfig = { type: 'direct_entry', accountId: 'rev-1', entries: [100000, 200000] };
    const context: ForecastContext = {
      historicalValues: [], // Doesn't matter
      forecastMonths: 3
    };
    
    const result = evaluateDirectEntry(config, context);
    expect(result).toEqual([100000, 200000, 0]);
  });
  
  it('handles null entries (can be treated as 0)', () => {
    const config: DirectEntryConfig = { type: 'direct_entry', accountId: 'rev-1', entries: [100000, null, 300000] };
    const context: ForecastContext = {
      historicalValues: [],
      forecastMonths: 3
    };
    
    // Assuming for this strict paise engine, null becomes 0
    const result = evaluateDirectEntry(config, context);
    expect(result).toEqual([100000, 0, 300000]);
  });
});
