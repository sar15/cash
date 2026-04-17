export type ValueRuleType = 'rolling_avg' | 'growth' | 'direct_entry' | 'same_last_year';

export interface BaseValueRuleConfig {
  type: ValueRuleType;
  accountId: string;
}

export interface RollingAvgConfig extends BaseValueRuleConfig {
  type: 'rolling_avg';
  lookbackMonths: number;
  /**
   * Optional YoY seasonality weights per calendar month (1-indexed: Jan=1 ... Dec=12).
   * If provided, the rolling average is multiplied by the weight for the forecast month.
   * Example: { 10: 1.4, 11: 1.4, 12: 1.4 } applies a 40% uplift in Oct/Nov/Dec (Diwali season).
   * Weights default to 1.0 for any month not specified.
   */
  seasonalityWeights?: Record<number, number>;
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
  /** Month labels like ['Apr-25', 'May-25', ...] — used for seasonality calculations */
  forecastMonthLabels?: string[];
}

/**
 * A standard interface for any value rule evaluator function
 * It takes a config and context, and returns an array of forecast values (in paise).
 */
export type ValueRuleEvaluator<T extends BaseValueRuleConfig> = (config: T, context: ForecastContext) => number[];
