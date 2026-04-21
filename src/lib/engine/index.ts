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
import { SM_EXP_EMPLOYEE_BENEFITS, SM_ASSET_CASH, SM_ASSET_BANK_OTHER } from '@/lib/standards/standard-mappings'

// ============================================================
// TYPES
// ============================================================

export interface AccountInput {
  id: string
  name: string
  category: 'Revenue' | 'COGS' | 'Operating Expenses' | 'Assets' | 'Liabilities' | 'Equity'
  historicalValues: number[] // in paise
  standardMapping?: string | null // e.g. 'asset.cash', 'expense.employee_benefits'
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
  // PRIMARY: find by standardMapping = SM_EXP_EMPLOYEE_BENEFITS (set during import mapping)
  // FALLBACK: name heuristics for legacy data where standardMapping wasn't set
  const salaryAccountId = accounts?.find(
    (a) => a.standardMapping === SM_EXP_EMPLOYEE_BENEFITS
  )?.id ?? accounts?.find(
    (a) => a.name.toLowerCase().includes('salary') ||
           a.name.toLowerCase().includes('salaries') ||
           a.name.toLowerCase().includes('payroll') ||
           a.name.toLowerCase().includes('wages') ||
           a.name.toLowerCase().includes('remuneration') ||
           a.name.toLowerCase().includes('stipend')
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
  const MAX_PASSES = 3
  let hasChanges = false

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    hasChanges = false
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
        if (pass === 0) {
          forecast = Array(forecastLength).fill(0)
        } else {
          return 
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

      const finalForecast = forecast.map((value) =>
        applyBaselineAdjustment(value, baselineAdjustments[account.id])
      )

      // Track changes to detect convergence
      const previous = accountForecasts[account.id]
      if (!previous || JSON.stringify(previous) !== JSON.stringify(finalForecast)) {
        hasChanges = true
        accountForecasts[account.id] = finalForecast
      }
    })

    // Short-circuit if we stabilized early
    if (!hasChanges) break
  }

  // Final convergence warning if it didn't stabilize after MAX_PASSES
  const convergenceWarning: import('./three-way/builder').BalanceWarning[] = hasChanges
    ? [{ 
        monthIndex: 0,
        check: 'engine_convergence', 
        message: 'Engine did not converge: some accounts have unresolved dependencies after 3 passes. Check for complex circular logic.',
        discrepancyPaise: 0 
      }]
    : []

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
  // PRIMARY: find cash/bank account by standardMapping (set during import mapping)
  // FALLBACK: name heuristics for legacy data — covers 'HDFC A/c 1234', 'Petty Cash Imprest', etc.
  const cashAccountByMapping = accounts.find((a) =>
    a.category === 'Assets' && (
      a.standardMapping === SM_ASSET_CASH ||
      a.standardMapping === SM_ASSET_BANK_OTHER
    )
  )
  
  const cashAccountByHeuristic = !cashAccountByMapping ? accounts.find((a) =>
    a.category === 'Assets' && (
      a.name.toLowerCase().includes('cash') ||
      a.name.toLowerCase().includes('bank') ||
      a.name.toLowerCase().includes('current account') ||
      a.name.toLowerCase().includes('savings account')
    )
  ) : null

  const cashAccount = cashAccountByMapping || cashAccountByHeuristic
  const openingCash = cashAccount?.historicalValues.at(-1) ?? 0

  // Emit warning if we relied on heuristics for the core BS plug
  const heuristicWarning: import('./three-way/builder').BalanceWarning[] = cashAccountByHeuristic
    ? [{
        monthIndex: 0,
        check: 'recheck_mappings',
        message: `Account "${cashAccountByHeuristic.name}" was automatically identified as your primary Cash/Bank account based on its name. Please verify this mapping in Settings for better accuracy.`,
        discrepancyPaise: 0
      }]
    : []

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

  // Combine integration warnings with engine convergence and heuristic warnings
  const allWarnings = [...balanceWarnings, ...convergenceWarning, ...heuristicWarning]

  // Log warnings in development — non-blocking
  if (allWarnings.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn('[Engine] Balance warnings:', allWarnings)
  }

  return {
    accountForecasts,
    rawIntegrationResults,
    integrationResults: compliance.integrationResults,
    forecastMonths: forecastMonthLabels,
    compliance,
    salaryForecast,
    balanceWarnings: allWarnings,
  }
}
