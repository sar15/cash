export type ValueRuleType = 'rolling_avg' | 'growth' | 'direct_entry' | 'same_last_year';

export interface BaseValueRuleConfig {
  type: ValueRuleType;
  accountId: string;
}

export interface RollingAvgConfig extends BaseValueRuleConfig {
  type: 'rolling_avg';
  lookbackMonths: number;
}

export interface GrowthConfig extends BaseValueRuleConfig {
  type: 'growth';
  monthlyGrowthRate: number; // e.g. 0.05 for 5%
}

export interface DirectEntryConfig extends BaseValueRuleConfig {
  type: 'direct_entry';
  // Array of length forecastMonths (e.g. 12). Null means fallback to another rule if composed, 
  // but for simple value rule engine, it can just be undefined/null or straight numbers
  entries: (number | null)[]; 
}

export interface SameLastYearConfig extends BaseValueRuleConfig {
  type: 'same_last_year';
}

export type AnyValueRuleConfig = RollingAvgConfig | GrowthConfig | DirectEntryConfig | SameLastYearConfig;

/**
 * Context provided to a value rule evaluator
 */
export interface ForecastContext {
  historicalValues: number[]; // 1 historical array of paise, e.g. length 12
  forecastMonths: number; // e.g., 12
}

/**
 * A standard interface for any value rule evaluator function
 * It takes a config and context, and returns an array of forecast values (in paise).
 */
export type ValueRuleEvaluator<T extends BaseValueRuleConfig> = (config: T, context: ForecastContext) => number[];
