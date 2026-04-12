import { ValueRuleEvaluator, SameLastYearConfig } from './types';

export const evaluateSameLastYear: ValueRuleEvaluator<SameLastYearConfig> = (config, context) => {
  const { historicalValues, forecastMonths } = context;
  const results: number[] = [];
  
  const historyLen = historicalValues.length;

  for (let i = 0; i < forecastMonths; i++) {
    // Forecast month 0 (first month) should correspond to 12 months ago
    // Array index for 12 months ago = historyLen - 12 + i
    const targetIdx = historyLen - 12 + i;
    
    if (targetIdx >= 0 && targetIdx < historyLen) {
      results.push(historicalValues[targetIdx]);
    } else {
      if (targetIdx < 0) {
        console.warn(`[Engine] Insufficient data for account ${config.accountId} to use same_last_year for month ${i}. Defaulting to 0.`);
      }
      // If we go beyond historical data (e.g. projecting > 12 months and want same last year),
      // we would use the results we generated ourselves.
      // But for simplicity of this pure function (which only has history), returning 0 if out of bounds.
      if (targetIdx >= historyLen) {
         // It means we are looking at a forecast month that itself is > 12 months away from base
         // We should look into our own results array!
         const resultIdx = targetIdx - historyLen;
         if (resultIdx >= 0 && resultIdx < results.length) {
             results.push(results[resultIdx]);
             continue; // go to next iteration
         }
      }
      results.push(0);
    }
  }

  return results;
};
