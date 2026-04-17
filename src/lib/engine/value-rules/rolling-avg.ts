import { ValueRuleEvaluator, RollingAvgConfig } from './types'

// Map month label abbreviation → calendar month number (1-indexed)
const MONTH_LABEL_TO_NUMBER: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
}

/**
 * Derive the calendar month number (1-12) from a forecast month label like 'Apr-25'.
 * Returns null if the label is malformed.
 */
function calendarMonthFromLabel(label: string): number | null {
  const abbr = label.split('-')[0]
  return MONTH_LABEL_TO_NUMBER[abbr] ?? null
}

export const evaluateRollingAvg: ValueRuleEvaluator<RollingAvgConfig> = (config, context) => {
  const { historicalValues, forecastMonths, forecastMonthLabels } = context

  if (historicalValues.length === 0) {
    console.warn(`[Engine] No historical data for account ${config.accountId}. Rolling average defaulting to 0.`)
    return Array(forecastMonths).fill(0)
  }

  // Use up to lookbackMonths, but if fewer are available, use whatever we have.
  const actualLookback = Math.min(config.lookbackMonths, historicalValues.length)
  const relevantData = historicalValues.slice(-actualLookback)
  const sum = relevantData.reduce((acc, val) => acc + val, 0)
  // Math.round preserves paise as integer
  const baseAverage = Math.round(sum / actualLookback)

  // If no seasonality weights configured, return flat average (original behaviour)
  if (!config.seasonalityWeights || Object.keys(config.seasonalityWeights).length === 0) {
    return Array(forecastMonths).fill(baseAverage)
  }

  // Apply per-month seasonality weights
  return Array.from({ length: forecastMonths }, (_, i) => {
    const label = forecastMonthLabels?.[i]
    const calMonth = label ? calendarMonthFromLabel(label) : null
    const weight = calMonth !== null ? (config.seasonalityWeights![calMonth] ?? 1.0) : 1.0
    return Math.round(baseAverage * weight)
  })
}
