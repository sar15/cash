/**
 * useCurrentForecast v2 — API-backed, explicit engine params
 *
 * Replaces the old v1 that imported mutable globals from demo-data.ts.
 * This version reads from API-backed stores and passes explicit params
 * to the engine. NO demo-data, NO localStorage, NO mutation.
 */
'use client'

import { useMemo } from 'react'
import { useAccountsStore, type Account } from '@/stores/accounts-store'
import { useActualsStore } from '@/stores/actuals-store'
import { useForecastConfigStore } from '@/stores/forecast-config-store'
import { useCompanyStore } from '@/stores/company-store'
import { useMicroForecastStore } from '@/stores/micro-forecast-store'
import { getScenarioAdjustments, useScenarioStore } from '@/stores/scenario-store'
import {
  runForecastEngine,
  type AccountInput,
  type EngineResult,
  type ForecastEngineOptions,
} from '@/lib/engine'
import type { OpeningBalances } from '@/lib/engine/three-way/builder'
import type { AnyValueRuleConfig } from '@/lib/engine/value-rules/types'
import { buildForecastMonthLabels } from '@/lib/forecast-periods'

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
  error: string | null
  accounts: Account[]
}

export function useCurrentForecast(): ForecastData {
  const company = useCompanyStore((s) => s.activeCompany())
  const accounts = useAccountsStore((s) => s.accounts)
  const accountsLoading = useAccountsStore((s) => s.isLoading)
  const getHistoricalValues = useActualsStore((s) => s.getHistoricalValues)
  const historicalMonths = useActualsStore((s) => s.historicalMonths)
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

  const engineResult = useMemo(() => {
    if (!company || accounts.length === 0 || accountsLoading) return null

    try {
      const accountInputs: AccountInput[] = accounts.map((acc) =>
        accountToEngineInput(acc, getHistoricalValues(acc.id))
      )
      const baselineAdjustments = Object.fromEntries(
        getScenarioAdjustments(selectedScenario).map((override) => [
          override.accountId,
          override.adjustmentPct,
        ])
      )
      const openingBalances = deriveOpeningBalances(accounts, getHistoricalValues)
      const effectiveValueRules = buildEffectiveValueRules(
        accounts,
        getHistoricalValues,
        valueRules,
        forecastMonths.length
      )

      const options: ForecastEngineOptions = {
        accounts: accountInputs,
        forecastMonthLabels: forecastMonths,
        valueRules: effectiveValueRules,
        timingProfiles,
        microForecastItems,
        baselineAdjustments,
        openingBalances,
        complianceConfig: complianceConfig
          ? {
              gstRatePct: complianceConfig.gstRate,
              inputTaxCreditPct: complianceConfig.itcPct,
              advanceTaxRatePct: complianceConfig.taxRate,
              supplyType: complianceConfig.supplyType,
            }
          : undefined,
      }

      return runForecastEngine(options)
    } catch (err) {
      console.error('[useCurrentForecast] Engine error:', err)
      return null
    }
  }, [
    company,
    accounts,
    accountsLoading,
    getHistoricalValues,
    forecastMonths,
    valueRules,
    timingProfiles,
    complianceConfig,
    microForecastItems,
    selectedScenario,
  ])

  return {
    engineResult,
    forecastMonths,
    isReady: !!company && accounts.length > 0 && !accountsLoading,
    error: null,
    accounts,
  }
}
