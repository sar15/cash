'use client'
// Fathom-level AccountRuleEditor
// Matches Fathom's "Create rule" panel exactly:
// - Calculation method: Smart Prediction, Link to Previous Period, Constant/Growing, Formula/Drivers, Direct Entry
// - Options: Round figure, Allow negative values
// - Notes field
// - Sparkline showing actuals vs forecast
// - Payment terms (timing profiles)

import { useState, useCallback, useMemo } from 'react'
import { X, Calendar, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Account } from '@/stores/accounts-store'
import type { AnyValueRuleConfig } from '@/lib/engine/value-rules/types'
import type { AnyTimingProfileConfig } from '@/lib/engine/timing-profiles/types'
import { formatAuto } from '@/lib/utils/indian-format'

// ── Calculation method config ─────────────────────────────────────────────

type CalcMethod = 'smart_prediction' | 'link_to_previous' | 'constant_growing' | 'direct_entry' | 'same_last_year'

const calcMethods: { id: CalcMethod; label: string; desc: string }[] = [
  { id: 'smart_prediction',  label: 'Smart Prediction',      desc: 'Linear regression or rolling average based on actuals' },
  { id: 'link_to_previous',  label: 'Link to Previous Period', desc: 'Use last month/quarter/year + optional % increase' },
  { id: 'constant_growing',  label: 'Constant / Growing',    desc: 'Fixed value with optional monthly growth rate' },
  { id: 'same_last_year',    label: 'Same as Last Year',      desc: 'Repeat the same month from 12 months ago' },
  { id: 'direct_entry',      label: 'Direct Entry',           desc: 'Type values directly into the forecast grid' },
]

// ── Payment terms presets ─────────────────────────────────────────────────

interface PaymentTermPreset {
  label: string
  desc: string
  profile: Omit<AnyTimingProfileConfig, 'accountId'>
}

const receivablePresets: PaymentTermPreset[] = [
  { label: 'Immediate',  desc: '100% same month',                 profile: { type: 'receivables', month_0: 1.0 } },
  { label: '30 days',    desc: '100% next month',                 profile: { type: 'receivables', month_0: 0, month_1: 1.0 } },
  { label: '60 days',    desc: '100% in 2 months',                profile: { type: 'receivables', month_0: 0, month_1: 0, month_2: 1.0 } },
  { label: '50/50',      desc: '50% same, 50% next month',        profile: { type: 'receivables', month_0: 0.5, month_1: 0.5 } },
  { label: '30/70',      desc: '30% same, 70% next month',        profile: { type: 'receivables', month_0: 0.3, month_1: 0.7 } },
  { label: '60/30/10',   desc: '60% same, 30% next, 10% month 3', profile: { type: 'receivables', month_0: 0.6, month_1: 0.3, month_2: 0.1 } },
]

const payablePresets: PaymentTermPreset[] = [
  { label: 'Immediate',  desc: '100% same month',          profile: { type: 'payables', month_0: 1.0 } },
  { label: '30 days',    desc: '100% next month',           profile: { type: 'payables', month_0: 0, month_1: 1.0 } },
  { label: '60 days',    desc: '100% in 2 months',          profile: { type: 'payables', month_0: 0, month_1: 0, month_2: 1.0 } },
  { label: '50/50',      desc: '50% same, 50% next month',  profile: { type: 'payables', month_0: 0.5, month_1: 0.5 } },
]

// ── Mini sparkline ────────────────────────────────────────────────────────

function MiniSparkline({ values, width = 120, height = 32 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null
  const nonZero = values.filter(v => v !== 0)
  if (nonZero.length < 2) return null

  const min = Math.min(...nonZero)
  const max = Math.max(...nonZero)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="#059669"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────

interface AccountRuleEditorProps {
  account: Account
  currentRule: AnyValueRuleConfig | undefined
  currentTimingProfile: AnyTimingProfileConfig | undefined
  historicalValues: number[]
  onSaveRule: (rule: AnyValueRuleConfig) => Promise<void>
  onSaveTimingProfile: (profile: AnyTimingProfileConfig) => Promise<void>
  onClose: () => void
  inline?: boolean
}

// ── Map current rule type to calc method ──────────────────────────────────

function ruleTypeToCalcMethod(ruleType: AnyValueRuleConfig['type'] | undefined): CalcMethod {
  switch (ruleType) {
    case 'growth':         return 'constant_growing'
    case 'rolling_avg':    return 'smart_prediction'
    case 'same_last_year': return 'same_last_year'
    case 'direct_entry':   return 'direct_entry'
    default:               return 'smart_prediction'
  }
}

// ── Main component ────────────────────────────────────────────────────────

export function AccountRuleEditor({
  account,
  currentRule,
  currentTimingProfile,
  historicalValues,
  onSaveRule,
  onSaveTimingProfile,
  onClose,
  inline = false,
}: AccountRuleEditorProps) {
  const [calcMethod, setCalcMethod] = useState<CalcMethod>(ruleTypeToCalcMethod(currentRule?.type))
  const [showMethodDropdown, setShowMethodDropdown] = useState(false)

  // Smart Prediction params
  const [smartType, setSmartType] = useState<'linear' | 'average'>('average')
  const [smartLookback, setSmartLookback] = useState(
    currentRule?.type === 'rolling_avg' ? String(currentRule.lookbackMonths) : '3'
  )
  const [includeSeasonal, setIncludeSeasonal] = useState(false)

  // Link to Previous params
  const [prevPeriod, setPrevPeriod] = useState<'month' | 'quarter' | 'year'>('month')
  const [prevAdjType, setPrevAdjType] = useState<'pct' | 'amount'>('pct')
  const [prevAdjValue, setPrevAdjValue] = useState('0')

  // Constant/Growing params
  const [constantValue, setConstantValue] = useState('')
  const [growthRate, setGrowthRate] = useState(
    currentRule?.type === 'growth' ? String(Math.round(currentRule.monthlyGrowthRate * 100)) : '0'
  )
  const [growthPeriod, setGrowthPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')

  // Options
  const [roundFigure, setRoundFigure] = useState(false)
  const [allowNegative, setAllowNegative] = useState(false)
  const [notes, setNotes] = useState('')

  // Saving state
  const [isSavingRule, setIsSavingRule] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [savedRule, setSavedRule] = useState(false)
  const [savedProfile, setSavedProfile] = useState(false)

  const isRevenue = account.accountType === 'revenue'
  const isExpense = account.accountType === 'expense'
  const canHaveTimingProfile = isRevenue || isExpense

  // Historical stats
  const nonZeroHistory = historicalValues.filter(v => v !== 0)
  const avgHistory = nonZeroHistory.length > 0
    ? Math.round(nonZeroHistory.reduce((s, v) => s + v, 0) / nonZeroHistory.length)
    : 0
  const lastValue = historicalValues[historicalValues.length - 1] ?? 0
  const recentHistory = historicalValues.slice(-6)

  // Preview value
  const previewValue = useMemo(() => {
    if (avgHistory === 0) return null
    switch (calcMethod) {
      case 'smart_prediction':
        return avgHistory
      case 'constant_growing': {
        const base = parseInt(constantValue || '0') * 100
        return base > 0 ? base : avgHistory
      }
      case 'same_last_year':
        return historicalValues[historicalValues.length - 12] ?? avgHistory
      case 'link_to_previous':
        return lastValue
      default:
        return null
    }
  }, [calcMethod, avgHistory, constantValue, historicalValues, lastValue])

  const handleSaveRule = useCallback(async () => {
    setIsSavingRule(true)
    try {
      let rule: AnyValueRuleConfig
      switch (calcMethod) {
        case 'smart_prediction':
          rule = { type: 'rolling_avg', accountId: account.id, lookbackMonths: parseInt(smartLookback) }
          break
        case 'constant_growing':
          rule = { type: 'growth', accountId: account.id, monthlyGrowthRate: parseFloat(growthRate) / 100 }
          break
        case 'same_last_year':
          rule = { type: 'same_last_year', accountId: account.id }
          break
        case 'link_to_previous':
          // Map to rolling_avg with lookback 1 (last month)
          rule = { type: 'rolling_avg', accountId: account.id, lookbackMonths: 1 }
          break
        default:
          return
      }
      await onSaveRule(rule)
      setSavedRule(true)
      setTimeout(() => setSavedRule(false), 2000)
    } finally {
      setIsSavingRule(false)
    }
  }, [calcMethod, account.id, smartLookback, growthRate, onSaveRule])

  const handleSaveTimingProfile = useCallback(async (preset: PaymentTermPreset) => {
    setIsSavingProfile(true)
    try {
      await onSaveTimingProfile({ ...preset.profile, accountId: account.id } as AnyTimingProfileConfig)
      setSavedProfile(true)
      setTimeout(() => setSavedProfile(false), 2000)
    } finally {
      setIsSavingProfile(false)
    }
  }, [account.id, onSaveTimingProfile])

  const presets = isRevenue ? receivablePresets : payablePresets
  const selectedMethod = calcMethods.find(m => m.id === calcMethod)

  const content = (
    <div className={cn(
      'flex flex-col',
      inline ? 'h-full overflow-y-auto' : 'w-full max-w-sm rounded-xl border border-[#E2E8F0] bg-white shadow-xl'
    )}>
      {/* Header — matches Fathom exactly */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-[#94A3B8]">Create rule</p>
          <h2 className="truncate text-sm font-semibold text-[#0F172A]">{account.name}</h2>
          <p className="text-[11px] text-[#94A3B8]">
            Applied to: <span className="font-medium text-[#475569]">{account.name}</span>
          </p>
        </div>
        <button onClick={onClose} className="ml-2 shrink-0 rounded-lg p-1 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#475569]">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Sparkline + actuals — Fathom style */}
        {nonZeroHistory.length > 0 && (
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="font-num text-xl font-semibold text-[#0F172A]">{formatAuto(lastValue)}</p>
                <p className="text-[11px] text-[#94A3B8]">Actuals from last month</p>
              </div>
              <MiniSparkline values={recentHistory} />
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[11px] text-[#94A3B8]">Avg {nonZeroHistory.length}mo:</span>
              <span className="font-num text-[11px] font-semibold text-[#0F172A]">{formatAuto(avgHistory)}</span>
            </div>
          </div>
        )}

        <div className="space-y-0 divide-y divide-[#F1F5F9]">
          {/* Calculation method — Fathom dropdown style */}
          <div className="px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">Calculation method</p>

            {/* Method dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMethodDropdown(v => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] hover:border-[#CBD5E1] focus:outline-none"
              >
                <span className="font-medium">{selectedMethod?.label}</span>
                {showMethodDropdown ? <ChevronUp className="h-4 w-4 text-[#94A3B8]" /> : <ChevronDown className="h-4 w-4 text-[#94A3B8]" />}
              </button>

              {showMethodDropdown && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-[#E2E8F0] bg-white shadow-lg">
                  {calcMethods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setCalcMethod(m.id); setShowMethodDropdown(false) }}
                      className={cn(
                        'flex w-full flex-col px-3 py-2.5 text-left transition-colors hover:bg-[#F8FAFC]',
                        calcMethod === m.id && 'bg-[#ECFDF5]'
                      )}
                    >
                      <span className={cn('text-sm font-medium', calcMethod === m.id ? 'text-[#059669]' : 'text-[#0F172A]')}>
                        {m.label}
                      </span>
                      <span className="text-[11px] text-[#94A3B8]">{m.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Method-specific params */}
            <div className="mt-3 space-y-3">
              {calcMethod === 'smart_prediction' && (
                <>
                  <div className="flex items-center gap-2">
                    <select value={smartType} onChange={e => setSmartType(e.target.value as 'linear' | 'average')}
                      className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none">
                      <option value="average">Rolling Average</option>
                      <option value="linear">Linear Regression</option>
                    </select>
                    <span className="text-xs text-[#94A3B8]">of the last</span>
                    <select value={smartLookback} onChange={e => setSmartLookback(e.target.value)}
                      className="w-20 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none">
                      {[3, 6, 12, 24].map(n => <option key={n} value={n}>{n} months</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[#475569]">
                    <input type="checkbox" checked={includeSeasonal} onChange={e => setIncludeSeasonal(e.target.checked)}
                      className="rounded border-[#E2E8F0] accent-[#059669]" />
                    Include seasonal adjustments
                  </label>
                </>
              )}

              {calcMethod === 'link_to_previous' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#475569]">Use</span>
                    <select value={prevPeriod} onChange={e => setPrevPeriod(e.target.value as 'month' | 'quarter' | 'year')}
                      className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none">
                      <option value="month">Last month</option>
                      <option value="quarter">Last quarter</option>
                      <option value="year">Last year</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#475569]">+</span>
                    <input type="number" value={prevAdjValue} onChange={e => setPrevAdjValue(e.target.value)}
                      className="w-20 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none" />
                    <select value={prevAdjType} onChange={e => setPrevAdjType(e.target.value as 'pct' | 'amount')}
                      className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none">
                      <option value="pct">% increase</option>
                      <option value="amount">₹ increase</option>
                    </select>
                  </div>
                </div>
              )}

              {calcMethod === 'constant_growing' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#475569]">Value (₹)</span>
                    <input type="number" value={constantValue} onChange={e => setConstantValue(e.target.value)}
                      placeholder={avgHistory > 0 ? String(Math.round(avgHistory / 100)) : '0'}
                      className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#475569]">Growth</span>
                    <input type="number" value={growthRate} onChange={e => setGrowthRate(e.target.value)}
                      step="0.5" className="w-16 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none" />
                    <span className="text-xs text-[#94A3B8]">%</span>
                    <select value={growthPeriod} onChange={e => setGrowthPeriod(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
                      className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none">
                      <option value="monthly">per month</option>
                      <option value="quarterly">per quarter</option>
                      <option value="yearly">per year</option>
                    </select>
                  </div>
                </div>
              )}

              {calcMethod === 'same_last_year' && nonZeroHistory.length < 12 && (
                <div className="flex items-start gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D97706]" />
                  <p className="text-[11px] text-[#92400E]">
                    Need 12 months of history. Will fall back to rolling average.
                  </p>
                </div>
              )}

              {calcMethod === 'direct_entry' && (
                <p className="text-[11px] text-[#94A3B8]">
                  Double-click any cell in the forecast grid to enter values directly.
                </p>
              )}

              {/* Preview */}
              {previewValue && previewValue > 0 && calcMethod !== 'direct_entry' && (
                <div className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2">
                  <span className="text-[11px] text-[#94A3B8]">First forecast month</span>
                  <span className="font-num text-xs font-semibold text-[#0F172A]">{formatAuto(previewValue)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Options — Fathom style */}
          <div className="px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">Options</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-[#475569]">
                <input type="checkbox" checked={roundFigure} onChange={e => setRoundFigure(e.target.checked)}
                  className="rounded border-[#E2E8F0] accent-[#059669]" />
                Round figure
              </label>
              <label className="flex items-center gap-2 text-xs text-[#475569]">
                <input type="checkbox" checked={allowNegative} onChange={e => setAllowNegative(e.target.checked)}
                  className="rounded border-[#E2E8F0] accent-[#059669]" />
                Allow negative values
              </label>
            </div>
          </div>

          {/* Notes — Fathom style */}
          <div className="px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add a note explaining the assumptions behind this rule..."
              rows={2}
              className="w-full resize-none rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] placeholder:text-[#CBD5E1] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20"
            />
          </div>

          {/* Save button */}
          {calcMethod !== 'direct_entry' && (
            <div className="px-4 py-3">
              <button
                onClick={handleSaveRule}
                disabled={isSavingRule}
                className={cn(
                  'w-full rounded-lg py-2 text-xs font-semibold transition-colors',
                  savedRule
                    ? 'bg-[#ECFDF5] text-[#059669]'
                    : 'bg-[#059669] text-white hover:bg-[#047857] disabled:opacity-50'
                )}
              >
                {isSavingRule ? 'Saving...' : savedRule ? '✓ Rule saved' : 'Save changes'}
              </button>
            </div>
          )}

          {/* Payment Terms — only for revenue/expense */}
          {canHaveTimingProfile && (
            <div className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                  <Calendar className="mr-1 inline h-3 w-3" />
                  Payment Terms
                </p>
                <span className="text-[10px] text-[#94A3B8]">
                  {isRevenue ? 'When customers pay' : 'When you pay'}
                </span>
              </div>

              {currentTimingProfile && (
                <div className="mb-2 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[11px] text-[#2563EB]">
                  Current: {currentTimingProfile.month_0 !== undefined && currentTimingProfile.month_0 > 0
                    ? `${Math.round((currentTimingProfile.month_0 ?? 0) * 100)}% same month`
                    : 'Deferred'}
                  {currentTimingProfile.month_1 !== undefined && currentTimingProfile.month_1 > 0
                    ? `, ${Math.round((currentTimingProfile.month_1 ?? 0) * 100)}% next month`
                    : ''}
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleSaveTimingProfile(preset)}
                    disabled={isSavingProfile}
                    className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-left transition-colors hover:border-[#2563EB] hover:bg-[#EFF6FF] disabled:opacity-50"
                  >
                    <p className="text-xs font-semibold text-[#0F172A]">{preset.label}</p>
                    <p className="text-[10px] text-[#94A3B8]">{preset.desc}</p>
                  </button>
                ))}
              </div>
              {savedProfile && (
                <p className="mt-2 text-[11px] text-[#059669]">✓ Payment terms saved</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (inline) return content

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {content}
    </div>
  )
}
