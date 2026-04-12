'use client'

import { useState, useCallback } from 'react'
import { useMicroForecastStore, type WizardType } from '@/stores/micro-forecast-store'
import {
  X,
  Loader2,
  UserPlus,
  TrendingUp,
  Package,
  Landmark,
} from 'lucide-react'
import type { NewHireWizardInputs } from '@/lib/engine/micro-forecasts/wizards/new-hire'
import type { RevenueWizardInputs } from '@/lib/engine/micro-forecasts/wizards/revenue'
import type { AssetWizardInputs } from '@/lib/engine/micro-forecasts/wizards/asset'
import type { LoanWizardInputs } from '@/lib/engine/micro-forecasts/wizards/loan'

// ============================================================
// WIZARD TYPE SELECTOR
// ============================================================

const wizardTypes: { id: WizardType; label: string; desc: string; icon: typeof UserPlus }[] = [
  { id: 'hire', label: 'New Hire', desc: 'Add salary, PF, ESI for a new employee', icon: UserPlus },
  { id: 'revenue', label: 'New Revenue', desc: 'Add a new client or revenue stream', icon: TrendingUp },
  { id: 'asset', label: 'Asset Purchase', desc: 'CapEx with depreciation schedule', icon: Package },
  { id: 'loan', label: 'Loan / Financing', desc: 'Debt with repayment schedule', icon: Landmark },
]

// ============================================================
// INDIVIDUAL WIZARD FORMS
// ============================================================

function HireForm({ onSubmit, isSubmitting }: { onSubmit: (data: NewHireWizardInputs) => void; isSubmitting: boolean }) {
  const [role, setRole] = useState('')
  const [ctcMonthly, setCtcMonthly] = useState('')
  const [startMonth, setStartMonth] = useState('')

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium uppercase text-slate-400">Role / Title</label>
        <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Developer"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none" autoFocus />
      </div>
      <div>
        <label className="text-xs font-medium uppercase text-slate-400">Monthly CTC (₹)</label>
        <input type="number" value={ctcMonthly} onChange={(e) => setCtcMonthly(e.target.value)} placeholder="e.g. 80000"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none" />
      </div>
      <div>
        <label className="text-xs font-medium uppercase text-slate-400">Start Month</label>
        <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" />
      </div>
      <button onClick={() => {
        if (!role || !ctcMonthly || !startMonth) return
        const [y, m] = startMonth.split('-')
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        const label = `${monthNames[parseInt(m)-1]}-${y.slice(-2)}`
        onSubmit({ role, monthlyCTC: parseInt(ctcMonthly) * 100, startMonth: label, netSalaryPct: 0.8, statutoryPct: 0.2 })
      }} disabled={!role || !ctcMonthly || !startMonth || isSubmitting}
        className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40">
        {isSubmitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Add Hire'}
      </button>
    </div>
  )
}

function RevenueForm({ onSubmit, isSubmitting }: { onSubmit: (data: RevenueWizardInputs) => void; isSubmitting: boolean }) {
  const [name, setName] = useState('')
  const [monthly, setMonthly] = useState('')
  const [startMonth, setStartMonth] = useState('')

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium uppercase text-slate-400">Client / Stream Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Corp"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none" autoFocus />
      </div>
      <div>
        <label className="text-xs font-medium uppercase text-slate-400">Monthly Revenue (₹)</label>
        <input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="e.g. 200000"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none" />
      </div>
      <div>
        <label className="text-xs font-medium uppercase text-slate-400">Start Month</label>
        <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" />
      </div>
      <button onClick={() => {
        if (!name || !monthly || !startMonth) return
        const [y, m] = startMonth.split('-')
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        const label = `${monthNames[parseInt(m)-1]}-${y.slice(-2)}`
        onSubmit({ clientName: name, monthlyAmount: parseInt(monthly) * 100, startMonth: label, gstRate: 18 })
      }} disabled={!name || !monthly || !startMonth || isSubmitting}
        className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40">
        {isSubmitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Add Revenue'}
      </button>
    </div>
  )
}

function AssetForm({ onSubmit, isSubmitting }: { onSubmit: (data: AssetWizardInputs) => void; isSubmitting: boolean }) {
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [usefulLife, setUsefulLife] = useState('60')
  const [purchaseMonth, setPurchaseMonth] = useState('')

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium uppercase text-slate-400">Asset Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office Laptops"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none" autoFocus />
      </div>
      <div>
        <label className="text-xs font-medium uppercase text-slate-400">Purchase Cost (₹)</label>
        <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 500000"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none" />
      </div>
      <div>
        <label className="text-xs font-medium uppercase text-slate-400">Useful Life (months)</label>
        <input type="number" value={usefulLife} onChange={(e) => setUsefulLife(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" />
      </div>
      <div>
        <label className="text-xs font-medium uppercase text-slate-400">Purchase Month</label>
        <input type="month" value={purchaseMonth} onChange={(e) => setPurchaseMonth(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" />
      </div>
      <button onClick={() => {
        if (!name || !cost || !purchaseMonth) return
        const [y, m] = purchaseMonth.split('-')
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        const label = `${monthNames[parseInt(m)-1]}-${y.slice(-2)}`
        onSubmit({ assetName: name, purchaseAmount: parseInt(cost) * 100, usefulLifeMonths: parseInt(usefulLife), purchaseMonth: label, salvageValue: 0 })
      }} disabled={!name || !cost || !purchaseMonth || isSubmitting}
        className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40">
        {isSubmitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Add Asset'}
      </button>
    </div>
  )
}

function LoanForm({ onSubmit, isSubmitting }: { onSubmit: (data: LoanWizardInputs) => void; isSubmitting: boolean }) {
  const [name, setName] = useState('')
  const [principal, setPrincipal] = useState('')
  const [rate, setRate] = useState('12')
  const [tenure, setTenure] = useState('36')
  const [startMonth, setStartMonth] = useState('')

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium uppercase text-slate-400">Loan Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Equipment Loan"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none" autoFocus />
      </div>
      <div>
        <label className="text-xs font-medium uppercase text-slate-400">Principal (₹)</label>
        <input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="e.g. 1000000"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium uppercase text-slate-400">Annual Rate (%)</label>
          <input type="number" value={rate} onChange={(e) => setRate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase text-slate-400">Tenure (months)</label>
          <input type="number" value={tenure} onChange={(e) => setTenure(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium uppercase text-slate-400">Start Month</label>
        <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" />
      </div>
      <button onClick={() => {
        if (!name || !principal || !startMonth) return
        const [y, m] = startMonth.split('-')
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        const label = `${monthNames[parseInt(m)-1]}-${y.slice(-2)}`
        onSubmit({ loanName: name, principalAmount: parseInt(principal) * 100, annualInterestRate: parseFloat(rate), termMonths: parseInt(tenure), startMonth: label })
      }} disabled={!name || !principal || !startMonth || isSubmitting}
        className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40">
        {isSubmitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Add Loan'}
      </button>
    </div>
  )
}

// ============================================================
// MAIN WIZARD MODAL
// ============================================================

interface WizardModalProps {
  onClose: () => void
}

export function MicroForecastWizard({ onClose }: WizardModalProps) {
  const [selectedType, setSelectedType] = useState<WizardType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addHire, addRevenue, addAsset, addLoan } = useMicroForecastStore()

  const handleSubmit = useCallback(async (type: WizardType, data: unknown) => {
    setIsSubmitting(true)
    try {
      switch (type) {
        case 'hire': await addHire(data as NewHireWizardInputs); break
        case 'revenue': await addRevenue(data as RevenueWizardInputs); break
        case 'asset': await addAsset(data as AssetWizardInputs); break
        case 'loan': await addLoan(data as LoanWizardInputs); break
      }
      onClose()
    } catch (err) {
      console.error('[Wizard] Save error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [addHire, addRevenue, addAsset, addLoan, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {selectedType ? `Add ${wizardTypes.find(w => w.id === selectedType)?.label}` : 'Add Business Event'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Type selector */}
          {!selectedType && (
            <div className="grid grid-cols-2 gap-3">
              {wizardTypes.map((wt) => (
                <button key={wt.id} onClick={() => setSelectedType(wt.id)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-5 text-center transition-all hover:border-emerald-500/50 hover:bg-slate-800">
                  <wt.icon className="h-8 w-8 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">{wt.label}</span>
                  <span className="text-[10px] text-slate-400">{wt.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* Wizard forms */}
          {selectedType === 'hire' && <HireForm onSubmit={(d) => handleSubmit('hire', d)} isSubmitting={isSubmitting} />}
          {selectedType === 'revenue' && <RevenueForm onSubmit={(d) => handleSubmit('revenue', d)} isSubmitting={isSubmitting} />}
          {selectedType === 'asset' && <AssetForm onSubmit={(d) => handleSubmit('asset', d)} isSubmitting={isSubmitting} />}
          {selectedType === 'loan' && <LoanForm onSubmit={(d) => handleSubmit('loan', d)} isSubmitting={isSubmitting} />}

          {/* Back button */}
          {selectedType && (
            <button onClick={() => setSelectedType(null)} className="mt-3 w-full text-center text-xs text-slate-500 hover:text-slate-300">
              ← Back to event types
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
