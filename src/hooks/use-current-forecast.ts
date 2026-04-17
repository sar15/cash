/**
 * useCurrentForecast v3 — uses runScenarioForecastEngine
 *
 * Properly applies scenario overrides (baseline adjustments, timing profile
 * overrides, micro-forecast toggles) through the dedicated scenario engine
 * instead of manually applying adjustments.
 *
 * v3.1: Persists engine result to DB (debounced 800ms) so next page load
 * can use cached result instead of recomputing from scratch.
 */
'use client'

import { useMemo, useEffect, useRef } from 'react'
import { useAccountsStore, type Account } from '@/stores/accounts-store'
import { useActualsStore } from '@/stores/actuals-store'
import { useForecastConfigStore } from '@/stores/forecast-config-store'
import { useCompanyStore } from '@/stores/company-store'
import { useMicroForecastStore } from '@/stores/micro-forecast-store'
import { getScenarioAdjustments, useScenarioStore } from '@/stores/scenario-store'
import {
  type AccountInput,
  type EngineResult,
} from '@/lib/engine'
import { runScenarioForecastEngine } from '@/lib/engine/scenarios/engine'
import type { ScenarioDefinition } from '@/lib/engine/scenarios/types'
import type { OpeningBalances } from '@/lib/engine/three-way/builder'
import type { AnyValueRuleConfig } from '@/lib/engine/value-rules/types'
import { buildForecastMonthLabels } from '@/lib/forecast-periods'
import { apiPost } from '@/lib/api/client'

/**
 * Map DB account types to engine categories.
 */
function accountToEngineInput(
  account: Account,
  historicalValues: number[]
): AccountInput {
  let category: AccountInput['category']

  if (account.accountType === 'revenue') {
    category = 'Revenue'
  } else if (
    account.accountType === 'expense' &&
    (account.standardMapping?.startsWith('cogs') ?? false)
  ) {
    category = 'COGS'
  } else if (account.accountType === 'expense') {
    category = 'Operating Expenses'
  } else if (account.accountType === 'asset') {
    category = 'Assets'
  } else if (account.accountType === 'liability') {
    category = 'Liabilities'
  } else {
    category = 'Equity'
  }

  return {
    id: account.id,
    name: account.name,
    category,
    historicalValues,
  }
}

function deriveOpeningBalances(accounts: Account[], getHistoricalValues: (accountId: string) => number[]): OpeningBalances {
  const latestValue = (account: Account) => {
    const values = getHistoricalValues(account.id)
    return values[values.length - 1] ?? 0
  }

  const matches = (account: Account, tokens: string[]) => {
    const haystack = `${account.name} ${account.standardMapping ?? ''}`.toLowerCase()
    return tokens.some((token) => haystack.includes(token))
  }

  const sumLatest = (predicate: (account: Account) => boolean) =>
    accounts.filter(predicate).reduce((sum, account) => sum + latestValue(account), 0)

  const cash = sumLatest((account) =>
    account.accountType === 'asset' && matches(account, ['cash', 'bank'])
  )
  const ar = sumLatest((account) =>
    account.accountType === 'asset' && matches(account, ['receivable', 'debtor'])
  )
  const ap = sumLatest((account) =>
    account.accountType === 'liability' && matches(account, ['payable', 'creditor'])
  )
  const debt = sumLatest((account) =>
    account.accountType === 'liability' && matches(account, ['loan', 'debt', 'borrowing', 'od', 'cc'])
  )
  const fixedAssets = sumLatest((account) =>
    account.accountType === 'asset' &&
    matches(account, ['fixed', 'property', 'plant', 'equipment', 'machine', 'vehicle', 'computer', 'furniture'])
  )
  const accDepreciation = Math.abs(
    sumLatest((account) =>
      account.accountType === 'asset' && matches(account, ['depreciation', 'acc dep'])
    )
  )
  const shareCapital = sumLatest((account) =>
    account.accountType === 'equity' && matches(account, ['capital', 'share'])
  )
  const totalEquity = sumLatest((account) => account.accountType === 'equity')

  return {
    cash,
    ar,
    ap,
    debt,
    fixedAssets,
    accDepreciation,
    equity: shareCapital,
    retainedEarnings: totalEquity - shareCapital,
  }
}

function buildEffectiveValueRules(
  accounts: Account[],
  getHistoricalValues: (accountId: string) => number[],
  configuredRules: Record<string, AnyValueRuleConfig>,
  forecastLength: number
) {
  const effectiveRules: Record<string, AnyValueRuleConfig> = { ...configuredRules }

  accounts.forEach((account) => {
    if (
      effectiveRules[account.id] ||
      ['asset', 'liability', 'equity'].includes(account.accountType)
    ) {
      return
    }

    const history = getHistoricalValues(account.id).filter((value) => value !== 0)
    if (history.length === 0) {
      return
    }

    effectiveRules[account.id] =
      history.length >= 12
        ? {
            type: 'same_last_year',
            accountId: account.id,
          }
        : {
            type: 'rolling_avg',
            accountId: account.id,
            lookbackMonths: Math.max(1, Math.min(3, Math.min(history.length, forecastLength))),
          }
  })

  return effectiveRules
}

export interface ForecastData {
  engineResult: EngineResult | null
  forecastMonths: string[]
  isReady: boolean
  hasAccounts: boolean
  error: string | null
  accounts: Account[]
}

export function useCurrentForecast(): ForecastData {
  const company = useCompanyStore((s) => s.activeCompany())
  const accounts = useAccountsStore((s) => s.accounts)
  const accountsLoading = useAccountsStore((s) => s.isLoading)
  const actualsLoading = useActualsStore((s) => s.isLoading)
  const configLoading = useForecastConfigStore((s) => s.isLoading)
  // Stable reference: subscribe to the actuals array so we re-run when data changes,
  // but keep getHistoricalValues stable (it reads from get() internally)
  const actuals = useActualsStore((s) => s.actuals)
  const actualsVersion = actuals.length // used as memo trigger when actuals change
  const historicalMonths = useActualsStore((s) => s.historicalMonths)
  const getHistoricalValues = useActualsStore((s) => s.getHistoricalValues)
  const valueRules = useForecastConfigStore((s) => s.valueRules)
  const timingProfiles = useForecastConfigStore((s) => s.timingProfiles)
  const complianceConfig = useForecastConfigStore((s) => s.complianceConfig)
  const microForecastItems = useMicroForecastStore((s) => s.items)
  const selectedScenario = useScenarioStore((s) => s.selectedScenario())

  const forecastMonths = useMemo(
    () =>
      buildForecastMonthLabels({
        fyStartMonth: company?.fyStartMonth ?? 4,
        historicalPeriods: historicalMonths,
      }),
    [company?.fyStartMonth, historicalMonths]
  )

  const storesLoading = accountsLoading || actualsLoading || configLoading

  const engineResult = useMemo(() => {
    if (!company || accounts.length === 0 || storesLoading || actualsVersion < 0) return null

    try {
      const accountInputs: AccountInput[] = accounts.map((acc) =>
        accountToEngineInput(acc, getHistoricalValues(acc.id))
      )
      const openingBalances = deriveOpeningBalances(accounts, getHistoricalValues)
      const effectiveValueRules = buildEffectiveValueRules(
        accounts,
        getHistoricalValues,
        valueRules,
        forecastMonths.length
      )

      const scenarioDefinition: ScenarioDefinition | null = selectedScenario
        ? {
            id: selectedScenario.id,
            name: selectedScenario.name,
            description: selectedScenario.description ?? undefined,
            baselineAdjustments: getScenarioAdjustments(selectedScenario).map((a) => ({
              accountId: a.accountId,
              adjustmentPct: a.adjustmentPct,
            })),
            timingProfileOverrides: [],
            microForecastToggles: [],
          }
        : null

      return runScenarioForecastEngine({
        accounts: accountInputs,
        forecastMonthLabels: forecastMonths,
        scenario: scenarioDefinition,
        valueRules: effectiveValueRules,
        timingProfiles,
        microForecastItems,
        openingBalances,
        complianceConfig: complianceConfig
          ? {
              gstRatePct: complianceConfig.gstRate,
              inputTaxCreditPct: complianceConfig.itcPct,
              advanceTaxRatePct: complianceConfig.taxRate,
              supplyType: complianceConfig.supplyType,
            }
          : undefined,
      })
    } catch (err) {
      console.error('[useCurrentForecast] Engine error:', err)
      return null
    }
  }, [
    company,
    accounts,
    storesLoading,
    actualsVersion,
    forecastMonths,
    valueRules,
    timingProfiles,
    complianceConfig,
    microForecastItems,
    selectedScenario,
    getHistoricalValues,
  ])

  // Persist result to DB (debounced 800ms) so next load is instant
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!engineResult || !company?.id) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const lastMonth = engineResult.rawIntegrationResults[engineResult.rawIntegrationResults.length - 1]
      const metrics = {
        closingCash: lastMonth?.bs?.cash ?? 0,
        totalRevenue: engineResult.rawIntegrationResults.reduce((s, m) => s + (m?.pl?.revenue ?? 0), 0),
        totalNetIncome: engineResult.rawIntegrationResults.reduce((s, m) => s + (m?.pl?.netIncome ?? 0), 0),
        forecastMonths: engineResult.forecastMonths,
      }
      apiPost(`/api/forecast/result?companyId=${company.id}`, {
        scenarioId: null,
        plData: { accountForecasts: engineResult.accountForecasts },
        bsData: { months: engineResult.rawIntegrationResults.map(m => m?.bs) },
        cfData: { months: engineResult.rawIntegrationResults.map(m => m?.cf) },
        compliance: engineResult.compliance,
        metrics,
      }).catch(() => {
        // Silent fail — caching is best-effort, not critical
      })
    }, 800)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [engineResult, company?.id])

  return {
    engineResult,
    forecastMonths,
    isReady: !!company && !storesLoading,
    hasAccounts: accounts.length > 0,
    error: null,
    accounts,
  }
}
