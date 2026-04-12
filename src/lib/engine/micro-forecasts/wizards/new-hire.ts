/**
 * New Hire Micro-Forecast Wizard
 *
 * FIX audit3 C1: Use Math.round() for all paise calculations.
 * monthlyCTC * netSalaryPct was producing float results.
 */
import { MicroForecast, MicroForecastLine } from '../overlay'

export interface NewHireWizardInputs {
  role: string
  monthlyCTC: number // In paise
  startMonth: string // e.g. 'Aug-25'

  // Percentage split (must sum to 1.0)
  netSalaryPct: number // e.g. 0.8 -> Paid in month 0
  statutoryPct: number // e.g. 0.2 -> Paid in month 1 (PF, ESI, TDS)
}

export function generateNewHireMicroForecast(
  id: string,
  inputs: NewHireWizardInputs,
  forecastMonths: string[]
): MicroForecast {
  const plImpacts = new Array(forecastMonths.length).fill(0)
  const cashImpacts = new Array(forecastMonths.length).fill(0)

  let active = false

  for (let i = 0; i < forecastMonths.length; i++) {
    const isStartMonth = forecastMonths[i] === inputs.startMonth
    if (isStartMonth) active = true

    if (active) {
      // P&L expense is total CTC
      plImpacts[i] = inputs.monthlyCTC

      // FIX audit3 C1: Math.round() to prevent floating point paise
      cashImpacts[i] += Math.round(inputs.monthlyCTC * inputs.netSalaryPct)

      // Statutory payments hit the NEXT month
      if (i + 1 < forecastMonths.length) {
        cashImpacts[i + 1] += Math.round(inputs.monthlyCTC * inputs.statutoryPct)
      }
    }
  }

  const line: MicroForecastLine = {
    category: 'Operating Expenses',
    plImpacts,
    cashImpacts,
  }

  return {
    id,
    name: `New Hire: ${inputs.role}`,
    lines: [line],
  }
}
