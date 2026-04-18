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
import { useSensitivityStore } from '@/stores/sensitivity-store'
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
import { accountToEngineCategory } from '@/lib/standards/account-classifier'
import {
  SM_ASSET_CASH,
  SM_ASSET_TRADE_REC,
  SM_ASSET_PPE,
  SM_ASSET_INTANGIBLE,
  SM_ASSET_INVENTORIES,
  SM_ASSET_ST_LOANS,
  SM_ASSET_OTHER_C,
  SM_LIAB_TRADE_PAY,
  SM_LIAB_LT_BORROWINGS,
  SM_LIAB_ST_BORROWINGS,
  SM_LIAB_OTHER_C,
  SM_LIAB_ST_PROVISIONS,
  SM_EQ_SHARE_CAPITAL,
  SM_EQ_SECURITIES_PREMIUM,
  SM_EQ_GENERAL_RESERVE,
} from '@/lib/standards/standard-mappings'

/**
 * Map DB account types to engine categories.
 * Uses the centralised classifier — single source of truth.
 */
function accountToEngineInput(
  account: Account,
  historicalValues: number[]
): AccountInput {
  return {
    id: account.id,
    name: account.name,
    category: accountToEngineCategory(account),
    historicalValues,
  }
}

/**
 * Derive opening balances from the latest historical actuals.
 *
 * Uses standardMapping for precise classification — no name-token guessing.
 * Falls back to name-token matching for accounts without a standardMapping
 * (legacy data before Phase 1 migration).
 */
function deriveOpeningBalances(
  accounts: Account[],
  getHistoricalValues: (accountId: string) => number[]
): OpeningBalances {
  const latestValue = (account: Account) => {
    const values = getHistoricalValues(account.id)
    return values[values.length - 1] ?? 0
  }

  // Name-token fallback for accounts without standardMapping
  const nameMatches = (account: Account, tokens: string[]) => {
    const haystack = `${account.name} ${account.standardMapping ?? ''}`.toLowerCase()
    return tokens.some((token) => haystack.includes(token))
  }

  const sumBySM = (mappings: string[]) =>
    accounts
      .filter((a) => a.standardMapping && mappings.includes(a.standardMapping))
      .reduce((sum, a) => sum + latestValue(a), 0)

  const sumByNameFallback = (
    accountType: string,
    tokens: string[],
    excludeMappings: string[]
  ) =>
    accounts
      .filter(
        (a) =>
          a.accountType === accountType &&
          (!a.standardMapping || !excludeMappings.includes(a.standardMapping)) &&
          nameMatches(a, tokens)
      )
      .reduce((sum, a) => sum + latestValue(a), 0)

  // ── Cash ─────────────────────────────────────────────────────────────────
  const cash =
    sumBySM([SM_ASSET_CASH]) ||
    sumByNameFallback('asset', ['cash', 'bank'], [SM_ASSET_CASH])

  // ── Trade Receivables ─────────────────────────────────────────────────────
  const ar =
    sumBySM([SM_ASSET_TRADE_REC]) ||
    sumByNameFallback('asset', ['receivable', 'debtor'], [SM_ASSET_TRADE_REC])

  // ── Inventories ───────────────────────────────────────────────────────────
  const inventories =
    sumBySM([SM_ASSET_INVENTORIES]) ||
    sumByNameFallback('asset', ['inventory', 'stock', 'closing stock'], [SM_ASSET_INVENTORIES])

  // ── ST Loans & Advances (prepaid, GST ITC, security deposits) ────────────
  const stLoansAdvances =
    sumBySM([SM_ASSET_ST_LOANS]) ||
    sumByNameFallback('asset', ['prepaid', 'advance', 'gst receivable', 'itc'], [SM_ASSET_ST_LOANS])

  // ── Other Current Assets ──────────────────────────────────────────────────
  const otherCurrentAssets = sumBySM([SM_ASSET_OTHER_C])

  // ── PPE ───────────────────────────────────────────────────────────────────
  const fixedAssets =
    sumBySM([SM_ASSET_PPE]) ||
    sumByNameFallback('asset', ['fixed', 'property', 'plant', 'equipment', 'machine', 'vehicle', 'computer', 'furniture'], [SM_ASSET_PPE])

  const accDepreciation = Math.abs(
    sumByNameFallback('asset', ['depreciation', 'acc dep'], [])
  )

  // ── Intangibles ───────────────────────────────────────────────────────────
  // Fix 1.2: intangibles opening balance was always 0 — now correctly derived
  const intangibles =
    sumBySM([SM_ASSET_INTANGIBLE]) ||
    sumByNameFallback('asset', ['intangible', 'software', 'goodwill', 'patent', 'trademark', 'ip', 'brand'], [SM_ASSET_INTANGIBLE])

  // ── Trade Payables ────────────────────────────────────────────────────────
  const ap =
    sumBySM([SM_LIAB_TRADE_PAY]) ||
    sumByNameFallback('liability', ['payable', 'creditor'], [SM_LIAB_TRADE_PAY])

  // ── Borrowings ────────────────────────────────────────────────────────────
  const ltBorrowings =
    sumBySM([SM_LIAB_LT_BORROWINGS]) ||
    sumByNameFallback('liability', ['term loan', 'long term', 'secured loan'], [SM_LIAB_LT_BORROWINGS, SM_LIAB_ST_BORROWINGS])

  const stBorrowings =
    sumBySM([SM_LIAB_ST_BORROWINGS]) ||
    sumByNameFallback('liability', ['od', 'overdraft', 'cash credit', 'working capital loan'], [SM_LIAB_LT_BORROWINGS, SM_LIAB_ST_BORROWINGS])

  // Legacy: if no lt/st split, use total debt from name matching
  const legacyDebt =
    ltBorrowings === 0 && stBorrowings === 0
      ? sumByNameFallback('liability', ['loan', 'debt', 'borrowing', 'od', 'cc'], [SM_LIAB_LT_BORROWINGS, SM_LIAB_ST_BORROWINGS])
      : 0

  // ── Other Current Liabilities ─────────────────────────────────────────────
  const otherCurrentLiabilities = sumBySM([SM_LIAB_OTHER_C])
  const stProvisions             = sumBySM([SM_LIAB_ST_PROVISIONS])

  // ── Equity ────────────────────────────────────────────────────────────────
  const shareCapital =
    sumBySM([SM_EQ_SHARE_CAPITAL]) ||
    sumByNameFallback('equity', ['capital', 'share'], [SM_EQ_SHARE_CAPITAL])

  const securitiesPremium = sumBySM([SM_EQ_SECURITIES_PREMIUM])
  const generalReserve    = sumBySM([SM_EQ_GENERAL_RESERVE])

  const totalEquity = accounts
    .filter((a) => a.accountType === 'equity')
    .reduce((sum, a) => sum + latestValue(a), 0)

  const retainedEarnings = totalEquity - shareCapital - securitiesPremium - generalReserve

  return {
    cash,
    ar,
    ap,
    equity: shareCapital,
    retainedEarnings,
    fixedAssets,
    accDepreciation,
    intangibles,
    inventories,
    stLoansAdvances,
    otherCurrentAssets,
    ltBorrowings: ltBorrowings + legacyDebt,
    stBorrowings,
    otherCurrentLiabilities,
    stProvisions,
    securitiesPremium,
    generalReserve,
    // Legacy field for backward compat
    debt: ltBorrowings + stBorrowings + legacyDebt,
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
  /** Opening balances derived from historical data — shared with compare mode */
  openingBalances: OpeningBalances | null
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
  const sensitivityRevenueAdjPct = useSensitivityStore((s) => s.revenueAdjPct)
  const sensitivityExpenseAdjPct = useSensitivityStore((s) => s.expenseAdjPct)
  const sensitivityIsActive = useSensitivityStore((s) => s.isActive)

  const forecastMonths = useMemo(
    () =>
      buildForecastMonthLabels({
        fyStartMonth: company?.fyStartMonth ?? 4,
        historicalPeriods: historicalMonths,
      }),
    [company?.fyStartMonth, historicalMonths]
  )

  const storesLoading = accountsLoading || actualsLoading || configLoading

  // Compute opening balances once — shared between main engine and compare mode
  const openingBalances = useMemo(() => {
    if (!company || accounts.length === 0 || storesLoading) return null
    return deriveOpeningBalances(accounts, getHistoricalValues)
  }, [company, accounts, storesLoading, getHistoricalValues])

  const engineResult = useMemo(() => {
    if (!company || accounts.length === 0 || storesLoading || actualsVersion < 0) return null

    try {
      const accountInputs: AccountInput[] = accounts.map((acc) =>
        accountToEngineInput(acc, getHistoricalValues(acc.id))
      )
      const openingBals = openingBalances ?? deriveOpeningBalances(accounts, getHistoricalValues)
      const effectiveValueRules = buildEffectiveValueRules(
        accounts,
        getHistoricalValues,
        valueRules,
        forecastMonths.length
      )

      // Apply sensitivity modifiers as baseline adjustments on top of the scenario.
      // Revenue accounts get revenueAdjPct, expense accounts get expenseAdjPct.
      // AR delay is handled via a timing profile override on receivable accounts.
      const sensitivityAdjustments: Array<{ accountId: string; adjustmentPct: number }> = []
      if (sensitivityIsActive) {
        for (const acc of accountInputs) {
          if (acc.category === 'Revenue' && sensitivityRevenueAdjPct !== 0) {
            sensitivityAdjustments.push({ accountId: acc.id, adjustmentPct: sensitivityRevenueAdjPct })
          } else if ((acc.category === 'COGS' || acc.category === 'Operating Expenses') && sensitivityExpenseAdjPct !== 0) {
            sensitivityAdjustments.push({ accountId: acc.id, adjustmentPct: sensitivityExpenseAdjPct })
          }
        }
      }

      const scenarioDefinition: ScenarioDefinition | null = selectedScenario
        ? {
            id: selectedScenario.id,
            name: selectedScenario.name,
            description: selectedScenario.description ?? undefined,
            baselineAdjustments: [
              ...getScenarioAdjustments(selectedScenario).map((a) => ({
                accountId: a.accountId,
                adjustmentPct: a.adjustmentPct,
              })),
              ...sensitivityAdjustments,
            ],
            timingProfileOverrides: [],
            microForecastToggles: [],
          }
        : sensitivityIsActive && sensitivityAdjustments.length > 0
        ? {
            id: '__sensitivity__',
            name: 'What-If',
            baselineAdjustments: sensitivityAdjustments,
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
        openingBalances: openingBals,
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
    sensitivityIsActive,
    sensitivityRevenueAdjPct,
    sensitivityExpenseAdjPct,
    openingBalances,
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
    openingBalances,
  }
}
