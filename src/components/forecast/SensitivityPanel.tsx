'use client'

import { useState, useMemo } from 'react'
import { X, TrendingUp, TrendingDown, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAuto } from '@/lib/utils/indian-format'
import type { EngineResult } from '@/lib/engine'
import { useSensitivityStore } from '@/stores/sensitivity-store'

export interface SensitivityParams {
  revenueGrowthPct: number
  expenseGrowthPct: number
  collectionDays: number
  paymentDays: number
}

interface SensitivityPanelProps {
  baselineResult: EngineResult | null
  onClose: () => void
  onRunSensitivity: (params: SensitivityParams) => EngineResult | null
}

const DEFAULT: SensitivityParams = {
  revenueGrowthPct: 0,
  expenseGrowthPct: 0,
  collectionDays: 0,
  paymentDays: 0,
}

interface NumberStepperProps {
  label: string
  hint: string
  value: number
  unit: string
  min: number
  max: number
  step: number
  positiveGood: boolean
  onChange: (v: number) => void
}

function NumberStepper({ label, hint, value, unit, min, max, step, positiveGood, onChange }: NumberStepperProps) {
  const tone = value === 0 ? 'neutral'
    : (value > 0) === positiveGood ? 'good'
    : 'bad'

  const valueColor = tone === 'good' ? 'text-[#059669]' : tone === 'bad' ? 'text-[#DC2626]' : 'text-[#64748B]'

  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#0F172A]">{label}</p>
          <p className="mt-0.5 text-[10px] leading-4 text-[#94A3B8]">{hint}</p>
        </div>
        <span className={cn('shrink-0 font-num text-sm font-bold tabular-nums', valueColor)}>
          {value > 0 ? '+' : ''}{value}{unit}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] text-sm font-bold text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A] transition-colors"
        >−</button>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
          className="flex-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1.5 text-center text-sm font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/10 transition-colors"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] text-sm font-bold text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A] transition-colors"
        >+</button>
      </div>
      {/* Visual bar */}
      <div className="mt-2 h-1 w-full rounded-full bg-[#F1F5F9]">
        <div
          className={cn('h-1 rounded-full transition-all', tone === 'good' ? 'bg-[#059669]' : tone === 'bad' ? 'bg-[#DC2626]' : 'bg-[#94A3B8]')}
          style={{ width: `${Math.abs(value) / Math.abs(value > 0 ? max : min) * 100}%`, marginLeft: value < 0 ? 'auto' : undefined }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-[#CBD5E1]">
        <span>{min}{unit}</span>
        <span>0</span>
        <span>+{max}{unit}</span>
      </div>
    </div>
  )
}

function ImpactRow({ label, baseline, adjusted, unit = '' }: { label: string; baseline: number; adjusted: number; unit?: string }) {
  const delta = adjusted - baseline
  const pct = baseline !== 0 ? (delta / Math.abs(baseline)) * 100 : 0
  const isPositive = delta > 0

  return (
    <div className="flex items-center justify-between py-2 border-b border-[#F1F5F9] last:border-0">
      <p className="text-xs text-[#64748B]">{label}</p>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#94A3B8] tabular-nums">{unit}{formatAuto(baseline)}</span>
        <span className="text-[10px] text-[#CBD5E1]">→</span>
        <span className="text-xs font-semibold text-[#0F172A] tabular-nums">{unit}{formatAuto(adjusted)}</span>
        {delta !== 0 && (
          <span className={cn(
            'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold',
            isPositive ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'
          )}>
            {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {isPositive ? '+' : ''}{pct.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

export function SensitivityPanel({ baselineResult, onClose, onRunSensitivity }: SensitivityPanelProps) {
  const [params, setParams] = useState<SensitivityParams>(DEFAULT)
  const sensitivity = useSensitivityStore()

  const hasChanges = params.revenueGrowthPct !== 0 || params.expenseGrowthPct !== 0 ||
    params.collectionDays !== 0 || params.paymentDays !== 0

  // Sync local params to global sensitivity store so the live forecast updates in real-time
  const updateParam = (key: keyof SensitivityParams, value: number) => {
    const next = { ...params, [key]: value }
    setParams(next)
    sensitivity.set({
      revenueAdjPct: next.revenueGrowthPct,
      expenseAdjPct: next.expenseGrowthPct,
      arDelayDays: next.collectionDays,
    })
  }

  const handleReset = () => {
    setParams(DEFAULT)
    sensitivity.reset()
  }

  const sensitivityResult = useMemo(() => {
    if (!baselineResult || !hasChanges) return null
    return onRunSensitivity(params)
  }, [baselineResult, params, onRunSensitivity, hasChanges])

  const impact = useMemo(() => {
    if (!baselineResult) return null
    const base = baselineResult.integrationResults
    const sens = sensitivityResult?.integrationResults ?? base

    const baseCash = base[base.length - 1]?.bs.cash ?? 0
    const sensCash = sens[sens.length - 1]?.bs.cash ?? 0
    const baseIncome = base.reduce((s, m) => s + m.pl.netIncome, 0)
    const sensIncome = sens.reduce((s, m) => s + m.pl.netIncome, 0)
    const baseOCF = base.reduce((s, m) => s + m.cf.operatingCashFlow, 0)
    const sensOCF = sens.reduce((s, m) => s + m.cf.operatingCashFlow, 0)
    const baseRevenue = base.reduce((s, m) => s + m.pl.revenue, 0)
    const sensRevenue = sens.reduce((s, m) => s + m.pl.revenue, 0)

    return { baseCash, sensCash, baseIncome, sensIncome, baseOCF, sensOCF, baseRevenue, sensRevenue }
  }, [baselineResult, sensitivityResult])

  return (
    <div className="flex h-full flex-col bg-[#F8FAFC]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">What-If Analysis</p>
          <p className="text-[10px] text-[#94A3B8]">Adjust assumptions, see impact instantly</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Controls */}
        <div className="space-y-2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Adjust Assumptions</p>

          <NumberStepper
            label="Revenue Growth"
            hint="Apply % change to all revenue accounts"
            value={params.revenueGrowthPct}
            unit="%"
            min={-50} max={50} step={5}
            positiveGood={true}
            onChange={v => updateParam('revenueGrowthPct', v)}
          />
          <NumberStepper
            label="Expense Growth"
            hint="Apply % change to all expense accounts"
            value={params.expenseGrowthPct}
            unit="%"
            min={-50} max={50} step={5}
            positiveGood={false}
            onChange={v => updateParam('expenseGrowthPct', v)}
          />
          <NumberStepper
            label="Collection Days (AR)"
            hint="Days to collect from customers. Lower = faster cash"
            value={params.collectionDays}
            unit="d"
            min={-30} max={30} step={5}
            positiveGood={false}
            onChange={v => updateParam('collectionDays', v)}
          />
          <NumberStepper
            label="Payment Days (AP)"
            hint="Days to pay suppliers. Higher = more cash retained"
            value={params.paymentDays}
            unit="d"
            min={-30} max={30} step={5}
            positiveGood={true}
            onChange={v => updateParam('paymentDays', v)}
          />

          {hasChanges && (
            <button
              onClick={handleReset}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A] transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to baseline
            </button>
          )}
        </div>

        {/* Impact */}
        {impact && (
          <div className="border-t border-[#E2E8F0] bg-white p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              {hasChanges ? 'Adjusted vs Baseline' : 'Baseline Metrics'}
            </p>
            <div>
              <ImpactRow label="Total Revenue" baseline={impact.baseRevenue} adjusted={impact.sensRevenue} />
              <ImpactRow label="Net Income" baseline={impact.baseIncome} adjusted={impact.sensIncome} />
              <ImpactRow label="Operating Cash Flow" baseline={impact.baseOCF} adjusted={impact.sensOCF} />
              <ImpactRow label="Closing Cash" baseline={impact.baseCash} adjusted={impact.sensCash} />
            </div>

            {!hasChanges && (
              <p className="mt-3 text-[10px] text-[#94A3B8]">
                Adjust the controls above to see how changes affect your forecast.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
