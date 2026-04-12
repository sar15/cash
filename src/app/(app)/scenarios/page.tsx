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

function ScenarioCompareChart({ scenarios, baseline, months }: { scenarios: Scenario[]; baseline: number[]; months: string[] }) {
  const data = months.map((month, i) => {
    const point: Record<string, string | number> = { month, Baseline: Math.round((baseline[i] ?? 0) / 100) }
    scenarios.forEach((s) => {
      const adj = getScenarioAdjustments(s)
      const avg = adj.length > 0 ? adj.reduce((sum, a) => sum + a.adjustmentPct, 0) / adj.length : 0
      point[s.name] = Math.round(((baseline[i] ?? 0) * (100 + avg)) / 100 / 100)
    })
    return point
  })

  return (
    <SurfaceCard>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Scenario comparison</p>
          <p className="text-xs text-[#94A3B8]">Net income trajectory across saved cases</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false}
            tickFormatter={(v) => `${v / 100000}L`} />
          <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', color: '#0F172A', fontSize: '12px' }}
            formatter={(value) => typeof value === 'number' ? formatAuto(Math.round(value * 100)) : ''} />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Line type="monotone" dataKey="Baseline" stroke="#059669" strokeWidth={2} dot={false} />
          {scenarios.map((s, i) => (
            <Line key={s.id} type="monotone" dataKey={s.name}
              stroke={['#2563EB', '#D97706', '#DC2626', '#64748B'][i % 4]} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </SurfaceCard>
  )
}

export default function ScenariosPage() {
  const { companyId, company, isLoading: companyLoading } = useCompanyContext()
  const { engineResult, forecastMonths } = useCurrentForecast()
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

  const baselineSeries = useMemo(() => engineResult?.rawIntegrationResults.map((m) => m?.pl?.netIncome ?? 0) ?? [], [engineResult])
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
        <SurfaceCard className="py-12 text-center">
          <p className="text-sm text-[#94A3B8]">No scenarios yet. Create one to stress-test your forecast.</p>
        </SurfaceCard>
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
      {scenarios.length > 0 && baselineSeries.length > 0 && <ScenarioCompareChart scenarios={scenarios} baseline={baselineSeries} months={forecastMonths} />}
      {showCreate && <CreateScenarioModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}
    </div>
  )
}
