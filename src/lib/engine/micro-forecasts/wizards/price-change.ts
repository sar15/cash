import { type MicroForecast, type MicroForecastLine } from '../overlay'

export interface PriceChangeWizardInputs {
  label: string
  /** Monthly baseline revenue in paise (used to compute the delta) */
  baselineMonthlyRevenue: number
  /** Percentage change, e.g. +10 or -5 */
  changePct: number
  startMonth: string // e.g. 'Aug-25'
  /** Collection % in same month (0-100). Default 100. */
  collectionPctSameMonth?: number
}

export function generatePriceChangeMicroForecast(
  id: string,
  inputs: PriceChangeWizardInputs,
  forecastMonths: string[]
): MicroForecast {
  const plImpacts = new Array(forecastMonths.length).fill(0)
  const cashImpacts = new Array(forecastMonths.length).fill(0)
  const sameMonthPct = (inputs.collectionPctSameMonth ?? 100) / 100

  let active = false
  const delta = Math.round(inputs.baselineMonthlyRevenue * inputs.changePct / 100)

  for (let i = 0; i < forecastMonths.length; i++) {
    if (forecastMonths[i] === inputs.startMonth) active = true
    if (!active) continue

    plImpacts[i] = delta
    const sameMonth = Math.round(delta * sameMonthPct)
    const nextMonth = delta - sameMonth
    cashImpacts[i] += sameMonth
    if (nextMonth !== 0 && i + 1 < forecastMonths.length) {
      cashImpacts[i + 1] += nextMonth
    }
  }

  const line: MicroForecastLine = {
    category: 'Revenue',
    plImpacts,
    cashImpacts,
  }

  return {
    id,
    name: `Price change: ${inputs.label} (${inputs.changePct > 0 ? '+' : ''}${inputs.changePct}%)`,
    lines: [line],
  }
}
