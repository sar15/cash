import { ValueRuleEvaluator, GrowthConfig } from './types';

export const evaluateGrowth: ValueRuleEvaluator<GrowthConfig> = (config, context) => {
  const { historicalValues, forecastMonths } = context;
  
  if (historicalValues.length === 0) {
    console.warn(`[Engine] No historical data for account ${config.accountId}. Growth defaulting to 0.`);
    return Array(forecastMonths).fill(0);
  }

  const baseValue = historicalValues[historicalValues.length - 1]; // last historical month
  const results: number[] = [];
  
  let currentValue = baseValue;
  for (let i = 0; i < forecastMonths; i++) {
    // Add compound growth
    currentValue = currentValue * (1 + config.monthlyGrowthRate);
    // Math.round preserves paise as integer
    const roundedValue = Math.round(currentValue);
    results.push(roundedValue);
    
    // We base the next month's calculation on the exact float value before rounding
    // to avoid rounding error compounding over time, BUT for simplicity and typical
    // financial integer math, compounding the rounded value is also common.
    // Given rule "all arithmetic in paise", perhaps it's better to compound the rounded paise value.
    currentValue = roundedValue;
  }

  return results;
};
