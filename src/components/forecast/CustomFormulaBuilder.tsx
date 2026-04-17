'use client'

/**
 * Custom Formula Builder
 *
 * Lets users create KPI formulas like Fathom:
 * - Pick accounts from a searchable list
 * - Use +, -, ×, ÷ operators
 * - Use built-in aggregates (REVENUE, COGS, etc.)
 * - Preview result instantly
 * - Name and format the KPI
 */

import { useState, useMemo, useCallback } from 'react'
import { X, Plus, Search, ChevronDown, Info, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAuto } from '@/lib/utils/indian-format'
import type { Account } from '@/stores/accounts-store'
import type { EngineResult } from '@/lib/engine'
import type { CustomFormula } from '@/lib/engine/formula-evaluator'
import {
  evaluateFormula,
  validateFormula,
  BUILTIN_TOKENS,
} from '@/lib/engine/formula-evaluator'
import { useFormulaStore } from '@/stores/formula-store'

interface Props {
  companyId: string
  accounts: Account[]
  engineResult: EngineResult | null
  onClose: () => void
  editingFormula?: CustomFormula | null
}

const FORMAT_OPTIONS: { value: CustomFormula['format']; label: string; example: string }[] = [
  { value: 'currency', label: 'Currency (₹)', example: '₹42.1L' },
  { value: 'percent',  label: 'Percentage (%)', example: '38.5%' },
  { value: 'number',   label: 'Number', example: '1,234' },
  { value: 'days',     label: 'Days', example: '28d' },
]

const OPERATOR_BUTTONS = [
  { label: '+', title: 'Add' },
  { label: '−', title: 'Subtract', value: '-' },
  { label: '×', title: 'Multiply', value: '*' },
  { label: '÷', title: 'Divide', value: '/' },
  { label: '(', title: 'Open bracket' },
  { label: ')', title: 'Close bracket' },
]

function formatValue(value: number | null, format: CustomFormula['format']): string {
  if (value === null || !isFinite(value)) return '—'
  switch (format) {
    case 'currency': return formatAuto(value)
    case 'percent':  return `${value.toFixed(1)}%`
    case 'days':     return `${Math.round(value)}d`
    case 'number':   return value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  }
}

export function CustomFormulaBuilder({ companyId, accounts, engineResult, onClose, editingFormula }: Props) {
  const addFormula = useFormulaStore(s => s.add)
  const updateFormula = useFormulaStore(s => s.update)

  const [name, setName] = useState(editingFormula?.name ?? '')
  const [expression, setExpression] = useState(editingFormula?.expression ?? '')
  const [format, setFormat] = useState<CustomFormula['format']>(editingFormula?.format ?? 'currency')
  const [description, setDescription] = useState(editingFormula?.description ?? '')
  const [accountSearch, setAccountSearch] = useState('')
  const [showBuiltins, setShowBuiltins] = useState(false)
  const [saved, setSaved] = useState(false)

  const plAccounts = useMemo(() =>
    accounts.filter(a => a.accountType === 'revenue' || a.accountType === 'expense'),
    [accounts]
  )

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.toLowerCase()
    return q ? plAccounts.filter(a => a.name.toLowerCase().includes(q)) : plAccounts
  }, [plAccounts, accountSearch])

  const validationError = useMemo(() => {
    if (!expression.trim()) return null
    return validateFormula(expression, accounts.map(a => a.id))
  }, [expression, accounts])

  // Preview: evaluate for all months and show avg
  const previewValues = useMemo(() => {
    if (!engineResult || !expression.trim() || validationError) return null
    const formula: CustomFormula = { id: 'preview', name, expression, format, companyId }
    return evaluateFormula(formula, engineResult)
  }, [engineResult, expression, validationError, name, format, companyId])

  const previewAvg = useMemo(() => {
    if (!previewValues) return null
    const nonNull = previewValues.filter((v): v is number => v !== null)
    return nonNull.length > 0 ? nonNull.reduce((s, v) => s + v, 0) / nonNull.length : null
  }, [previewValues])

  const insertToken = useCallback((token: string) => {
    setExpression(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + token + ' ')
  }, [])

  const handleSave = useCallback(() => {
    if (!name.trim() || !expression.trim() || validationError) return

    if (editingFormula) {
      updateFormula(editingFormula.id, { name, expression, format, description })
    } else {
      addFormula({ name, expression, format, description, companyId })
    }

    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 800)
  }, [name, expression, format, description, companyId, editingFormula, addFormula, updateFormula, validationError, onClose])

  const canSave = name.trim() && expression.trim() && !validationError

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="flex w-full max-w-2xl flex-col rounded-xl border border-[#E2E8F0] bg-white shadow-xl max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A]">
              {editingFormula ? 'Edit Formula KPI' : 'Create Formula KPI'}
            </h2>
            <p className="mt-0.5 text-[11px] text-[#94A3B8]">
              Build a custom metric using your accounts and built-in aggregates
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: account picker */}
          <div className="w-56 shrink-0 border-r border-[#E2E8F0] flex flex-col">
            <div className="border-b border-[#E2E8F0] p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Accounts</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="text"
                  value={accountSearch}
                  onChange={e => setAccountSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-md border border-[#E2E8F0] bg-white py-1.5 pl-8 pr-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredAccounts.map(account => (
                <button
                  key={account.id}
                  onClick={() => insertToken(`[${account.id}]`)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[#F8FAFC]"
                  title={`Insert [${account.id}]`}
                >
                  <span className={cn(
                    'mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase',
                    account.accountType === 'revenue' ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'
                  )}>
                    {account.accountType === 'revenue' ? 'Rev' : 'Exp'}
                  </span>
                  <span className="truncate text-xs text-[#334155]">{account.name}</span>
                </button>
              ))}
            </div>

            {/* Built-in aggregates */}
            <div className="border-t border-[#E2E8F0] p-2">
              <button
                onClick={() => setShowBuiltins(v => !v)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8] hover:bg-[#F8FAFC] transition-colors"
              >
                Built-in totals
                <ChevronDown className={cn('h-3 w-3 transition-transform', showBuiltins && 'rotate-180')} />
              </button>
              {showBuiltins && (
                <div className="mt-1 space-y-0.5">
                  {Object.entries(BUILTIN_TOKENS).map(([token, label]) => (
                    <button
                      key={token}
                      onClick={() => insertToken(token)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[#EFF6FF]"
                    >
                      <span className="rounded bg-[#EFF6FF] px-1 py-0.5 text-[9px] font-bold text-[#2563EB]">{token}</span>
                      <span className="truncate text-[11px] text-[#64748B]">{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: formula editor */}
          <div className="flex flex-1 flex-col overflow-y-auto p-5 space-y-4">
            {/* Name */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748B]">KPI Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Gross Margin %, Revenue per Employee"
                autoFocus
                className="mt-1.5 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/10 transition-colors"
              />
            </div>

            {/* Formula expression */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748B]">Formula</label>
                <div className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
                  <Info className="h-3 w-3" />
                  Click accounts on the left to insert them
                </div>
              </div>

              {/* Operator buttons */}
              <div className="mb-2 flex items-center gap-1">
                {OPERATOR_BUTTONS.map(op => (
                  <button
                    key={op.label}
                    onClick={() => insertToken(op.value ?? op.label)}
                    title={op.title}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-sm font-semibold text-[#475569] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] transition-colors"
                  >
                    {op.label}
                  </button>
                ))}
                <div className="mx-1 h-4 w-px bg-[#E2E8F0]" />
                {['100', '12', '30'].map(n => (
                  <button
                    key={n}
                    onClick={() => insertToken(n)}
                    className="flex h-7 items-center justify-center rounded-md border border-[#E2E8F0] bg-white px-2 text-xs font-semibold text-[#475569] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] transition-colors"
                  >
                    {n}
                  </button>
                ))}
              </div>

              <textarea
                value={expression}
                onChange={e => setExpression(e.target.value)}
                placeholder="e.g. (REVENUE - COGS) / REVENUE * 100"
                rows={3}
                className={cn(
                  'w-full resize-none rounded-lg border bg-white px-3 py-2 font-mono text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-1 transition-colors',
                  validationError
                    ? 'border-[#FECACA] focus:border-[#DC2626] focus:ring-[#DC2626]/10'
                    : 'border-[#E2E8F0] focus:border-[#2563EB] focus:ring-[#2563EB]/10'
                )}
              />

              {validationError && (
                <p className="mt-1 text-[11px] text-[#DC2626]">{validationError}</p>
              )}

              {/* Examples */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  { label: 'Gross Margin %', expr: '(REVENUE - COGS) / REVENUE * 100', fmt: 'percent' as const },
                  { label: 'Net Margin %', expr: 'NET_INCOME / REVENUE * 100', fmt: 'percent' as const },
                  { label: 'Cash Flow Margin', expr: 'OCF / REVENUE * 100', fmt: 'percent' as const },
                  { label: 'Free Cash Flow', expr: 'OCF + FCF', fmt: 'currency' as const },
                ].map(ex => (
                  <button
                    key={ex.label}
                    onClick={() => { setExpression(ex.expr); setFormat(ex.fmt); if (!name) setName(ex.label) }}
                    className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 text-[11px] font-medium text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A] transition-colors"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748B]">Format</label>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {FORMAT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left transition-colors',
                      format === opt.value
                        ? 'border-[#0F172A] bg-[#0F172A] text-white'
                        : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]'
                    )}
                  >
                    <p className="text-xs font-semibold">{opt.label}</p>
                    <p className={cn('text-[10px]', format === opt.value ? 'text-white/60' : 'text-[#94A3B8]')}>{opt.example}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748B]">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does this KPI measure?"
                className="mt-1.5 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:border-[#2563EB] focus:outline-none transition-colors"
              />
            </div>

            {/* Preview */}
            {previewValues && previewAvg !== null && (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Preview</p>
                <div className="flex items-baseline gap-3">
                  <p className="font-num text-2xl font-bold text-[#0F172A]">
                    {formatValue(previewAvg, format)}
                  </p>
                  <p className="text-xs text-[#94A3B8]">12-month average</p>
                </div>
                {/* Mini sparkline of monthly values */}
                <div className="mt-3 flex items-end gap-1 h-8">
                  {previewValues.map((v, i) => {
                    const nonNull = previewValues.filter((x): x is number => x !== null)
                    const min = Math.min(...nonNull)
                    const max = Math.max(...nonNull)
                    const range = max - min || 1
                    const height = v !== null ? Math.max(4, ((v - min) / range) * 28) : 4
                    return (
                      <div
                        key={i}
                        className={cn('flex-1 rounded-sm transition-all', v !== null && v >= 0 ? 'bg-[#2563EB]' : 'bg-[#DC2626]')}
                        style={{ height: `${height}px`, opacity: v !== null ? 0.7 : 0.2 }}
                        title={`${engineResult?.forecastMonths[i]}: ${formatValue(v, format)}`}
                      />
                    )
                  })}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-[#94A3B8]">
                  <span>{engineResult?.forecastMonths[0]}</span>
                  <span>{engineResult?.forecastMonths[engineResult.forecastMonths.length - 1]}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E2E8F0] px-5 py-3">
          <button onClick={onClose} className="text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors',
              saved
                ? 'bg-[#ECFDF5] text-[#059669]'
                : canSave
                ? 'bg-[#0F172A] text-white hover:bg-[#1E293B]'
                : 'cursor-not-allowed bg-[#F1F5F9] text-[#94A3B8]'
            )}
          >
            {saved ? <><Check className="h-4 w-4" /> Saved</> : <><Plus className="h-4 w-4" /> {editingFormula ? 'Update KPI' : 'Add KPI'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
