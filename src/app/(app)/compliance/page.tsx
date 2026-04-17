'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useCompanyContext } from '@/hooks/use-company-context'
import { useCurrentForecast } from '@/hooks/use-current-forecast'
import { useUIStore } from '@/stores/ui-store'
import { formatAuto } from '@/lib/utils/indian-format'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, FileText } from 'lucide-react'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'

interface ComplianceItem {
  id: string
  type: 'gst' | 'tds' | 'advance_tax' | 'pf_esi'
  label: string
  subLabel: string
  dueDate: string
  amount: number
  status: 'paid' | 'due' | 'overdue'
  cashBefore: number
}

interface GSTFiling {
  id: string
  period: string
  returnType: 'GSTR-1' | 'GSTR-3B'
  status: 'pending' | 'filed' | 'overdue'
  dueDate: string
  amountPaise: number
  filedAt?: string | null
  referenceNumber?: string | null
}

const typeLabels: Record<string, string> = {
  gst: 'GST',
  tds: 'TDS',
  advance_tax: 'Advance Tax',
  pf_esi: 'PF/ESI',
}

function MonthNavigator({ month, year, onPrev, onNext }: { month: number; year: number; onPrev: () => void; onNext: () => void }) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return (
    <div className="flex items-center gap-2">
      <button onClick={onPrev} className="btn-press rounded border border-[#E5E7EB] bg-white p-1.5 text-[#94A3B8] transition-colors duration-[80ms] hover:border-[#D1D5DB] hover:text-[#475569]">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[140px] text-center text-sm font-semibold text-[#0F172A]">
        {monthNames[month]} {year}
      </span>
      <button onClick={onNext} className="btn-press rounded border border-[#E5E7EB] bg-white p-1.5 text-[#94A3B8] transition-colors duration-[80ms] hover:border-[#D1D5DB] hover:text-[#475569]">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function ComplianceSummary({ items }: { items: ComplianceItem[] }) {
  const groups = ['gst', 'tds', 'advance_tax', 'pf_esi'] as const
  const totals = groups.map((type) => ({
    type,
    label: typeLabels[type],
    amount: items.filter((i) => i.type === type).reduce((s, i) => s + i.amount, 0),
  }))
  const total = totals.reduce((s, t) => s + t.amount, 0)

  const typeColors: Record<string, { bg: string; border: string; text: string }> = {
    gst:          { bg: 'bg-[#EFF6FF]', border: 'border-[#BFDBFE]', text: 'text-[#2563EB]' },
    tds:          { bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]', text: 'text-[#D97706]' },
    advance_tax:  { bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]', text: 'text-[#DC2626]' },
    pf_esi:       { bg: 'bg-[#ECFDF5]', border: 'border-[#A7F3D0]', text: 'text-[#059669]' },
  }

  return (
    <SurfaceCard>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Total Compliance Outflow</p>
          <p className="text-xs text-[#94A3B8]">Aggregate statutory payments this month</p>
        </div>
        <p className="font-num text-2xl font-semibold text-[#0F172A]">{formatAuto(total)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {totals.map((t) => {
          const tc = typeColors[t.type] ?? typeColors.gst
          return (
            <div key={t.type} className={cn('rounded-lg border px-3 py-2.5', tc.bg, tc.border)}>
              <p className={cn('text-[11px] font-semibold uppercase tracking-[0.08em]', tc.text)}>{t.label}</p>
              <p className={cn('mt-1 font-num text-base font-semibold', tc.text)}>{formatAuto(t.amount)}</p>
            </div>
          )
        })}
      </div>
    </SurfaceCard>
  )
}

function ComplianceTable({
  items,
  paidItems,
  onMarkPaid,
  pendingItemId,
}: {
  items: ComplianceItem[]
  paidItems: Set<string>
  onMarkPaid: (id: string) => void
  pendingItemId: string | null
}) {
  return (
    <SurfaceCard>
      <div className="overflow-x-auto">
        <table className="fin-table w-full">
          <thead>
            <tr>
              <th className="w-8 text-left" />
              <th className="text-left">Obligation</th>
              <th className="text-left">Type</th>
              <th className="text-left">Due Date</th>
              <th>Amount</th>
              <th>Cash Before</th>
              <th>Cash After</th>
              <th className="text-left">Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cashAfter = item.cashBefore - item.amount
              const isShortfall = cashAfter < 0
              const isPaid = paidItems.has(item.id)
              const isSubmitting = pendingItemId === item.id
              const effectiveStatus = isPaid ? 'paid' : item.status
              return (
                <tr key={item.id} className="hover-row">
                  <td className="!text-center">
                    <span className={cn(
                      'health-dot',
                      effectiveStatus === 'paid' && 'health-dot-green',
                      effectiveStatus === 'due' && 'health-dot-amber',
                      effectiveStatus === 'overdue' && 'health-dot-red',
                    )} />
                  </td>
                  <td className="!font-sans">
                    <div className={cn('text-sm font-medium', isPaid ? 'text-[#94A3B8] line-through' : 'text-[#0F172A]')}>{item.label}</div>
                    <div className="text-xs text-[#94A3B8]">{item.subLabel}</div>
                  </td>
                  <td className="!font-sans">
                    <span className="label-xs">{typeLabels[item.type]}</span>
                  </td>
                  <td className="!font-sans text-sm text-[#334155]">{item.dueDate}</td>
                  <td className={cn('font-semibold', isPaid && 'text-[#94A3B8]')}>{formatAuto(item.amount)}</td>
                  <td className={cn(item.cashBefore > 0 ? 'text-[#059669]' : 'text-[#DC2626]')}>
                    {item.cashBefore > 0 ? formatAuto(item.cashBefore) : '—'}
                  </td>
                  <td className={cn(isShortfall && !isPaid ? 'font-semibold text-[#DC2626]' : 'text-[#334155]')}>
                    {item.cashBefore > 0 ? (isShortfall ? `(${formatAuto(Math.abs(cashAfter))})` : formatAuto(cashAfter)) : '—'}
                  </td>
                  <td className="!font-sans">
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium',
                      effectiveStatus === 'paid' && 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]',
                      effectiveStatus === 'due' && 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]',
                      effectiveStatus === 'overdue' && 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]',
                    )}>
                      {effectiveStatus === 'overdue' && !isPaid && <AlertTriangle className="h-3 w-3" />}
                      {isPaid ? 'Paid' : effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}
                      {isShortfall && !isPaid && ' · Shortfall'}
                    </span>
                  </td>
                  <td className="!font-sans text-right">
                    <button
                      onClick={() => onMarkPaid(item.id)}
                      disabled={isSubmitting}
                      className={cn(
                        'btn-press inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors duration-[80ms]',
                        isSubmitting && 'cursor-not-allowed opacity-60',
                        isPaid
                          ? 'border-[#E5E7EB] text-[#94A3B8] hover:border-[#FECACA] hover:text-[#DC2626]'
                          : 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5]'
                      )}
                    >
                      {isPaid ? (
                        <><CheckCircle2 className="h-3 w-3" /> Undo</>
                      ) : (
                        <><CheckCircle2 className="h-3 w-3" /> Mark paid</>
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  )
}

function GSTFilingTracker({ companyId }: { companyId: string }) {
  const [filings, setFilings] = useState<GSTFiling[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [markingFiled, setMarkingFiled] = useState<string | null>(null)

  useEffect(() => {
    if (!companyId) return
    setIsLoading(true)
    fetch(`/api/gst-filings?companyId=${companyId}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { filings?: GSTFiling[] } | null) => {
        if (data?.filings) setFilings(data.filings)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [companyId])

  const handleMarkAsFiled = async (filingId: string) => {
    setMarkingFiled(filingId)
    try {
      const response = await fetch(`/api/gst-filings/${filingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Company-Id': companyId },
        body: JSON.stringify({ referenceNumber: '' })
      })
      if (response.ok) {
        setFilings(prev => prev.map(f => 
          f.id === filingId ? { ...f, status: 'filed', filedAt: new Date().toISOString() } : f
        ))
      }
    } catch (err) {
      console.error('Failed to mark filing as filed:', err)
    } finally {
      setMarkingFiled(null)
    }
  }

  const formatPeriod = (period: string) => {
    const date = new Date(period)
    return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  if (isLoading) {
    return (
      <SurfaceCard>
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#059669]" />
        </div>
      </SurfaceCard>
    )
  }

  const summary = {
    total: filings.length,
    filed: filings.filter(f => f.status === 'filed').length,
    pending: filings.filter(f => f.status === 'pending').length,
    overdue: filings.filter(f => f.status === 'overdue').length,
    totalLiability: filings.reduce((sum, f) => sum + f.amountPaise, 0),
  }

  return (
    <SurfaceCard>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#059669]" />
            <h3 className="text-lg font-semibold text-[#0F172A]">GST Filing Status</h3>
          </div>
          <p className="mt-1 text-xs text-[#94A3B8]">Track GSTR-1 and GSTR-3B filing status</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-[#94A3B8]">Total Liability</p>
            <p className="font-num text-lg font-semibold text-[#0F172A]">{formatAuto(summary.totalLiability)}</p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2">
              <p className="text-xs text-[#059669]">Filed</p>
              <p className="font-num text-lg font-semibold text-[#059669]">{summary.filed}</p>
            </div>
            <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
              <p className="text-xs text-[#D97706]">Pending</p>
              <p className="font-num text-lg font-semibold text-[#D97706]">{summary.pending}</p>
            </div>
            {summary.overdue > 0 && (
              <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2">
                <p className="text-xs text-[#DC2626]">Overdue</p>
                <p className="font-num text-lg font-semibold text-[#DC2626]">{summary.overdue}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {filings.slice(0, 6).map(filing => (
          <div key={filing.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-white p-3 transition-colors hover:border-[#CBD5E1]">
            <div className="flex items-center gap-3">
              <span className={cn(
                'health-dot',
                filing.status === 'filed' && 'health-dot-green',
                filing.status === 'pending' && 'health-dot-amber',
                filing.status === 'overdue' && 'health-dot-red',
              )} />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">{filing.returnType} - {formatPeriod(filing.period)}</p>
                <p className="text-xs text-[#94A3B8]">Due: {formatDate(filing.dueDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-num text-sm font-semibold text-[#334155]">{formatAuto(filing.amountPaise)}</p>
              <span className={cn(
                'inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium',
                filing.status === 'filed' && 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]',
                filing.status === 'pending' && 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]',
                filing.status === 'overdue' && 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]',
              )}>
                {filing.status === 'filed' ? 'Filed' : filing.status === 'overdue' ? 'Overdue' : 'Pending'}
              </span>
              {filing.status !== 'filed' && (
                <button
                  onClick={() => handleMarkAsFiled(filing.id)}
                  disabled={markingFiled === filing.id}
                  className="btn-press inline-flex items-center gap-1 rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-1 text-[11px] font-medium text-[#059669] transition-colors duration-[80ms] hover:bg-[#D1FAE5] disabled:opacity-50"
                >
                  {markingFiled === filing.id ? (
                    <><div className="h-3 w-3 animate-spin rounded-full border border-[#059669] border-t-transparent" /> Filing...</>
                  ) : (
                    <><CheckCircle2 className="h-3 w-3" /> Mark as Filed</>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filings.length === 0 && (
        <div className="py-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-[#CBD5E1]" />
          <p className="mt-2 text-sm text-[#94A3B8]">No GST filings found</p>
          <p className="mt-1 text-xs text-[#CBD5E1]">Filings will appear after running forecast</p>
        </div>
      )}
    </SurfaceCard>
  )
}

export default function CompliancePage() {
  const { company, companyId, isLoading: companyLoading } = useCompanyContext()
  const { engineResult } = useCurrentForecast()
  const showToast = useUIStore((state) => state.showToast)

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [paidItems, setPaidItems] = useState<Set<string>>(new Set())
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null)

  const loadPaidItems = useCallback(async () => {
    if (!companyId) return
    try {
      const response = await fetch(`/api/compliance/payments?companyId=${companyId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch compliance payment state')
      }
      const data = await response.json() as { paidIds?: string[] }
      setPaidItems(new Set(data.paidIds ?? []))
    } catch {
      showToast('Failed to load compliance payment state', 'error')
    }
  }, [companyId, showToast])

  useEffect(() => {
    void loadPaidItems()
  }, [loadPaidItems])

  const markPaid = useCallback(async (itemId: string) => {
    if (!companyId) return

    setPendingPaymentId(itemId)
    const isRemoving = paidItems.has(itemId)

    try {
      const response = await fetch(
        isRemoving
          ? `/api/compliance/payments/${encodeURIComponent(itemId)}?companyId=${companyId}`
          : `/api/compliance/payments?companyId=${companyId}`,
        {
          method: isRemoving ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: isRemoving ? undefined : JSON.stringify({ obligationId: itemId }),
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to update compliance payment' }))
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to update compliance payment')
      }

      await loadPaidItems()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update compliance payment', 'error')
    } finally {
      setPendingPaymentId(null)
    }
  }, [companyId, loadPaidItems, paidItems, showToast])

  const handlePrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }
  const handleNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  const items = useMemo((): ComplianceItem[] => {
    const compliance = engineResult?.compliance
    const forecastMonths = engineResult?.forecastMonths ?? []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find which forecast month index corresponds to the viewed month/year
    const viewedPeriod = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`
    const forecastIdx = forecastMonths.findIndex(label => {
      // Convert 'Apr-25' → '2025-04-01'
      const [mon, yr] = label.split('-')
      const monthMap: Record<string, string> = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' }
      return `20${yr}-${monthMap[mon]}-01` === viewedPeriod
    })

    // Use forecast index if found, otherwise fall back to calendar month index
    const idx = forecastIdx >= 0 ? forecastIdx : viewMonth
    const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })

    const gstR3BDue = new Date(viewYear, viewMonth, 20)
    const gstAmount = compliance?.gst?.months?.[idx]?.netPayable ?? 0
    const tdsDate = new Date(viewYear, viewMonth, 7)
    const tdsAmount = compliance?.tds?.months?.[idx]?.salaryTDS ?? 0
    const pfMonth = compliance?.pfEsi?.months?.[idx]
    const pfAmount = pfMonth?.employerPF ?? 0
    const esiAmount = (pfMonth?.employerESI ?? 0) + (pfMonth?.employeeESI ?? 0)
    const atQuarters = [5, 8, 11, 2]
    const isATQuarter = atQuarters.includes(viewMonth)
    const atAmount = isATQuarter ? (compliance?.advanceTax?.installments?.[atQuarters.indexOf(viewMonth)]?.installmentAmount ?? 0) : 0

    // Get projected cash before each obligation from compliance events
    const cashBeforeGST = compliance?.events?.find(e => e.type === 'GST' && e.sourcePeriod?.includes(monthLabel))?.projectedCashBefore ?? 0
    const cashBeforeTDS = compliance?.events?.find(e => e.type === 'TDS' && e.sourcePeriod?.includes(monthLabel))?.projectedCashBefore ?? 0
    const cashBeforePF = compliance?.events?.find(e => e.type === 'PF')?.projectedCashBefore ?? 0

    const getStatus = (dueDate: Date) => {
      if (today > dueDate) return 'overdue' as const
      return 'due' as const
    }

    const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

    const result: ComplianceItem[] = [
      { id: `gst-r3b-${viewMonth}-${viewYear}`, type: 'gst', label: 'GST R-3B Payment', subLabel: `Net GST for ${monthLabel}`, dueDate: fmtDate(gstR3BDue), amount: gstAmount, status: getStatus(gstR3BDue), cashBefore: cashBeforeGST },
      { id: `tds-${viewMonth}-${viewYear}`, type: 'tds', label: 'TDS Deposit', subLabel: `Deducted at source for ${monthLabel}`, dueDate: fmtDate(tdsDate), amount: tdsAmount, status: getStatus(tdsDate), cashBefore: cashBeforeTDS },
      { id: `pf-${viewMonth}-${viewYear}`, type: 'pf_esi', label: 'PF Deposit', subLabel: 'Employee + employer PF', dueDate: fmtDate(new Date(viewYear, viewMonth, 15)), amount: pfAmount, status: getStatus(new Date(viewYear, viewMonth, 15)), cashBefore: cashBeforePF },
      { id: `esi-${viewMonth}-${viewYear}`, type: 'pf_esi', label: 'ESI Deposit', subLabel: 'Employee + employer ESI', dueDate: fmtDate(new Date(viewYear, viewMonth, 15)), amount: esiAmount, status: getStatus(new Date(viewYear, viewMonth, 15)), cashBefore: cashBeforePF },
    ]

    if (isATQuarter) {
      result.push({ id: `at-${viewMonth}-${viewYear}`, type: 'advance_tax', label: 'Advance Tax Installment', subLabel: `Q${atQuarters.indexOf(viewMonth) + 1} payment`, dueDate: fmtDate(new Date(viewYear, viewMonth, 15)), amount: atAmount, status: getStatus(new Date(viewYear, viewMonth, 15)), cashBefore: 0 })
    }

    return result.filter(i => i.amount > 0)
  }, [engineResult, viewMonth, viewYear])

  if (companyLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#059669]" />
          <p className="text-sm text-[#94A3B8]">Loading compliance data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Compliance"
        title="Compliance Calendar"
        description={`GST, TDS, PF/ESI, advance tax — ${company?.name ?? 'company'} · DD/MM/YYYY`}
        badges={
          <>
            <HeaderBadge label={`${items.length} obligations`} />
            <HeaderBadge
              label={items.some((i) => i.status === 'overdue') ? 'Overdue present' : 'All current'}
              tone={items.some((i) => i.status === 'overdue') ? 'danger' : 'success'}
            />
          </>
        }
        actions={<MonthNavigator month={viewMonth} year={viewYear} onPrev={handlePrev} onNext={handleNext} />}
      />

      <ComplianceSummary items={items} />
      <ComplianceTable items={items} paidItems={paidItems} onMarkPaid={markPaid} pendingItemId={pendingPaymentId} />
      
      {companyId && <GSTFilingTracker companyId={companyId} />}
    </div>
  )
}
