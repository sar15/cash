import { ValueRuleEvaluator, DirectEntryConfig } from './types';

export const evaluateDirectEntry: ValueRuleEvaluator<DirectEntryConfig> = (config, context) => {
  const { forecastMonths } = context;
  const entries = config.entries || [];
  
  const results: number[] = [];
  
  for (let i = 0; i < forecastMonths; i++) {
    const val = entries[i];
    // If null or undefined, default to 0 securely
    results.push(val != null ? Math.round(val) : 0);
  }

  return results;
};
