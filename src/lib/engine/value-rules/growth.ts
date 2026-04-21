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
    // Add compound growth to the raw float value
    currentValue = currentValue * (1 + config.monthlyGrowthRate);
    
    // Round for the results array (paise) but KEEP the float for the next iteration
    results.push(Math.round(currentValue));
  }

  return results;
};
