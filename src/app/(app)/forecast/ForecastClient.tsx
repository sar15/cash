'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Plus, Upload, ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { useCompanyContext } from '@/hooks/use-company-context'
import { useCurrentForecast } from '@/hooks/use-current-forecast'
import { useActualsStore } from '@/stores/actuals-store'
import { useMicroForecastStore } from '@/stores/micro-forecast-store'
import { useAccountsStore } from '@/stores/accounts-store'
import { useCompanyStore } from '@/stores/company-store'
import { ViewSwitcher, type ViewType } from '@/components/forecast/ViewSwitcher'
import { ForecastGrid } from '@/components/forecast/ForecastGrid'
import { AnnualView } from '@/components/forecast/AnnualView'
import { MicroForecastWizard } from '@/components/forecast/MicroForecastWizard'
import { BusinessEventsList } from '@/components/forecast/BusinessEventsList'
import { AccountRuleEditor } from '@/components/forecast/AccountRuleEditor'
import { SensitivityPanel, type SensitivityParams } from '@/components/forecast/SensitivityPanel'
import { useForecastConfigStore } from '@/stores/forecast-config-store'
import { useScenarioStore, getScenarioAdjustments } from '@/stores/scenario-store'
import { cn } from '@/lib/utils'
import { apiPost } from '@/lib/api/client'
import { runScenarioForecastEngine } from '@/lib/engine/scenarios/engine'
import { runForecastEngine } from '@/lib/engine'
import { scenarioEngineCache } from '@/lib/engine/cache'
import type { AnyValueRuleConfig } from '@/lib/engine/value-rules/types'
import type { AnyTimingProfileConfig } from '@/lib/engine/timing-profiles/types'
import { useFormulaStore } from '@/stores/formula-store'
import { CustomFormulaBuilder } from '@/components/forecast/CustomFormulaBuilder'
import { accountToEngineCategory } from '@/lib/standards/account-classifier'

export default function ForecastClient() {
  const { companyId, company, isLoading: companyLoading } = useCompanyContext()
  const { engineResult, forecastMonths, isReady, hasAccounts, accounts, openingBalances } = useCurrentForecast()
  const valueRules = useForecastConfigStore((state) => state.valueRules)
  const updateValueRule = useForecastConfigStore((state) => state.updateValueRule)
  const forecastTimingProfiles = useForecastConfigStore((state) => state.timingProfiles)
  const complianceConfig = useForecastConfigStore((state) => state.complianceConfig)
  const microForecastItems = useMicroForecastStore((state) => state.items)
  const microRevision = useMicroForecastStore((s) => s.revision)
  const scenarios = useScenarioStore((state) => state.scenarios)
  const selectedScenarioId = useScenarioStore((state) => state.selectedScenarioId)
  const selectScenario = useScenarioStore((state) => state.select)
  const scenarioRevision = useScenarioStore((s) => s.revision)
  const [activeView, setActiveView] = useState<ViewType>('pl')
  const [showWizard, setShowWizard] = useState(false)
  const [isSavingCell, setIsSavingCell] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [isSeeding, setIsSeeding] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [showSensitivity, setShowSensitivity] = useState(false)
  const [showFormulaBuilder, setShowFormulaBuilder] = useState(false)

  const loadFormulas = useFormulaStore(s => s.load)

  // Load formulas when company changes
  useEffect(() => {
    if (companyId) loadFormulas(companyId)
  }, [companyId, loadFormulas])

  const getHistoricalValues = useActualsStore((s) => s.getHistoricalValues)
  const actualsData = useActualsStore((s) => s.actuals)
  const updateTimingProfile = useForecastConfigStore((s) => s.updateTimingProfile)
  const timingProfiles = forecastTimingProfiles
  const configRevision = useForecastConfigStore((s) => s.revision)
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
        body: JSON.stringify({ period, action }),
      })

      // Reload company data to get updated locked periods
      await reloadCompany()
    } catch (err) {
      console.error('[Forecast] Failed to toggle lock:', err)
    }
  }, [companyId, company, reloadCompany])

  // Keyboard shortcuts: P = P&L, B = Balance Sheet, C = Cash Flow, D = Drivers, A = Annual
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'p' || e.key === 'P') setActiveView('pl')
      if (e.key === 'b' || e.key === 'B') setActiveView('bs')
      if (e.key === 'c' || e.key === 'C') setActiveView('cf')
      if (e.key === 'd' || e.key === 'D') setActiveView('drivers')
      if (e.key === 'v' || e.key === 'V') setActiveView('variance')
      if (e.key === 'a' || e.key === 'A') setActiveView('annual')
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
        category: accountToEngineCategory(acc),
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
    if (!openingBalances) return null

    // Limit to 3 scenarios max for performance
    const activeScenarios = scenarios.slice(0, 3)

    // Run engine for each scenario using the same opening balances as the main forecast
    return activeScenarios.map(scenario => ({
      id: scenario.id,
      name: scenario.name,
      result: scenarioEngineCache.getOrCompute(
        [
          'scenario',
          companyId,
          scenario.id,
          configRevision,
          microRevision,
          scenarioRevision,
          accounts.length,
          forecastMonths.join('|'),
        ].join(':'),
        () =>
          runScenarioForecastEngine({
            accounts: accounts.map(acc => ({
              id: acc.id,
              name: acc.name,
              category: accountToEngineCategory(acc),
              historicalValues: getHistoricalValues(acc.id),
            })),
            forecastMonthLabels: forecastMonths,
            // Use getScenarioAdjustments — same logic as useCurrentForecast
            scenario: {
              id: scenario.id,
              name: scenario.name,
              description: scenario.description ?? undefined,
              baselineAdjustments: getScenarioAdjustments(scenario).map(a => ({
                accountId: a.accountId,
                adjustmentPct: a.adjustmentPct,
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
            // Reuse the same opening balances as the main forecast — no divergence
            openingBalances,
          })
      )
    }))
  }, [compareMode, scenarios, engineResult, companyId, accounts, forecastMonths, valueRules, timingProfiles, microForecastItems, complianceConfig, getHistoricalValues, configRevision, microRevision, scenarioRevision, openingBalances])

  // Loading
  if (companyLoading || !isReady) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#2563EB]" />
      </div>
    )
  }

  // No data — clean upload prompt
  if (!hasAccounts) {
    return (
      <div className="flex h-[calc(100vh-56px)] flex-col items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]">
            <Upload className="h-7 w-7 text-[#94A3B8]" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#0F172A]">No financial data yet</h2>
          <p className="mt-2 text-sm leading-6 text-[#64748B]">
            Upload your P&L and Balance Sheet to get a 12-month three-way forecast with GST, TDS, and PF/ESI compliance built in.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
            <Link
              href="/data"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E293B]"
            >
              <Upload className="h-4 w-4" />
              Upload financials
            </Link>
            <button
              onClick={handleLoadSampleData}
              disabled={isSeeding}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-5 py-2.5 text-sm font-semibold text-[#0F172A] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] disabled:opacity-60"
            >
              {isSeeding
                ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#0F172A]" /> Loading...</>
                : <>Try sample data <ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </div>
          <p className="mt-4 text-xs text-[#94A3B8]">
            Supports Excel (.xlsx, .xls) and CSV · Indian Chart of Accounts auto-mapping
          </p>
        </div>
      </div>
    )
  }

  const editingAccount = editingAccountId ? accounts.find(a => a.id === editingAccountId) ?? null : null
  const balanceWarnings = engineResult?.balanceWarnings ?? []

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-hidden bg-white">
      {/* ── Phase 4: Balance Validation Warning Banner ── */}
      {balanceWarnings.length > 0 && (
        <div className="shrink-0 border-b border-[#FDE68A] bg-[#FFFBEB] px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#D97706]">
              Balance Warning
            </span>
            <span className="text-xs text-[#92400E]">
              {balanceWarnings[0].message}
              {balanceWarnings.length > 1 && ` (+${balanceWarnings.length - 1} more)`}
            </span>
          </div>
        </div>
      )}
      {/* ── Topbar ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-4">
        {/* Left: view tabs */}
        <ViewSwitcher activeView={activeView} onViewChange={setActiveView} />

        {/* Right: controls */}
        <div className="flex items-center gap-2 py-2">
          {/* Period range */}
          {forecastMonths.length > 0 && (
            <span className="hidden text-xs text-[#94A3B8] sm:block">
              {forecastMonths[0]} – {forecastMonths[forecastMonths.length - 1]}
            </span>
          )}

          {/* Saving indicator */}
          {isSavingCell && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 text-[11px] font-medium text-[#64748B]">
              <div className="h-2.5 w-2.5 animate-spin rounded-full border border-[#94A3B8] border-t-transparent" />
              Saving
            </span>
          )}

          {/* Scenario selector */}
          {scenarios.length > 0 && (
            <select
              value={selectedScenarioId ?? 'baseline'}
              onChange={(e) => selectScenario(e.target.value === 'baseline' ? null : e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
            >
              <option value="baseline">Baseline</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* Compare scenarios */}
          {scenarios.length > 0 && (
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                compareMode
                  ? 'border-[#0F172A] bg-[#0F172A] text-white'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A]'
              )}
            >
              {compareMode ? 'Exit Compare' : 'Compare'}
            </button>
          )}

          {/* Sensitivity / What-If */}
          <button
            onClick={() => setShowSensitivity(v => !v)}
            title="What-If Analysis (S)"
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              showSensitivity
                ? 'border-[#0F172A] bg-[#0F172A] text-white'
                : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A]'
            )}
          >
            What-If
          </button>

          {/* Keyboard shortcuts hint */}
          <div
            className="hidden items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 lg:flex"
            title="P=P&L · B=Balance Sheet · C=Cash Flow · D=Drivers · V=Variance · A=Annual · N=New Event · S=What-If"
          >
            <span className="text-[10px] font-medium text-[#94A3B8]">P · B · C · D · V · A</span>
          </div>

          {/* Add Event — primary CTA */}
          <button
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Event
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Grid or Annual View */}
        <div className={cn('flex-1 overflow-auto', (editingAccount || showSensitivity) ? 'border-r border-[#E2E8F0]' : '')}>
          {activeView === 'annual' ? (
            <AnnualView
              engineResult={engineResult}
              forecastMonths={forecastMonths}
              companyId={companyId ?? ''}
              scenarioId={selectedScenarioId}
              company={company}
            />
          ) : (
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
              companyId={companyId ?? undefined}
              onCreateFormula={activeView === 'drivers' ? () => setShowFormulaBuilder(true) : undefined}
            />
          )}
        </div>

        {/* Right panel: What-If or Account Rule Editor */}
        {showSensitivity && (
          <div className="w-[320px] shrink-0 overflow-y-auto border-l border-[#E2E8F0] bg-[#F8FAFC]">
            <SensitivityPanel
              baselineResult={engineResult}
              onClose={() => setShowSensitivity(false)}
              onRunSensitivity={handleRunSensitivity}
            />
          </div>
        )}
        {!showSensitivity && editingAccount && companyId && (
          <div className="w-[320px] shrink-0 overflow-y-auto border-l border-[#E2E8F0] bg-white">
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

      {/* ── Events strip ── */}
      <div className="shrink-0 border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
        <div className="flex items-center gap-3 overflow-x-auto">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
            Events
          </span>
          <BusinessEventsList companyId={companyId!} inline />
        </div>
      </div>

      {showWizard && <MicroForecastWizard onClose={() => setShowWizard(false)} />}
      {showFormulaBuilder && companyId && (
        <CustomFormulaBuilder
          companyId={companyId}
          accounts={accounts}
          engineResult={engineResult}
          onClose={() => setShowFormulaBuilder(false)}
        />
      )}
    </div>
  )
}

