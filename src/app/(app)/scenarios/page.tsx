'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, SlidersHorizontal } from 'lucide-react'
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#0F172A]">{title}</span>
        <span className="label-xs">{rows.length} drivers</span>
      </div>
      {rows.map((account) => {
        const value = adjustments[account.id] ?? 0
        return (
          <div key={account.id} className="rounded border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm text-[#334155]">{account.name}</span>
              <span className={cn('font-num text-sm font-semibold', value > 0 && 'text-[#059669]', value < 0 && 'text-[#DC2626]', value === 0 && 'text-[#94A3B8]')}>
                {value > 0 ? '+' : ''}{value}%
              </span>
            </div>
            <input type="range" min={-50} max={50} step={5} value={value}
              onChange={(e) => setAdjustments((c) => ({ ...c, [account.id]: Number(e.target.value) }))}
              className="mt-2 w-full accent-[#059669]" />
          </div>
        )
      })}
    </div>
  )

  return (
    <SurfaceCard className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Scenario editor — {scenario.name}</p>
          <p className="text-xs text-[#94A3B8]">Adjust account-level growth percentages</p>
        </div>
        <button onClick={save}
          className="btn-press inline-flex items-center gap-1.5 rounded bg-[#0F172A] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-[80ms] hover:bg-[#1E293B]">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Save
        </button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
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
      <div className="grid grid-cols-2 gap-4">
        <SurfaceCard className="border-[#A7F3D0]">
          <p className="label-xs text-[#059669]">Best case — {best.name}</p>
          <p className="mt-2 font-num text-xl font-bold text-[#059669]">{formatAuto(best.value)}</p>
          <p className="mt-1 text-xs text-[#94A3B8]">{chartMetric === 'cash' ? 'Closing cash' : 'Net income'} · end of forecast</p>
        </SurfaceCard>
        <SurfaceCard className="border-[#FECACA]">
          <p className="label-xs text-[#DC2626]">Worst case — {worst.name}</p>
          <p className="mt-2 font-num text-xl font-bold text-[#DC2626]">{formatAuto(worst.value)}</p>
          <p className="mt-1 text-xs text-[#94A3B8]">{chartMetric === 'cash' ? 'Closing cash' : 'Net income'} · end of forecast</p>
        </SurfaceCard>
      </div>

      <SurfaceCard>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Scenario comparison</p>
            <p className="text-xs text-[#94A3B8]">Full three-way engine run per scenario — not an approximation</p>
          </div>
          <div className="inline-flex rounded border border-[#E5E7EB] bg-[#F8FAFC] p-0.5">
            {(['cash', 'netIncome'] as const).map((m) => (
              <button key={m} onClick={() => setChartMetric(m)}
                className={cn('rounded px-2.5 py-1 text-xs font-medium transition-colors duration-[80ms]',
                  chartMetric === m ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#94A3B8] hover:text-[#475569]')}>
                {m === 'cash' ? 'Cash Position' : 'Net Income'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => formatValue(v)} />
            <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', color: '#0F172A', fontSize: '12px' }}
              formatter={(value: unknown) => typeof value === 'number' ? [formatValue(value), ''] : [String(value ?? ''), '']} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {seriesNames.map((name, i) => (
              <Line key={name} type="monotone" dataKey={name}
                stroke={colors[i % colors.length]}
                strokeWidth={name === 'Baseline' ? 2 : 1.5}
                dot={false}
                strokeDasharray={name === 'Baseline' ? undefined : '4 2'} />
            ))}
          </LineChart>
        </ResponsiveContainer>
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
