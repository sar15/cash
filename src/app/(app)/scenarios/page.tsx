'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useCompanyContext } from '@/hooks/use-company-context'
import { useCurrentForecast } from '@/hooks/use-current-forecast'
import {
  getScenarioAdjustments, useScenarioStore, type Scenario, type ScenarioAdjustment,
} from '@/stores/scenario-store'
import { useAccountsStore } from '@/stores/accounts-store'
import { useActualsStore } from '@/stores/actuals-store'
import { useForecastConfigStore } from '@/stores/forecast-config-store'
import { useMicroForecastStore } from '@/stores/micro-forecast-store'
import { runScenarioForecastEngine } from '@/lib/engine/scenarios/engine'
import type { ScenarioDefinition } from '@/lib/engine/scenarios/types'
import type { AccountInput } from '@/lib/engine'
import { cn } from '@/lib/utils'
import { formatAuto } from '@/lib/utils/indian-format'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'

function CreateScenarioModal({ onSave, onClose }: { onSave: (name: string, description: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <SurfaceCard className="w-full max-w-lg p-6">
        <h2 className="text-base font-semibold text-[#0F172A]">New scenario</h2>
        <p className="mt-1 text-sm text-[#64748B]">
          Create a named case for best, worst, or strategic planning.
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <label className="label-xs">Scenario name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New plant expansion"
              className="surface-input mt-1.5" autoFocus />
          </div>
          <div>
            <label className="label-xs">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the planning assumption this scenario answers." rows={3}
              className="surface-input mt-1.5" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}
            className="btn-press rounded border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#475569] transition-colors duration-[80ms] hover:border-[#D1D5DB]">
            Cancel
          </button>
          <button onClick={() => name.trim() && onSave(name.trim(), description.trim())} disabled={!name.trim()}
            className="btn-press rounded bg-[#0F172A] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-[80ms] hover:bg-[#1E293B] disabled:cursor-not-allowed disabled:opacity-40">
            Create
          </button>
        </div>
      </SurfaceCard>
    </div>
  )
}

function OverrideEditor({ scenario, onSave }: { scenario: Scenario; onSave: (scenarioId: string, overrides: ScenarioAdjustment[]) => void }) {
  const accounts = useAccountsStore((state) => state.accounts)
  const [adjustments, setAdjustments] = useState<Record<string, number>>(() =>
    Object.fromEntries(getScenarioAdjustments(scenario).map((a) => [a.accountId, a.adjustmentPct]))
  )

  const revenueAccounts = accounts.filter((a) => a.accountType === 'revenue')
  const expenseAccounts = accounts.filter((a) => a.accountType === 'expense')

  const save = () => {
    const normalized = Object.entries(adjustments)
      .map(([accountId, adjustmentPct]) => ({ accountId, adjustmentPct }))
      .filter((a) => a.adjustmentPct !== 0)
    onSave(scenario.id, normalized)
  }

  const renderGroup = (title: string, rows: typeof accounts) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">{title}</span>
        <span className="text-xs text-[#94A3B8]">{rows.length} accounts</span>
      </div>
      {rows.map((account) => {
        const value = adjustments[account.id] ?? 0
        return (
          <div key={account.id} className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 hover:border-[#CBD5E1] transition-colors">
            <span className="flex-1 truncate text-sm text-[#334155]">{account.name}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAdjustments(c => ({ ...c, [account.id]: Math.max(-100, (c[account.id] ?? 0) - 5) }))}
                className="flex h-6 w-6 items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A] transition-colors text-xs font-bold"
              >−</button>
              <div className="relative">
                <input
                  type="number"
                  min={-100}
                  max={200}
                  step={1}
                  value={value}
                  onChange={(e) => setAdjustments(c => ({ ...c, [account.id]: Number(e.target.value) }))}
                  className="w-16 rounded border border-[#E2E8F0] bg-white px-2 py-1 text-center text-sm font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/10"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] pointer-events-none">%</span>
              </div>
              <button
                type="button"
                onClick={() => setAdjustments(c => ({ ...c, [account.id]: Math.min(200, (c[account.id] ?? 0) + 5) }))}
                className="flex h-6 w-6 items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A] transition-colors text-xs font-bold"
              >+</button>
            </div>
            <span className={cn(
              'w-12 text-right text-xs font-semibold tabular-nums',
              value > 0 ? 'text-[#059669]' : value < 0 ? 'text-[#DC2626]' : 'text-[#94A3B8]'
            )}>
              {value > 0 ? '+' : ''}{value}%
            </span>
          </div>
        )
      })}
    </div>
  )

  return (
    <SurfaceCard>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Edit — {scenario.name}</p>
          <p className="text-xs text-[#94A3B8]">Set % adjustment per account. Positive = growth, negative = decline.</p>
        </div>
        <button onClick={save}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E293B]">
          Save adjustments
        </button>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {renderGroup('Revenue', revenueAccounts)}
        {renderGroup('Expenses', expenseAccounts)}
      </div>
    </SurfaceCard>
  )
}

function ScenarioCompareChart({ scenarios, months }: { scenarios: Scenario[]; months: string[] }) {
  const [chartMetric, setChartMetric] = useState<'netIncome' | 'cash'>('cash')

  // Read all the data needed to run the engine per scenario
  const accounts = useAccountsStore((s) => s.accounts)
  const getHistoricalValues = useActualsStore((s) => s.getHistoricalValues)
  const valueRules = useForecastConfigStore((s) => s.valueRules)
  const timingProfiles = useForecastConfigStore((s) => s.timingProfiles)
  const complianceConfig = useForecastConfigStore((s) => s.complianceConfig)
  const microForecastItems = useMicroForecastStore((s) => s.items)

  // Run the engine for each scenario (baseline + all named scenarios)
  const scenarioResults = useMemo(() => {
    if (accounts.length === 0 || months.length === 0) return {}

    const accountInputs: AccountInput[] = accounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
      category: acc.accountType === 'revenue' ? 'Revenue'
        : acc.accountType === 'expense' && (acc.standardMapping?.startsWith('cogs') ?? false) ? 'COGS'
        : acc.accountType === 'expense' ? 'Operating Expenses'
        : acc.accountType === 'asset' ? 'Assets'
        : acc.accountType === 'liability' ? 'Liabilities'
        : 'Equity' as AccountInput['category'],
      historicalValues: getHistoricalValues(acc.id),
    }))

    const complianceCfg = complianceConfig ? {
      gstRatePct: complianceConfig.gstRate,
      inputTaxCreditPct: complianceConfig.itcPct,
      advanceTaxRatePct: complianceConfig.taxRate,
      supplyType: complianceConfig.supplyType,
    } : undefined

    const results: Record<string, { netIncome: number[]; cash: number[] }> = {}

    // Baseline (no scenario)
    try {
      const baseResult = runScenarioForecastEngine({
        accounts: accountInputs, forecastMonthLabels: months,
        scenario: null, valueRules, timingProfiles, microForecastItems, complianceConfig: complianceCfg,
      })
      results['Baseline'] = {
        netIncome: baseResult.rawIntegrationResults.map(m => m?.pl?.netIncome ?? 0),
        cash: baseResult.rawIntegrationResults.map(m => m?.bs?.cash ?? 0),
      }
    } catch { results['Baseline'] = { netIncome: Array(months.length).fill(0), cash: Array(months.length).fill(0) } }

    // Each named scenario
    scenarios.forEach((s) => {
      try {
        const def: ScenarioDefinition = {
          id: s.id, name: s.name,
          baselineAdjustments: getScenarioAdjustments(s).map(a => ({ accountId: a.accountId, adjustmentPct: a.adjustmentPct })),
          timingProfileOverrides: [], microForecastToggles: [],
        }
        const result = runScenarioForecastEngine({
          accounts: accountInputs, forecastMonthLabels: months,
          scenario: def, valueRules, timingProfiles, microForecastItems, complianceConfig: complianceCfg,
        })
        results[s.name] = {
          netIncome: result.rawIntegrationResults.map(m => m?.pl?.netIncome ?? 0),
          cash: result.rawIntegrationResults.map(m => m?.bs?.cash ?? 0),
        }
      } catch { results[s.name] = { netIncome: Array(months.length).fill(0), cash: Array(months.length).fill(0) } }
    })

    return results
  }, [accounts, months, getHistoricalValues, valueRules, timingProfiles, complianceConfig, microForecastItems, scenarios])

  const seriesNames = ['Baseline', ...scenarios.map(s => s.name)]
  const colors = ['#059669', '#2563EB', '#D97706', '#DC2626', '#64748B']

  const data = months.map((month, i) => {
    const point: Record<string, string | number> = { month }
    seriesNames.forEach(name => {
      const series = scenarioResults[name]
      const val = chartMetric === 'cash' ? (series?.cash[i] ?? 0) : (series?.netIncome[i] ?? 0)
      point[name] = Math.round(val / 100) // rupees for chart scale
    })
    return point
  })

  const formatValue = (v: number) => formatAuto(v * 100)

  // Best/Worst at end of forecast
  const lastIdx = months.length - 1
  const endValues = seriesNames.map(name => {
    const series = scenarioResults[name]
    const val = chartMetric === 'cash' ? (series?.cash[lastIdx] ?? 0) : (series?.netIncome[lastIdx] ?? 0)
    return { name, value: val }
  })
  const best = endValues.reduce((a, b) => a.value > b.value ? a : b, endValues[0] ?? { name: 'Baseline', value: 0 })
  const worst = endValues.reduce((a, b) => a.value < b.value ? a : b, endValues[0] ?? { name: 'Baseline', value: 0 })

  return (
    <div className="space-y-4">
      {/* Best/Worst summary row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Best Case</p>
          <p className="mt-1.5 text-lg font-bold text-[#059669] tabular-nums">{formatAuto(best.value)}</p>
          <p className="mt-0.5 text-xs text-[#64748B]">{best.name}</p>
        </div>
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Worst Case</p>
          <p className="mt-1.5 text-lg font-bold text-[#DC2626] tabular-nums">{formatAuto(worst.value)}</p>
          <p className="mt-0.5 text-xs text-[#64748B]">{worst.name}</p>
        </div>
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Scenarios</p>
          <p className="mt-1.5 text-lg font-bold text-[#0F172A] tabular-nums">{seriesNames.length}</p>
          <p className="mt-0.5 text-xs text-[#64748B]">incl. baseline</p>
        </div>
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Spread</p>
          <p className="mt-1.5 text-lg font-bold text-[#2563EB] tabular-nums">{formatAuto(Math.abs(best.value - worst.value))}</p>
          <p className="mt-0.5 text-xs text-[#64748B]">best vs worst</p>
        </div>
      </div>

      {/* Chart */}
      <SurfaceCard>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Scenario comparison</p>
            <p className="text-xs text-[#94A3B8]">Full three-way engine run per scenario</p>
          </div>
          <div className="flex rounded-lg border border-[#E2E8F0] overflow-hidden">
            {(['cash', 'netIncome'] as const).map((m) => (
              <button key={m} onClick={() => setChartMetric(m)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  chartMetric === m
                    ? 'bg-[#0F172A] text-white'
                    : 'bg-white text-[#64748B] hover:text-[#0F172A]'
                )}>
                {m === 'cash' ? 'Cash Position' : 'Net Income'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatValue(v)} width={72} />
            <Tooltip
              contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', fontSize: '12px', fontFamily: 'Inter' }}
              formatter={(value: unknown, name: unknown) => typeof value === 'number' ? [formatValue(value), String(name)] : [String(value ?? ''), String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'Inter', paddingTop: '12px' }} />
            {seriesNames.map((name, i) => (
              <Line key={name} type="monotone" dataKey={name}
                stroke={colors[i % colors.length]}
                strokeWidth={name === 'Baseline' ? 2.5 : 1.5}
                dot={false}
                strokeDasharray={name === 'Baseline' ? undefined : '5 3'}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </SurfaceCard>

      {/* End-of-period comparison table */}
      <SurfaceCard>
        <p className="mb-3 text-sm font-semibold text-[#0F172A]">End-of-period comparison</p>
        <div className="overflow-x-auto">
          <table className="fin-table w-full">
            <thead>
              <tr>
                <th className="text-left">Scenario</th>
                <th>Closing Cash</th>
                <th>Net Income</th>
                <th>vs Baseline</th>
              </tr>
            </thead>
            <tbody>
              {seriesNames.map((name, i) => {
                const series = scenarioResults[name]
                const cash = series?.cash[lastIdx] ?? 0
                const ni = series?.netIncome[lastIdx] ?? 0
                const baseCash = scenarioResults['Baseline']?.cash[lastIdx] ?? 0
                const delta = cash - baseCash
                return (
                  <tr key={name} className="hover-row">
                    <td className="!font-sans">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                        <span className={cn('text-sm font-medium', name === 'Baseline' ? 'text-[#0F172A]' : 'text-[#334155]')}>{name}</span>
                      </div>
                    </td>
                    <td className="font-semibold text-[#0F172A]">{formatAuto(cash)}</td>
                    <td className={cn('font-semibold', ni >= 0 ? 'text-[#059669]' : 'text-[#DC2626]')}>{formatAuto(ni)}</td>
                    <td className={cn('font-semibold', name === 'Baseline' ? 'text-[#94A3B8]' : delta >= 0 ? 'text-[#059669]' : 'text-[#DC2626]')}>
                      {name === 'Baseline' ? '—' : `${delta >= 0 ? '+' : ''}${formatAuto(delta)}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>
  )
}

export default function ScenariosPage() {
  const { companyId, company, isLoading: companyLoading } = useCompanyContext()
  const { forecastMonths } = useCurrentForecast()
  const scenarios = useScenarioStore((s) => s.scenarios)
  const selectedScenarioId = useScenarioStore((s) => s.selectedScenarioId)
  const loadScenarios = useScenarioStore((s) => s.load)
  const createScenario = useScenarioStore((s) => s.create)
  const removeScenario = useScenarioStore((s) => s.remove)
  const saveOverrides = useScenarioStore((s) => s.saveOverrides)
  const selectScenario = useScenarioStore((s) => s.select)
  const scenarioLoading = useScenarioStore((s) => s.isLoading)

  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => { if (companyId) void loadScenarios(companyId) }, [companyId, loadScenarios])

  const editingScenario = scenarios.find((s) => s.id === editingId) ?? null

  const handleCreate = useCallback(async (name: string, description: string) => {
    if (!companyId) return; await createScenario(companyId, { name, description }); setShowCreate(false)
  }, [companyId, createScenario])

  const handleSaveOverrides = useCallback(async (scenarioId: string, overrides: ScenarioAdjustment[]) => {
    await saveOverrides(scenarioId, overrides); setEditingId(null)
  }, [saveOverrides])

  if (companyLoading || scenarioLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#059669]" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Scenario manager"
        title="Scenario Planner"
        description={`Create best-case, downside, and custom planning for ${company?.name ?? 'your company'}`}
        badges={
          <>
            <HeaderBadge label={`${scenarios.length} saved`} />
            <HeaderBadge label={selectedScenarioId ? 'Scenario active' : 'Baseline active'} tone={selectedScenarioId ? 'success' : 'default'} />
          </>
        }
        actions={
          <button onClick={() => setShowCreate(true)}
            className="btn-press inline-flex items-center gap-1.5 rounded bg-[#0F172A] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-[80ms] hover:bg-[#1E293B]">
            <Plus className="h-3.5 w-3.5" /> New scenario
          </button>
        }
      />

      {scenarios.length === 0 ? (
        <div className="space-y-4">
          {/* Scenario templates */}
          <SurfaceCard>
            <p className="text-sm font-semibold text-[#0F172A]">Quick start with a template</p>
            <p className="mt-1 text-xs text-[#94A3B8]">Create a named scenario from a preset, then customize the assumptions.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { name: 'Best Case', desc: 'Revenue +20%, expenses flat', color: 'border-[#A7F3D0] bg-[#ECFDF5]', textColor: 'text-[#059669]', revAdj: 20, expAdj: 0 },
                { name: 'Base Case', desc: 'Current trajectory, no changes', color: 'border-[#E5E7EB] bg-[#F8FAFC]', textColor: 'text-[#475569]', revAdj: 0, expAdj: 0 },
                { name: 'Worst Case', desc: 'Revenue -20%, expenses +10%', color: 'border-[#FECACA] bg-[#FEF2F2]', textColor: 'text-[#DC2626]', revAdj: -20, expAdj: 10 },
              ].map((template) => (
                <button
                  key={template.name}
                  onClick={async () => {
                    if (!companyId) return
                    const scenario = await createScenario(companyId, { name: template.name, description: template.desc })
                    // Apply template adjustments to all revenue/expense accounts
                    const accounts = useAccountsStore.getState().accounts
                    const overrides = [
                      ...accounts.filter(a => a.accountType === 'revenue').map(a => ({ accountId: a.id, adjustmentPct: template.revAdj })),
                      ...accounts.filter(a => a.accountType === 'expense').map(a => ({ accountId: a.id, adjustmentPct: -template.expAdj })),
                    ].filter(o => o.adjustmentPct !== 0)
                    if (overrides.length > 0) await saveOverrides(scenario.id, overrides)
                    setShowCreate(false)
                  }}
                  className={`btn-press rounded-lg border p-4 text-left transition-colors duration-[80ms] hover:opacity-90 ${template.color}`}
                >
                  <p className={`text-sm font-semibold ${template.textColor}`}>{template.name}</p>
                  <p className="mt-1 text-xs text-[#64748B]">{template.desc}</p>
                </button>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard className="py-10 text-center">
            <p className="text-sm font-semibold text-[#0F172A]">Or create a custom scenario</p>
            <p className="mt-1 text-xs text-[#94A3B8]">Name it, describe it, then adjust individual account assumptions.</p>
            <button onClick={() => setShowCreate(true)}
              className="btn-press mt-4 inline-flex items-center gap-1.5 rounded bg-[#0F172A] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-[80ms] hover:bg-[#1E293B]">
              <Plus className="h-3.5 w-3.5" /> New custom scenario
            </button>
          </SurfaceCard>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="fin-table w-full">
            <thead>
              <tr>
                <th className="text-left">Scenario</th>
                <th className="text-left">Description</th>
                <th>Adjustments</th>
                <th className="text-left">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => {
                const adjustments = getScenarioAdjustments(s)
                const isActive = selectedScenarioId === s.id
                return (
                  <tr key={s.id} className="hover-row">
                    <td className="!font-sans font-semibold text-[#0F172A]">{s.name}</td>
                    <td className="!font-sans text-[#64748B]">{s.description || '—'}</td>
                    <td className="text-center">{adjustments.length}</td>
                    <td className="!font-sans">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-medium text-[#059669]">
                          <span className="health-dot health-dot-green" /> Active
                        </span>
                      ) : <span className="text-xs text-[#94A3B8]">Inactive</span>}
                    </td>
                    <td className="!font-sans text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => { setEditingId(s.id); selectScenario(s.id) }}
                          className="btn-press rounded border border-[#E5E7EB] px-2 py-1 text-xs text-[#475569] transition-colors duration-[80ms] hover:border-[#D1D5DB]">
                          Edit
                        </button>
                        <button onClick={() => selectScenario(isActive ? null : s.id)}
                          className="btn-press rounded border border-[#E5E7EB] px-2 py-1 text-xs text-[#2563EB] transition-colors duration-[80ms] hover:border-[#2563EB]">
                          {isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => removeScenario(s.id)}
                          className="btn-press rounded border border-[#E5E7EB] p-1 text-[#94A3B8] transition-colors duration-[80ms] hover:border-[#FECACA] hover:text-[#DC2626]">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingScenario && <OverrideEditor key={editingScenario.id} scenario={editingScenario} onSave={handleSaveOverrides} />}
      {scenarios.length > 0 && forecastMonths.length > 0 && <ScenarioCompareChart scenarios={scenarios} months={forecastMonths} />}
      {showCreate && <CreateScenarioModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}
    </div>
  )
}
