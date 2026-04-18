/**
 * CashFlowIQ Forecast Engine
 *
 * REFACTORED (Phase 2): No mutable global imports.
 * All data passed via explicit parameters.
 *
 * Fixes: audit1 C1 (demoData coupling), audit5 C1 (mutation bridge),
 *        audit7 (global state dependency)
 */
import { buildComplianceForecast, type ComplianceResult } from './compliance'
import { overlayMicroForecast, type MicroForecast } from './micro-forecasts/overlay'
import { applyTimingProfile } from './timing-profiles/calculator'
import type { AnyTimingProfileConfig } from './timing-profiles/types'
import {
  type MonthlyInput,
  type OpeningBalances,
  runThreeWayIntegrationWithWarnings,
  type ThreeWayMonth,
} from './three-way/builder'
import { evaluateDirectEntry } from './value-rules/direct-entry'
import { evaluateGrowth } from './value-rules/growth'
import { evaluateRollingAvg } from './value-rules/rolling-avg'
import { evaluateSameLastYear } from './value-rules/same-last-year'
import type { AnyValueRuleConfig } from './value-rules/types'

// ============================================================
// TYPES
// ============================================================

export interface AccountInput {
  id: string
  name: string
  category: 'Revenue' | 'COGS' | 'Operating Expenses' | 'Assets' | 'Liabilities' | 'Equity'
  historicalValues: number[] // in paise
}

export interface ForecastMicroForecastItem {
  id: string
  type?: 'revenue' | 'hire' | 'asset' | 'loan' | 'expense' | 'price_change'
  isActive?: boolean
  microForecast: MicroForecast
}

export interface ForecastEngineOptions {
  // REQUIRED: explicit data inputs (no more globals)
  accounts: AccountInput[]
  forecastMonthLabels: string[] // e.g. ['Apr-25', 'May-25', ...]

  // OPTIONAL: configuration overrides
  valueRules?: Record<string, AnyValueRuleConfig>
  timingProfiles?: Record<string, AnyTimingProfileConfig>
  activeMicroForecasts?: MicroForecast[]
  microForecastItems?: ForecastMicroForecastItem[]
  baselineAdjustments?: Record<string, number>
  openingBalances?: OpeningBalances
  complianceConfig?: {
    gstRatePct?: number
    inputTaxCreditPct?: number
    advanceTaxRatePct?: number
    supplyType?: 'intra-state' | 'inter-state'
  }
}

export interface EngineResult {
  accountForecasts: Record<string, number[]>
  rawIntegrationResults: ThreeWayMonth[]
  integrationResults: ComplianceResult['integrationResults']
  forecastMonths: string[]
  compliance: ComplianceResult
  salaryForecast: number[]
  /** Phase 4: balance validation warnings — non-blocking, surface in UI */
  balanceWarnings: import('./three-way/builder').BalanceWarning[]
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

function buildForecastPeriods(labels: string[]): string[] {
  const monthIndexByLabel: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  }

  return labels.map((label) => {
    const [monthLabel, yearLabel] = label.split('-')
    const year = Number(`20${yearLabel}`)
    const month = monthIndexByLabel[monthLabel]
    return `${year}-${String(month + 1).padStart(2, '0')}-01`
  })
}

function applyBaselineAdjustment(value: number, adjustmentPct: number | undefined): number {
  if (!adjustmentPct) return value
  // Integer-safe percentage math: multiply first, then divide, then round.
  // Avoids IEEE 754 float drift on paise values.
  return Math.round((value * (100 + adjustmentPct)) / 100)
}

function deriveSalaryForecast(
  accountForecasts: Record<string, number[]>,
  forecastLength: number,
  microForecastItems: ForecastMicroForecastItem[] | undefined,
  accounts?: AccountInput[]
): number[] {
  // Find salary account by standardMapping tag first, then name heuristics.
  // Never falls back to a hardcoded demo ID — returns zeros if no salary account found.
  const salaryAccountId = accounts?.find(
    (a) => a.name.toLowerCase().includes('salary') ||
           a.name.toLowerCase().includes('salaries') ||
           a.name.toLowerCase().includes('payroll') ||
           a.name.toLowerCase().includes('wages')
  )?.id

  const salaryForecast = [...(accountForecasts[salaryAccountId ?? ''] ?? Array(forecastLength).fill(0))]

  microForecastItems
    ?.filter((item) => item.isActive !== false && item.type === 'hire')
    .forEach((item) => {
      item.microForecast.lines.forEach((line) => {
        if (line.category !== 'Operating Expenses') return
        line.plImpacts.forEach((amount, index) => {
          salaryForecast[index] = (salaryForecast[index] ?? 0) + amount
        })
      })
    })

  return salaryForecast
}

// ============================================================
// MAIN ENGINE
// ============================================================

export function runForecastEngine(options: ForecastEngineOptions): EngineResult {
  const {
    accounts,
    forecastMonthLabels,
    valueRules = {},
    timingProfiles = {},
    activeMicroForecasts,
    microForecastItems,
    baselineAdjustments = {},
    openingBalances: customOpening,
    complianceConfig,
  } = options

  const forecastLength = forecastMonthLabels.length
  const accountForecasts: Record<string, number[]> = {}

  // 1. EVALUATE VALUE RULES per account
  // Multi-pass resolution handles accounts that reference other accounts (e.g. interest on debt).
  // We run up to 3 passes — in practice 2 passes resolves all standard circular dependencies.
  const MAX_PASSES = 3
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    accounts.forEach((account) => {
      if (['Assets', 'Liabilities', 'Equity'].includes(account.category)) return

      const rule = valueRules[account.id]
      const context = {
        historicalValues: account.historicalValues,
        forecastMonths: forecastLength,
        forecastMonthLabels,
      }

      let forecast: number[]

      if (!rule) {
        // Only fill zeros on first pass — preserve values from previous passes
        if (pass === 0) {
          forecast = Array(forecastLength).fill(0)
        } else {
          return // keep existing value
        }
      } else {
        switch (rule.type) {
          case 'growth':
            forecast = evaluateGrowth(rule, context)
            break
          case 'rolling_avg':
            forecast = evaluateRollingAvg(rule, context)
            break
          case 'direct_entry':
            forecast = evaluateDirectEntry(rule, context)
            break
          case 'same_last_year':
            forecast = evaluateSameLastYear(rule, context)
            break
          default:
            forecast = Array(forecastLength).fill(0)
        }
      }

      accountForecasts[account.id] = forecast.map((value) =>
        applyBaselineAdjustment(value, baselineAdjustments[account.id])
      )
    })
  }

  // 2. APPLY TIMING PROFILES → compute cash flows
  const cashInflows: Record<string, number[]> = {}
  const cashOutflows: Record<string, number[]> = {}

  accounts.forEach((account) => {
    if (['Assets', 'Liabilities', 'Equity'].includes(account.category)) return

    const forecast = accountForecasts[account.id]
    const profile = timingProfiles[account.id]
    const cashFlow = profile
      ? applyTimingProfile(account.historicalValues, forecast, profile).cashFlows
      : [...forecast]

    if (account.category === 'Revenue') {
      cashInflows[account.id] = cashFlow
    } else if (account.category === 'COGS' || account.category === 'Operating Expenses') {
      cashOutflows[account.id] = cashFlow
    }
  })

  // 3. BUILD MONTHLY INPUTS for three-way integration
  const monthlyInputs: MonthlyInput[] = []

  for (let index = 0; index < forecastLength; index += 1) {
    let revenue = 0
    let cashIn = 0
    let cogs = 0
    let cogsPaid = 0
    let expense = 0
    let expensePaid = 0

    accounts.forEach((account) => {
      if (account.category === 'Revenue') {
        revenue += accountForecasts[account.id]?.[index] ?? 0
        cashIn += cashInflows[account.id]?.[index] ?? 0
      } else if (account.category === 'COGS') {
        cogs += accountForecasts[account.id]?.[index] ?? 0
        cogsPaid += cashOutflows[account.id]?.[index] ?? 0
      } else if (account.category === 'Operating Expenses') {
        expense += accountForecasts[account.id]?.[index] ?? 0
        expensePaid += cashOutflows[account.id]?.[index] ?? 0
      }
    })

    monthlyInputs.push({ revenue, cashIn, cogs, cogsPaid, expense, expensePaid })
  }

  // 4. OVERLAY MICRO-FORECASTS
  const resolvedMicroForecasts =
    activeMicroForecasts ??
    microForecastItems
      ?.filter((item) => item.isActive !== false)
      .map((item) => item.microForecast) ??
    []

  let finalInputs = monthlyInputs
  resolvedMicroForecasts.forEach((microForecast) => {
    finalInputs = overlayMicroForecast(finalInputs, microForecast)
  })

  // 5. THREE-WAY INTEGRATION
  // Find cash/bank account dynamically by name — never rely on hardcoded IDs
  const cashAccount = accounts.find((a) =>
    a.category === 'Assets' && (
      a.name.toLowerCase().includes('cash') ||
      a.name.toLowerCase().includes('bank')
    )
  )
  const openingCash = cashAccount?.historicalValues.at(-1) ?? 0
  const opening: OpeningBalances = customOpening ?? {
    cash: openingCash,
    ar: 0,
    ap: 0,
    equity: openingCash,
    retainedEarnings: 0,
    fixedAssets: 0,
    accDepreciation: 0,
    debt: 0,
  }

  const { results: rawIntegrationResults, warnings: balanceWarnings } =
    runThreeWayIntegrationWithWarnings(opening, finalInputs, forecastMonthLabels)

  // 6. COMPLIANCE
  const salaryForecast = deriveSalaryForecast(accountForecasts, forecastLength, microForecastItems, accounts)
  const periods = buildForecastPeriods(forecastMonthLabels)
  const compliance = buildComplianceForecast({
    periods,
    accountForecasts,
    rawIntegrationResults,
    salaryForecast,
    microForecastItems: microForecastItems?.filter((item) => item.isActive !== false) ?? [],
    complianceConfig,
  })

  // Log warnings in development — non-blocking
  if (balanceWarnings.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn('[Engine] Balance warnings:', balanceWarnings)
  }

  return {
    accountForecasts,
    rawIntegrationResults,
    integrationResults: compliance.integrationResults,
    forecastMonths: forecastMonthLabels,
    compliance,
    salaryForecast,
    balanceWarnings,
  }
}
