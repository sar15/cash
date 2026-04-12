'use client'

import { useMemo, useState } from 'react'
import { Download, Plus, Settings2, Sparkles, Wand2 } from 'lucide-react'

import { useCompanyContext } from '@/hooks/use-company-context'
import { useCurrentForecast } from '@/hooks/use-current-forecast'
import { ViewSwitcher, type ViewType } from '@/components/forecast/ViewSwitcher'
import { ForecastGrid } from '@/components/forecast/ForecastGrid'
import { QuickMetricsGrid } from '@/components/dashboard/MetricCards'
import { MicroForecastWizard } from '@/components/forecast/MicroForecastWizard'
import { BusinessEventsList } from '@/components/forecast/BusinessEventsList'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'
import { useForecastConfigStore } from '@/stores/forecast-config-store'
import { useScenarioStore } from '@/stores/scenario-store'
import { formatAuto } from '@/lib/utils/indian-format'

export default function ForecastPage() {
  const { company, companyId, isLoading: companyLoading } = useCompanyContext()
  const { engineResult, forecastMonths, isReady, accounts } = useCurrentForecast()
  const valueRules = useForecastConfigStore((state) => state.valueRules)
  const updateValueRule = useForecastConfigStore((state) => state.updateValueRule)
  const scenarios = useScenarioStore((state) => state.scenarios)
  const selectedScenarioId = useScenarioStore((state) => state.selectedScenarioId)
  const selectScenario = useScenarioStore((state) => state.select)
  const [activeView, setActiveView] = useState<ViewType>('pl')
  const [showWizard, setShowWizard] = useState(false)
  const [isSavingCell, setIsSavingCell] = useState(false)

  const summary = useMemo(() => {
    const months = engineResult?.rawIntegrationResults ?? []
    const totalExpenses = months.reduce(
      (sum, month) => sum + (month?.pl?.expense ?? 0) + (month?.pl?.cogs ?? 0),
      0
    )
    const cashPosition = months[0]?.bs.cash ?? 0
    const netIncome = months.reduce((sum, month) => sum + (month?.pl?.netIncome ?? 0), 0)
    const monthlyBurn = totalExpenses / Math.max(forecastMonths.length, 1)
    const runway = monthlyBurn > 0 ? cashPosition / monthlyBurn : 12

    return {
      cashPosition,
      netIncome,
      runway: Math.min(runway, 24),
      totalAccounts: accounts.length,
      rulesConfigured: Object.keys(valueRules).length,
    }
  }, [accounts.length, engineResult, forecastMonths.length, valueRules])

  const handleCellEdit = async (accountId: string, monthIndex: number, valuePaise: number) => {
    if (!companyId) return

    const currentRule = valueRules[accountId]
    const baseEntries =
      currentRule?.type === 'direct_entry'
        ? [...currentRule.entries]
        : [...(engineResult?.accountForecasts[accountId] ?? Array(forecastMonths.length).fill(null))]

    while (baseEntries.length < forecastMonths.length) {
      baseEntries.push(null)
    }

    baseEntries[monthIndex] = valuePaise

    setIsSavingCell(true)
    try {
      await updateValueRule(companyId, accountId, {
        type: 'direct_entry',
        accountId,
        entries: baseEntries,
      })
    } finally {
      setIsSavingCell(false)
    }
  }

  if (companyLoading || !isReady) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#059669]" />
          <p className="text-sm text-[#94A3B8]">Preparing forecast...</p>
        </div>
      </div>
    )
  }

  if (!company || !companyId) {
    return (
      <SurfaceCard className="mx-auto mt-12 max-w-2xl p-8 text-center">
        <h2 className="text-xl font-semibold text-[#0F172A]">No active company selected</h2>
        <p className="mt-3 text-sm leading-6 text-[#64748B]">
          Pick a company first so the forecast grid can load the right chart of accounts, actuals, and config.
        </p>
      </SurfaceCard>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Forecast grid"
        title="Forecast Studio"
        description="P&L, balance sheet, and cash flow — inline edits create direct-entry rules."
        badges={
          <>
            <HeaderBadge
              label={
                selectedScenarioId
                  ? scenarios.find((s) => s.id === selectedScenarioId)?.name ?? 'Scenario active'
                  : 'Baseline active'
              }
              tone={selectedScenarioId ? 'success' : 'default'}
            />
            <HeaderBadge label={`${summary.rulesConfigured} value rules`} />
            <HeaderBadge label={`${summary.totalAccounts} mapped accounts`} />
          </>
        }
        actions={
          <>
            <button className="btn-press inline-flex items-center gap-1.5 rounded border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#475569] transition-colors duration-[80ms] hover:border-[#D1D5DB]">
              <Settings2 className="h-3.5 w-3.5" /> Configure
            </button>
            <button className="btn-press inline-flex items-center gap-1.5 rounded border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#475569] transition-colors duration-[80ms] hover:border-[#D1D5DB]">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            <button onClick={() => setShowWizard(true)}
              className="btn-press inline-flex items-center gap-1.5 rounded bg-[#0F172A] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-[80ms] hover:bg-[#1E293B]">
              <Plus className="h-3.5 w-3.5" /> Add Event
            </button>
          </>
        }
      />

      <QuickMetricsGrid
        cashPosition={summary.cashPosition}
        runway={summary.runway}
        netIncome={summary.netIncome}
        workingCapitalDays={42}
      />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_0.8fr]">
        <div className="space-y-4">
          {/* Control bar */}
          <SurfaceCard>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Forecast control</p>
                <p className="text-xs text-[#94A3B8]">Switch statements, compare scenarios</p>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <ViewSwitcher activeView={activeView} onViewChange={setActiveView} />
                <select
                  value={selectedScenarioId ?? 'baseline'}
                  onChange={(e) => selectScenario(e.target.value === 'baseline' ? null : e.target.value)}
                  className="rounded border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="baseline">Baseline forecast</option>
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </SurfaceCard>

          {/* Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  {activeView === 'pl' ? 'Projected P&L' : activeView === 'bs' ? 'Projected Balance Sheet' : 'Projected Cash Flow'}
                </p>
                <p className="text-xs text-[#94A3B8]">
                  {forecastMonths[0]} to {forecastMonths[forecastMonths.length - 1]}
                </p>
              </div>
              {isSavingCell ? (
                <div className="inline-flex items-center gap-1.5 rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 text-xs font-medium text-[#059669]">
                  <div className="h-3 w-3 animate-spin rounded-full border border-[#059669] border-t-transparent" />
                  Saving
                </div>
              ) : null}
            </div>
            <ForecastGrid
              view={activeView}
              accounts={accounts}
              forecastMonths={forecastMonths}
              engineResult={engineResult}
              onCellEdit={handleCellEdit}
            />
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <SurfaceCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Driver summary</p>
                <p className="text-xs text-[#94A3B8]">Rules, events, and scenario context</p>
              </div>
              <Sparkles className="h-4 w-4 text-[#94A3B8]" />
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
                <p className="label-xs">Visible cash</p>
                <p className="mt-1.5 font-num text-xl font-semibold text-[#0F172A]">{formatAuto(summary.cashPosition)}</p>
              </div>
              <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
                <p className="label-xs">Scenario mode</p>
                <p className="mt-1.5 text-sm font-semibold text-[#0F172A]">
                  {selectedScenarioId
                    ? scenarios.find((s) => s.id === selectedScenarioId)?.name ?? 'Custom scenario'
                    : 'Baseline'}
                </p>
              </div>
              <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
                <p className="label-xs">Model assumptions</p>
                <p className="mt-1.5 text-xs leading-5 text-[#64748B]">
                  Inline cell changes create direct-entry rules. Business events flow through the micro-forecast engine.
                </p>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Business events</p>
                <p className="text-xs text-[#94A3B8]">Preview model impact</p>
              </div>
              <Wand2 className="h-4 w-4 text-[#94A3B8]" />
            </div>
            <BusinessEventsList companyId={companyId} />
          </SurfaceCard>
        </div>
      </div>

      {showWizard ? <MicroForecastWizard onClose={() => setShowWizard(false)} /> : null}
    </div>
  )
}
