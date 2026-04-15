import { type MicroForecast, type MicroForecastLine } from '../overlay'

export interface OneTimeExpenseWizardInputs {
  expenseName: string
  amount: number // in paise
  month: string // e.g. 'Aug-25'
  /** Whether this is a cash expense (default true). Non-cash = depreciation only */
  isCash?: boolean
}

export function generateOneTimeExpenseMicroForecast(
  id: string,
  inputs: OneTimeExpenseWizardInputs,
  forecastMonths: string[]
): MicroForecast {
  const plImpacts = new Array(forecastMonths.length).fill(0)
  const cashImpacts = new Array(forecastMonths.length).fill(0)
  const isCash = inputs.isCash ?? true

  const idx = forecastMonths.indexOf(inputs.month)
  if (idx >= 0) {
    plImpacts[idx] = inputs.amount
    if (isCash) cashImpacts[idx] = inputs.amount
  }

  const line: MicroForecastLine = {
    category: 'Operating Expenses',
    plImpacts,
    cashImpacts,
  }

  return {
    id,
    name: `Expense: ${inputs.expenseName}`,
    lines: [line],
  }
}
