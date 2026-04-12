import { ValueRuleEvaluator, RollingAvgConfig } from './types';

export const evaluateRollingAvg: ValueRuleEvaluator<RollingAvgConfig> = (config, context) => {
  const { historicalValues, forecastMonths } = context;
  
  if (historicalValues.length === 0) {
    console.warn(`[Engine] No historical data for account ${config.accountId}. Rolling average defaulting to 0.`);
    return Array(forecastMonths).fill(0);
  }

  // Use up to lookbackMonths, but if fewer are available, use whatever we have.
  const actualLookback = Math.min(config.lookbackMonths, historicalValues.length);
  const relevantData = historicalValues.slice(-actualLookback);
  
  const sum = relevantData.reduce((acc, val) => acc + val, 0);
  
  // Math.round preserves paise as integer
  const averageInPaise = Math.round(sum / actualLookback);

  return Array(forecastMonths).fill(averageInPaise);
};
