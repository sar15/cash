'use client'

/**
 * MicroForecastWizard — Business event wizard
 * Light theme, matches app design system.
 * 6 event types: hire, revenue, asset, loan, expense, price_change
 */

import { useState, useCallback } from 'react'
import { useMicroForecastStore, type WizardType } from '@/stores/micro-forecast-store'
import { useCurrentForecast } from '@/hooks/use-current-forecast'
import {
  X, Loader2, UserPlus, TrendingUp, Package, Landmark, Receipt, TrendingDown, ChevronLeft,
} from 'lucide-react'
import type { NewHireWizardInputs } from '@/lib/engine/micro-forecasts/wizards/new-hire'
import type { RevenueWizardInputs } from '@/lib/engine/micro-forecasts/wizards/revenue'
import type { AssetWizardInputs } from '@/lib/engine/micro-forecasts/wizards/asset'
import type { LoanWizardInputs } from '@/lib/engine/micro-forecasts/wizards/loan'
import type { OneTimeExpenseWizardInputs } from '@/lib/engine/micro-forecasts/wizards/one-time-expense'
import type { PriceChangeWizardInputs } from '@/lib/engine/micro-forecasts/wizards/price-change'
import { formatAuto } from '@/lib/utils/indian-format'
import { cn } from '@/lib/utils'

// ── Event type config ─────────────────────────────────────────────────────

const wizardTypes: {
  id: WizardType
  label: string
  desc: string
  icon: typeof UserPlus
  iconColor: string
  iconBg: string
}[] = [
  { id: 'hire',         label: 'New Hire',        desc: 'Salary, PF, ESI for a new employee',    icon: UserPlus,     iconColor: 'text-[#2563EB]', iconBg: 'bg-[#EFF6FF]' },
  { id: 'revenue',      label: 'New Revenue',      desc: 'New client or recurring revenue stream', icon: TrendingUp,   iconColor: 'text-[#059669]', iconBg: 'bg-[#ECFDF5]' },
  { id: 'asset',        label: 'Asset Purchase',   desc: 'CapEx with depreciation schedule',       icon: Package,      iconColor: 'text-[#D97706]', iconBg: 'bg-[#FFFBEB]' },
  { id: 'loan',         label: 'Loan / Financing', desc: 'Debt with EMI repayment schedule',       icon: Landmark,     iconColor: 'text-[#0D9488]', iconBg: 'bg-[#F0FDFA]' },
  { id: 'expense',      label: 'One-Time Expense', desc: 'Marketing, office move, any one-off',    icon: Receipt,      iconColor: 'text-[#DC2626]', iconBg: 'bg-[#FEF2F2]' },
  { id: 'price_change', label: 'Price Change',     desc: 'Revenue up/down % from a start month',  icon: TrendingDown, iconColor: 'text-[#0891B2]', iconBg: 'bg-[#ECFEFF]' },
]

// ── Shared helpers ────────────────────────────────────────────────────────

function monthLabelFromInput(value: string): string {
  const [y, m] = value.split('-')
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[parseInt(m) - 1]}-${y.slice(-2)}`
}

const inputCls = 'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/20 transition-colors'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">{label}</label>
      {hint && <p className="mt-0.5 text-[10px] text-[#94A3B8]">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function ImpactBadge({ children, tone }: { children: React.ReactNode; tone: 'green' | 'amber' | 'red' | 'blue' | 'teal' }) {
  const styles = {
    green:  'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]',
    amber:  'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]',
    red:    'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]',
    blue:   'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A5F]',
    teal: 'border-[#CCFBF1] bg-[#F0FDFA] text-[#0F766E]',
  }
  return (
    <div className={cn('rounded-lg border px-3 py-2 text-xs', styles[tone])}>
      {children}
    </div>
  )
}

function SubmitBtn({ disabled, isSubmitting, label, onClick }: { disabled: boolean; isSubmitting: boolean; label: string; onClick?: () => void }) {
  return (
    <button disabled={disabled || isSubmitting} onClick={onClick}
      className="w-full rounded-lg bg-[#059669] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#047857] disabled:opacity-40">
      {isSubmitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : label}
    </button>
  )
}

// ── Individual forms ──────────────────────────────────────────────────────

function HireForm({ onSubmit, isSubmitting }: { onSubmit: (d: NewHireWizardInputs) => void; isSubmitting: boolean }) {
  const [role, setRole] = useState('')
  const [ctc, setCtc] = useState('')
  const [startMonth, setStartMonth] = useState('')
  const ctcPaise = parseInt(ctc || '0') * 100

  return (
    <div className="space-y-4">
      <Field label="Role / Title">
        <input type="text" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Senior Developer" className={inputCls} autoFocus />
      </Field>
      <Field label="Monthly CTC (₹)" hint="Total cost to company including all benefits">
        <input type="number" value={ctc} onChange={e => setCtc(e.target.value)} placeholder="e.g. 80000" className={inputCls} />
      </Field>
      <Field label="Start Month">
        <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)} className={inputCls} />
      </Field>
      {ctcPaise > 0 && (
        <ImpactBadge tone="blue">
          Annual cost: <strong>{formatAuto(ctcPaise * 12)}</strong> · Net salary ~{formatAuto(Math.round(ctcPaise * 0.8))}/mo · Statutory ~{formatAuto(Math.round(ctcPaise * 0.2))}/mo
        </ImpactBadge>
      )}
      <SubmitBtn disabled={!role || !ctc || !startMonth} isSubmitting={isSubmitting} label="Add Hire to Forecast"
        onClick={() => onSubmit({ role, monthlyCTC: parseInt(ctc) * 100, startMonth: monthLabelFromInput(startMonth), netSalaryPct: 0.8, statutoryPct: 0.2 })} />
    </div>
  )
}

function RevenueForm({ onSubmit, isSubmitting }: { onSubmit: (d: RevenueWizardInputs) => void; isSubmitting: boolean }) {
  const [name, setName] = useState('')
  const [monthly, setMonthly] = useState('')
  const [startMonth, setStartMonth] = useState('')
  const [collectionPct, setCollectionPct] = useState('100')
  const monthlyPaise = parseInt(monthly || '0') * 100

  return (
    <div className="space-y-4">
      <Field label="Client / Stream Name">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp retainer" className={inputCls} autoFocus />
      </Field>
      <Field label="Monthly Revenue (₹)" hint="Exclusive of GST">
        <input type="number" value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="e.g. 200000" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start Month">
          <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Collection %" hint="Same-month cash">
          <input type="number" value={collectionPct} onChange={e => setCollectionPct(e.target.value)} min="0" max="100" className={inputCls} />
        </Field>
      </div>
      {monthlyPaise > 0 && (
        <ImpactBadge tone="green">
          Annual revenue: <strong>{formatAuto(monthlyPaise * 12)}</strong> · {collectionPct}% collected same month
        </ImpactBadge>
      )}
      <SubmitBtn disabled={!name || !monthly || !startMonth} isSubmitting={isSubmitting} label="Add Revenue to Forecast"
        onClick={() => onSubmit({ clientName: name, monthlyAmount: parseInt(monthly) * 100, startMonth: monthLabelFromInput(startMonth), gstRate: 18, collectionPctSameMonth: parseInt(collectionPct) })} />
    </div>
  )
}

function AssetForm({ onSubmit, isSubmitting }: { onSubmit: (d: AssetWizardInputs) => void; isSubmitting: boolean }) {
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [usefulLife, setUsefulLife] = useState('60')
  const [purchaseMonth, setPurchaseMonth] = useState('')
  const costPaise = parseInt(cost || '0') * 100
  const monthlyDep = costPaise > 0 ? Math.round(costPaise / parseInt(usefulLife || '60')) : 0

  return (
    <div className="space-y-4">
      <Field label="Asset Name">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CNC Machine" className={inputCls} autoFocus />
      </Field>
      <Field label="Purchase Cost (₹)">
        <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="e.g. 2500000" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Useful Life (months)">
          <input type="number" value={usefulLife} onChange={e => setUsefulLife(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Purchase Month">
          <input type="month" value={purchaseMonth} onChange={e => setPurchaseMonth(e.target.value)} className={inputCls} />
        </Field>
      </div>
      {costPaise > 0 && (
        <ImpactBadge tone="amber">
          Cash outflow: <strong>{formatAuto(costPaise)}</strong> in purchase month · Monthly depreciation: {formatAuto(monthlyDep)}
        </ImpactBadge>
      )}
      <SubmitBtn disabled={!name || !cost || !purchaseMonth} isSubmitting={isSubmitting} label="Add Asset to Forecast"
        onClick={() => onSubmit({ assetName: name, purchaseAmount: parseInt(cost) * 100, usefulLifeMonths: parseInt(usefulLife), purchaseMonth: monthLabelFromInput(purchaseMonth), salvageValue: 0 })} />
    </div>
  )
}

function LoanForm({ onSubmit, isSubmitting }: { onSubmit: (d: LoanWizardInputs) => void; isSubmitting: boolean }) {
  const [name, setName] = useState('')
  const [principal, setPrincipal] = useState('')
  const [rate, setRate] = useState('12')
  const [tenure, setTenure] = useState('36')
  const [startMonth, setStartMonth] = useState('')
  const principalPaise = parseInt(principal || '0') * 100
  const monthlyRate = parseFloat(rate || '12') / 100 / 12
  const tenureMonths = parseInt(tenure || '36')
  const emi = principalPaise > 0 && monthlyRate > 0
    ? Math.round(principalPaise * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / (Math.pow(1 + monthlyRate, tenureMonths) - 1))
    : 0

  return (
    <div className="space-y-4">
      <Field label="Loan Name">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Equipment Loan" className={inputCls} autoFocus />
      </Field>
      <Field label="Principal Amount (₹)">
        <input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="e.g. 5000000" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Annual Rate (%)">
          <input type="number" value={rate} onChange={e => setRate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Tenure (months)">
          <input type="number" value={tenure} onChange={e => setTenure(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Drawdown Month">
        <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)} className={inputCls} />
      </Field>
      {emi > 0 && (
        <ImpactBadge tone="teal">
          Approx. EMI: <strong>{formatAuto(emi)}/month</strong> · Total repayment: {formatAuto(emi * tenureMonths)}
        </ImpactBadge>
      )}
      <SubmitBtn disabled={!name || !principal || !startMonth} isSubmitting={isSubmitting} label="Add Loan to Forecast"
        onClick={() => onSubmit({ loanName: name, principalAmount: parseInt(principal) * 100, annualInterestRate: parseFloat(rate), termMonths: parseInt(tenure), startMonth: monthLabelFromInput(startMonth) })} />
    </div>
  )
}

function ExpenseForm({ onSubmit, isSubmitting }: { onSubmit: (d: OneTimeExpenseWizardInputs) => void; isSubmitting: boolean }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState('')
  const amountPaise = parseInt(amount || '0') * 100

  return (
    <div className="space-y-4">
      <Field label="Expense Name">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Marketing campaign, Office relocation" className={inputCls} autoFocus />
      </Field>
      <Field label="Amount (₹)" hint="One-time cash outflow">
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 500000" className={inputCls} />
      </Field>
      <Field label="Month">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={inputCls} />
      </Field>
      {amountPaise > 0 && (
        <ImpactBadge tone="red">
          Cash outflow: <strong>{formatAuto(amountPaise)}</strong> in selected month · P&L expense: same month
        </ImpactBadge>
      )}
      <SubmitBtn disabled={!name || !amount || !month} isSubmitting={isSubmitting} label="Add Expense to Forecast"
        onClick={() => onSubmit({ expenseName: name, amount: parseInt(amount) * 100, month: monthLabelFromInput(month), isCash: true })} />
    </div>
  )
}

function PriceChangeForm({ onSubmit, isSubmitting }: { onSubmit: (d: PriceChangeWizardInputs) => void; isSubmitting: boolean }) {
  const { engineResult } = useCurrentForecast()
  const [label, setLabel] = useState('')
  const [changePct, setChangePct] = useState('10')
  const [startMonth, setStartMonth] = useState('')
  const baselineRevenue = engineResult
    ? Math.round(engineResult.rawIntegrationResults.reduce((s, m) => s + (m?.pl?.revenue ?? 0), 0) / Math.max(engineResult.rawIntegrationResults.length, 1))
    : 0
  const delta = baselineRevenue > 0 ? Math.round(baselineRevenue * parseFloat(changePct || '0') / 100) : 0
  const isPositive = parseFloat(changePct || '0') >= 0

  return (
    <div className="space-y-4">
      <Field label="Label" hint="Describe what's changing">
        <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Price increase Q3, Discount campaign" className={inputCls} autoFocus />
      </Field>
      <Field label="Revenue Change (%)" hint="Positive = increase, negative = decrease">
        <input type="number" value={changePct} onChange={e => setChangePct(e.target.value)} placeholder="e.g. 10 or -5" className={inputCls} />
      </Field>
      <Field label="Effective From">
        <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)} className={inputCls} />
      </Field>
      {baselineRevenue > 0 && delta !== 0 && (
        <ImpactBadge tone={isPositive ? 'green' : 'red'}>
          Baseline avg: {formatAuto(baselineRevenue)}/mo · Monthly delta: <strong>{isPositive ? '+' : ''}{formatAuto(delta)}</strong>
        </ImpactBadge>
      )}
      <SubmitBtn disabled={!label || !startMonth} isSubmitting={isSubmitting} label="Add Price Change to Forecast"
        onClick={() => onSubmit({ label, baselineMonthlyRevenue: baselineRevenue, changePct: parseFloat(changePct), startMonth: monthLabelFromInput(startMonth) })} />
    </div>
  )
}

// ── Main wizard modal ─────────────────────────────────────────────────────

interface WizardModalProps {
  onClose: () => void
}

export function MicroForecastWizard({ onClose }: WizardModalProps) {
  const [selectedType, setSelectedType] = useState<WizardType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addHire, addRevenue, addAsset, addLoan, addExpense, addPriceChange } = useMicroForecastStore()

  const handleSubmit = useCallback(async (type: WizardType, data: unknown) => {
    setIsSubmitting(true)
    try {
      switch (type) {
        case 'hire':         await addHire(data as NewHireWizardInputs); break
        case 'revenue':      await addRevenue(data as RevenueWizardInputs); break
        case 'asset':        await addAsset(data as AssetWizardInputs); break
        case 'loan':         await addLoan(data as LoanWizardInputs); break
        case 'expense':      await addExpense(data as OneTimeExpenseWizardInputs); break
        case 'price_change': await addPriceChange(data as PriceChangeWizardInputs); break
      }
      onClose()
    } catch (err) {
      console.error('[Wizard] Save error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [addHire, addRevenue, addAsset, addLoan, addExpense, addPriceChange, onClose])

  const selectedMeta = wizardTypes.find(w => w.id === selectedType)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-center gap-3">
            {selectedType && (
              <button onClick={() => setSelectedType(null)} className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#475569]">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {selectedMeta && (
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', selectedMeta.iconBg)}>
                <selectedMeta.icon className={cn('h-4 w-4', selectedMeta.iconColor)} />
              </div>
            )}
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">
                {selectedMeta ? selectedMeta.label : 'Add Business Event'}
              </h2>
              <p className="text-[11px] text-[#94A3B8]">
                {selectedMeta ? selectedMeta.desc : 'Model a real-world change and see its cash impact instantly'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#475569]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Type selector */}
          {!selectedType && (
            <div className="grid grid-cols-2 gap-2">
              {wizardTypes.map((wt) => (
                <button
                  key={wt.id}
                  onClick={() => setSelectedType(wt.id)}
                  className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 text-left transition-all hover:border-[#CBD5E1] hover:shadow-sm"
                >
                  <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', wt.iconBg)}>
                    <wt.icon className={cn('h-4 w-4', wt.iconColor)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{wt.label}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-[#94A3B8]">{wt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Forms */}
          {selectedType === 'hire'         && <HireForm        onSubmit={d => handleSubmit('hire', d)}         isSubmitting={isSubmitting} />}
          {selectedType === 'revenue'      && <RevenueForm     onSubmit={d => handleSubmit('revenue', d)}      isSubmitting={isSubmitting} />}
          {selectedType === 'asset'        && <AssetForm       onSubmit={d => handleSubmit('asset', d)}        isSubmitting={isSubmitting} />}
          {selectedType === 'loan'         && <LoanForm        onSubmit={d => handleSubmit('loan', d)}         isSubmitting={isSubmitting} />}
          {selectedType === 'expense'      && <ExpenseForm     onSubmit={d => handleSubmit('expense', d)}      isSubmitting={isSubmitting} />}
          {selectedType === 'price_change' && <PriceChangeForm onSubmit={d => handleSubmit('price_change', d)} isSubmitting={isSubmitting} />}
        </div>
      </div>
    </div>
  )
}
