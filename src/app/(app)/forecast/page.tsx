'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Plus, Upload, ArrowRight, Keyboard } from 'lucide-react'
import Link from 'next/link'

import { useCompanyContext } from '@/hooks/use-company-context'
import { useCurrentForecast } from '@/hooks/use-current-forecast'
import { useActualsStore } from '@/stores/actuals-store'
import { useMicroForecastStore } from '@/stores/micro-forecast-store'
import { useAccountsStore, type Account } from '@/stores/accounts-store'
import { useCompanyStore } from '@/stores/company-store'
import { ViewSwitcher, type ViewType } from '@/components/forecast/ViewSwitcher'
import { ForecastGrid } from '@/components/forecast/ForecastGrid'
import { MicroForecastWizard } from '@/components/forecast/MicroForecastWizard'
import { BusinessEventsList } from '@/components/forecast/BusinessEventsList'
import { AccountRuleEditor } from '@/components/forecast/AccountRuleEditor'
import { SensitivityPanel, type SensitivityParams } from '@/components/forecast/SensitivityPanel'
import { useForecastConfigStore } from '@/stores/forecast-config-store'
import { useScenarioStore } from '@/stores/scenario-store'
import { cn } from '@/lib/utils'
import { apiPost } from '@/lib/api/client'
import { runScenarioForecastEngine } from '@/lib/engine/scenarios/engine'
import { runForecastEngine } from '@/lib/engine'
import type { AnyValueRuleConfig } from '@/lib/engine/value-rules/types'
import type { AnyTimingProfileConfig } from '@/lib/engine/timing-profiles/types'
import { Sliders } from 'lucide-react'

export default function ForecastPage() {
  const { companyId, company, isLoading: companyLoading } = useCompanyContext()
  const { engineResult, forecastMonths, isReady, hasAccounts, accounts } = useCurrentForecast()
  const valueRules = useForecastConfigStore((state) => state.valueRules)
  const updateValueRule = useForecastConfigStore((state) => state.updateValueRule)
  const forecastTimingProfiles = useForecastConfigStore((state) => state.timingProfiles)
  const complianceConfig = useForecastConfigStore((state) => state.complianceConfig)
  const microForecastItems = useMicroForecastStore((state) => state.items)
  const scenarios = useScenarioStore((state) => state.scenarios)
  const selectedScenarioId = useScenarioStore((state) => state.selectedScenarioId)
  const selectScenario = useScenarioStore((state) => state.select)
  const [activeView, setActiveView] = useState<ViewType>('pl')
  const [showWizard, setShowWizard] = useState(false)
  const [isSavingCell, setIsSavingCell] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [isSeeding, setIsSeeding] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [showSensitivity, setShowSensitivity] = useState(false)

  const getHistoricalValues = useActualsStore((s) => s.getHistoricalValues)
  const actualsData = useActualsStore((s) => s.actuals)
  const updateTimingProfile = useForecastConfigStore((s) => s.updateTimingProfile)
  const timingProfiles = forecastTimingProfiles
  const reloadAccounts = useAccountsStore((s) => s.load)
  const reloadActuals = useActualsStore((s) => s.load)
  const reloadCompany = useCompanyStore((s) => s.loadCompanies)

  const handleToggleLock = useCallback(async (period: string) => {
    if (!companyId || !company) return
    
    const lockedPeriodsStr = company.lockedPeriods || '[]'
    const isLocked = JSON.parse(lockedPeriodsStr).includes(period)
    const action = isLocked ? 'unlock' : 'lock'
    
    try {
      await fetch(`/api/companies/${companyId}/lock-period`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, action })
      })
      
      // Reload company data to get updated locked periods
      await reloadCompany()
    } catch (err) {
      console.error('[Forecast] Failed to toggle lock:', err)
    }
  }, [companyId, company, reloadCompany])

  // Keyboard shortcuts: P = P&L, B = Balance Sheet, C = Cash Flow, D = Drivers
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'p' || e.key === 'P') setActiveView('pl')
      if (e.key === 'b' || e.key === 'B') setActiveView('bs')
      if (e.key === 'c' || e.key === 'C') setActiveView('cf')
      if (e.key === 'd' || e.key === 'D') setActiveView('drivers')
      if (e.key === 'v' || e.key === 'V') setActiveView('variance')
      if (e.key === 'n' || e.key === 'N') setShowWizard(true)
      if (e.key === 's' || e.key === 'S') setShowSensitivity(v => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleLoadSampleData = useCallback(async () => {
    if (!companyId) return
    setIsSeeding(true)
    try {
      await apiPost('/api/import/seed-demo', { companyId })
      await Promise.all([reloadAccounts(companyId), reloadActuals(companyId)])
    } catch (err) {
      console.error('[Forecast] Sample data seed failed:', err)
    } finally {
      setIsSeeding(false)
    }
  }, [companyId, reloadAccounts, reloadActuals])

  const handleCellEdit = async (accountId: string, monthIndex: number, valuePaise: number) => {
    if (!companyId) return
    const currentRule = valueRules[accountId]
    const baseEntries =
      currentRule?.type === 'direct_entry'
        ? [...currentRule.entries]
        : [...(engineResult?.accountForecasts[accountId] ?? Array(forecastMonths.length).fill(null))]
    while (baseEntries.length < forecastMonths.length) baseEntries.push(null)
    baseEntries[monthIndex] = valuePaise
    setIsSavingCell(true)
    try {
      await updateValueRule(companyId, accountId, { type: 'direct_entry', accountId, entries: baseEntries })
    } finally {
      setIsSavingCell(false)
    }
  }

  // Sensitivity analysis: re-run engine with adjusted params (read-only, not persisted)
  const handleRunSensitivity = useCallback((params: SensitivityParams) => {
    if (!engineResult || accounts.length === 0) return null
    try {
      const adjustedAccounts = accounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        category: (
          acc.accountType === 'revenue' ? 'Revenue' :
          acc.accountType === 'expense' && (acc.standardMapping?.startsWith('cogs') ?? false) ? 'COGS' :
          acc.accountType === 'expense' ? 'Operating Expenses' :
          acc.accountType === 'asset' ? 'Assets' :
          acc.accountType === 'liability' ? 'Liabilities' : 'Equity'
        ) as 'Revenue' | 'COGS' | 'Operating Expenses' | 'Assets' | 'Liabilities' | 'Equity',
        historicalValues: getHistoricalValues(acc.id),
      }))
      // Apply revenue/expense growth to value rules
      const adjustedRules: Record<string, AnyValueRuleConfig> = { ...valueRules }
      accounts.forEach(acc => {
        const baseVals = engineResult.accountForecasts[acc.id]
        if (!baseVals) return
        let multiplier = 1
        if (acc.accountType === 'revenue' && params.revenueGrowthPct !== 0) {
          multiplier = 1 + params.revenueGrowthPct / 100
        } else if (acc.accountType === 'expense' && params.expenseGrowthPct !== 0) {
          multiplier = 1 + params.expenseGrowthPct / 100
        } else return
        adjustedRules[acc.id] = {
          type: 'direct_entry',
          accountId: acc.id,
          entries: baseVals.map(v => Math.round(v * multiplier)),
        }
      })
      return runForecastEngine({
        accounts: adjustedAccounts,
        forecastMonthLabels: forecastMonths,
        valueRules: adjustedRules,
        timingProfiles,
        microForecastItems,
        complianceConfig: complianceConfig ? {
          gstRatePct: complianceConfig.gstRate,
          inputTaxCreditPct: complianceConfig.itcPct,
          advanceTaxRatePct: complianceConfig.taxRate,
          supplyType: complianceConfig.supplyType,
        } : undefined,
      })
    } catch (err) {
      console.error('[Sensitivity] Engine error:', err)
      return null
    }
  }, [engineResult, accounts, getHistoricalValues, valueRules, timingProfiles, microForecastItems, complianceConfig, forecastMonths])

  // Build actuals map for variance view: accountId → period → paise
  const actualsMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const actual of actualsData) {
      if (!map[actual.accountId]) map[actual.accountId] = {}
      map[actual.accountId][actual.period] = actual.amount
    }
    return map
  }, [actualsData])

  // Scenario comparison: run engine for each scenario when compare mode is active
  const scenarioResults = useMemo(() => {
    if (!compareMode || scenarios.length === 0 || !engineResult || !companyId) return null
    
    // Limit to 3 scenarios max for performance
    const activeScenarios = scenarios.slice(0, 3)
    
    // Derive opening balances from historical data
    const deriveOpeningBalances = (accts: Account[], getHist: (id: string) => number[]) => {
      const latestValue = (account: Account) => {
        const values = getHist(account.id)
        return values.length > 0 ? values[values.length - 1] : 0
      }
      const cashAccount = accts.find((a: Account) => a.id === 'ast-1')
      const arAccount = accts.find((a: Account) => a.id === 'ast-2')
      const faAccount = accts.find((a: Account) => a.id === 'ast-3')
      const depAccount = accts.find((a: Account) => a.id === 'ast-4')
      const apAccount = accts.find((a: Account) => a.id === 'lia-1')
      const debtAccount = accts.find((a: Account) => a.id === 'lia-2')
      const equityAccount = accts.find((a: Account) => a.id === 'equ-1')
      const reAccount = accts.find((a: Account) => a.id === 'equ-2')
      
      return {
        cash: cashAccount ? latestValue(cashAccount) : 0,
        ar: arAccount ? latestValue(arAccount) : 0,
        fixedAssets: faAccount ? latestValue(faAccount) : 0,
        accDepreciation: depAccount ? latestValue(depAccount) : 0,
        ap: apAccount ? latestValue(apAccount) : 0,
        debt: debtAccount ? latestValue(debtAccount) : 0,
        equity: equityAccount ? latestValue(equityAccount) : 0,
        retainedEarnings: reAccount ? latestValue(reAccount) : 0,
      }
    }
    
    const openingBalances = deriveOpeningBalances(accounts, getHistoricalValues)
    
    // Run engine for each scenario
    return activeScenarios.map(scenario => ({
      id: scenario.id,
      name: scenario.name,
      result: runScenarioForecastEngine({
        accounts: accounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          category: (
            acc.accountType === 'revenue' ? 'Revenue' :
            acc.accountType === 'expense' && (acc.standardMapping?.startsWith('cogs') ?? false) ? 'COGS' :
            acc.accountType === 'expense' ? 'Operating Expenses' :
            acc.accountType === 'asset' ? 'Assets' :
            acc.accountType === 'liability' ? 'Liabilities' : 'Equity'
          ) as 'Revenue' | 'COGS' | 'Operating Expenses' | 'Assets' | 'Liabilities' | 'Equity',
          historicalValues: getHistoricalValues(acc.id),
        })),
        forecastMonthLabels: forecastMonths,
        scenario: {
          id: scenario.id,
          name: scenario.name,
          description: scenario.description ?? undefined,
          baselineAdjustments: (scenario.overrides ?? [])
            .filter(o => o.targetType === 'value_rule' && o.targetId)
            .map(o => ({
              accountId: o.targetId!,
              adjustmentPct: typeof (o.config as Record<string, unknown>)?.adjustmentPct === 'number'
                ? (o.config as Record<string, unknown>).adjustmentPct as number
                : 0,
            })),
          timingProfileOverrides: [],
          microForecastToggles: [],
        },
        microForecastItems,
        valueRules,
        timingProfiles,
        complianceConfig: complianceConfig ? {
          gstRatePct: complianceConfig.gstRate ?? 18,
          inputTaxCreditPct: complianceConfig.itcPct ?? 85,
          advanceTaxRatePct: complianceConfig.taxRate ?? 25.17,
          supplyType: complianceConfig.supplyType,
        } : undefined,
        openingBalances,
      })
    }))
  }, [compareMode, scenarios, engineResult, companyId, accounts, forecastMonths, valueRules, timingProfiles, microForecastItems, complianceConfig, getHistoricalValues])

  // Loading
  if (companyLoading || !isReady) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#059669]" />
      </div>
    )
  }

  // No data — Fathom-style upload prompt
  if (!hasAccounts) {
    return (
      <div className="flex h-[calc(100vh-56px)] flex-col items-center justify-center px-6">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-[#E2E8F0] bg-white">
            <Upload className="h-8 w-8 text-[#94A3B8]" />
          </div>
          <h2 className="text-2xl font-semibold text-[#0F172A]">Upload your financials</h2>
          <p className="mt-3 text-base leading-7 text-[#64748B]">
            Upload your P&L and Balance Sheet to get a 12-month three-way forecast with GST, TDS, and PF/ESI compliance.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/data"
              className="inline-flex items-center gap-2 rounded-xl bg-[#059669] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#047857]">
              <Upload className="h-4 w-4" /> Upload P&L & Balance Sheet
            </Link>
            <button onClick={handleLoadSampleData} disabled={isSeeding}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-6 py-3 text-sm font-semibold text-[#475569] transition-all hover:border-[#CBD5E1] disabled:opacity-60">
              {isSeeding
                ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#059669]" /> Loading...</>
                : <>Try with sample data <ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </div>
          <p className="mt-4 text-xs text-[#94A3B8]">Supports Excel (.xlsx, .xls) and CSV · Indian Chart of Accounts auto-mapping</p>
        </div>
      </div>
    )
  }

  const editingAccount = editingAccountId ? accounts.find(a => a.id === editingAccountId) ?? null : null

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-hidden">
      {/* Top bar — Fathom style: tabs left, controls right */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 py-2">
        <div className="flex items-center gap-4">
          <ViewSwitcher activeView={activeView} onViewChange={setActiveView} />
          {/* Fathom-style "Showing" label */}
          {forecastMonths.length > 0 && (
            <span className="hidden text-[11px] text-[#94A3B8] sm:block">
              Showing: Month rolling from{' '}
              <span className="font-medium text-[#475569]">{forecastMonths[0]}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Scenario comparison toggle */}
          {scenarios.length > 0 && (
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                compareMode
                  ? 'border-[#059669] bg-[#ECFDF5] text-[#059669]'
                  : 'border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#CBD5E1]'
              )}
            >
              {compareMode ? 'Single View' : 'Compare Scenarios'}
            </button>
          )}

          <select
            value={selectedScenarioId ?? 'baseline'}
            onChange={(e) => selectScenario(e.target.value === 'baseline' ? null : e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
          >
            <option value="baseline">Baseline</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <span className="hidden text-xs text-[#94A3B8] sm:block">
            {forecastMonths[0]} – {forecastMonths[forecastMonths.length - 1]}
          </span>

          {isSavingCell && (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-1 text-[11px] font-medium text-[#059669]">
              <div className="h-2.5 w-2.5 animate-spin rounded-full border border-[#059669] border-t-transparent" />
              Saving
            </div>
          )}

          {/* Keyboard shortcut hint */}
          <div className="hidden items-center gap-1 rounded border border-[#E5E7EB] bg-[#F8FAFC] px-2 py-1 lg:flex" title="Keyboard shortcuts: P=P&L, B=Balance Sheet, C=Cash Flow, D=Drivers, V=Variance, N=New Event, S=Sensitivity">
            <Keyboard className="h-3 w-3 text-[#94A3B8]" />
            <span className="text-[10px] text-[#94A3B8]">P · B · C · D · V · S</span>
          </div>

          <button
            onClick={() => setShowSensitivity(v => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              showSensitivity
                ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                : 'border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#CBD5E1]'
            )}
            title="Sensitivity Analysis (S)"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sensitivity</span>
          </button>

          <button onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#047857]">
            <Plus className="h-3.5 w-3.5" /> Add Event
          </button>
        </div>
      </div>

      {/* Main: grid + optional right panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className={cn('flex-1 overflow-auto', editingAccount ? 'border-r border-[#E2E8F0]' : '')}>
          <ForecastGrid
            view={activeView}
            accounts={accounts}
            forecastMonths={forecastMonths}
            engineResult={engineResult}
            actuals={actualsMap}
            valueRules={valueRules}
            timingProfiles={timingProfiles}
            onCellEdit={handleCellEdit}
            onAccountClick={activeView === 'pl' ? (id) => setEditingAccountId(id) : undefined}
            fullHeight
            compareMode={compareMode}
            scenarioResults={scenarioResults}
            lockedPeriods={company?.lockedPeriods ? JSON.parse(company.lockedPeriods) : []}
            onToggleLock={handleToggleLock}
          />
        </div>

        {/* Right panel slides in — Fathom style */}
        {showSensitivity && (
          <div className="w-[300px] shrink-0 overflow-y-auto border-l border-[#E2E8F0] bg-white">
            <SensitivityPanel
              baselineResult={engineResult}
              onClose={() => setShowSensitivity(false)}
              onRunSensitivity={handleRunSensitivity}
            />
          </div>
        )}
        {!showSensitivity && editingAccount && companyId && (
          <div className="w-[320px] shrink-0 overflow-y-auto bg-white">
            <AccountRuleEditor
              account={editingAccount}
              currentRule={valueRules[editingAccountId!]}
              currentTimingProfile={timingProfiles[editingAccountId!]}
              historicalValues={getHistoricalValues(editingAccountId!)}
              onSaveRule={async (rule: AnyValueRuleConfig) => { await updateValueRule(companyId, editingAccountId!, rule) }}
              onSaveTimingProfile={async (profile: AnyTimingProfileConfig) => { await updateTimingProfile(companyId, editingAccountId!, profile) }}
              onClose={() => setEditingAccountId(null)}
              inline
            />
          </div>
        )}
      </div>

      {/* Bottom bar — business events strip */}
      <div className="shrink-0 border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
        <div className="flex items-center gap-3 overflow-x-auto thin-scrollbar">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">Events</span>
          <BusinessEventsList companyId={companyId!} inline />
        </div>
      </div>

      {showWizard && <MicroForecastWizard onClose={() => setShowWizard(false)} />}
    </div>
  )
}
