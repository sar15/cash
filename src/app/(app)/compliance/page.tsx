'use client'

import { useMemo, useState } from 'react'
import { useCompanyContext } from '@/hooks/use-company-context'
import { useCurrentForecast } from '@/hooks/use-current-forecast'
import { formatAuto } from '@/lib/utils/indian-format'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'

interface ComplianceItem {
  id: string
  type: 'gst' | 'tds' | 'advance_tax' | 'pf_esi'
  label: string
  subLabel: string
  dueDate: string
  amount: number
  status: 'paid' | 'due' | 'overdue'
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

  return (
    <SurfaceCard>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Total Compliance Outflow</p>
          <p className="text-xs text-[#94A3B8]">Aggregate statutory payments for the month</p>
        </div>
        <p className="font-num text-xl font-bold text-[#0F172A]">{formatAuto(total)}</p>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3">
        {totals.map((t) => (
          <div key={t.type} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-center">
            <p className="font-num text-base font-semibold text-[#0F172A]">{formatAuto(t.amount)}</p>
            <p className="label-xs mt-0.5">{t.label}</p>
          </div>
        ))}
      </div>
    </SurfaceCard>
  )
}

function ComplianceTable({ items }: { items: ComplianceItem[] }) {
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
              <th className="text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="hover-row">
                <td className="!text-center">
                  <span className={cn(
                    'health-dot',
                    item.status === 'paid' && 'health-dot-green',
                    item.status === 'due' && 'health-dot-amber',
                    item.status === 'overdue' && 'health-dot-red',
                  )} />
                </td>
                <td className="!font-sans">
                  <div className="text-sm font-medium text-[#0F172A]">{item.label}</div>
                  <div className="text-xs text-[#94A3B8]">{item.subLabel}</div>
                </td>
                <td className="!font-sans">
                  <span className="label-xs">{typeLabels[item.type]}</span>
                </td>
                <td className="!font-sans text-sm text-[#334155]">{item.dueDate}</td>
                <td className="font-semibold">{formatAuto(item.amount)}</td>
                <td className="!font-sans">
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium',
                    item.status === 'paid' && 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]',
                    item.status === 'due' && 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]',
                    item.status === 'overdue' && 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]',
                  )}>
                    {item.status === 'overdue' && <AlertTriangle className="h-3 w-3" />}
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  )
}

export default function CompliancePage() {
  const { company, isLoading: companyLoading } = useCompanyContext()
  const { engineResult } = useCurrentForecast()

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())

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
    const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const gstR3BDue = new Date(viewYear, viewMonth, 20)
    const gstAmount = compliance?.gst?.months?.[viewMonth]?.netPayable ?? 0
    const tdsDate = new Date(viewYear, viewMonth, 7)
    const tdsAmount = compliance?.tds?.months?.[viewMonth]?.salaryTDS ?? 0
    const pfMonth = compliance?.pfEsi?.months?.[viewMonth]
    const pfAmount = pfMonth?.employerPF ?? 0
    const esiAmount = (pfMonth?.employerESI ?? 0) + (pfMonth?.employeeESI ?? 0)
    const atQuarters = [5, 8, 11, 2]
    const isATQuarter = atQuarters.includes(viewMonth)
    const atAmount = isATQuarter ? (compliance?.advanceTax?.installments?.[atQuarters.indexOf(viewMonth)]?.installmentAmount ?? 0) : 0

    const getStatus = (dueDate: Date) => {
      if (today > dueDate) return 'overdue' as const
      return 'due' as const
    }

    const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

    const result: ComplianceItem[] = [
      { id: `gst-r3b-${viewMonth}`, type: 'gst', label: 'GST R-3B Payment', subLabel: `Net GST for ${monthLabel}`, dueDate: fmtDate(gstR3BDue), amount: gstAmount, status: getStatus(gstR3BDue) },
      { id: `tds-${viewMonth}`, type: 'tds', label: 'TDS Deposit', subLabel: `Deducted at source for ${monthLabel}`, dueDate: fmtDate(tdsDate), amount: tdsAmount, status: getStatus(tdsDate) },
      { id: `pf-${viewMonth}`, type: 'pf_esi', label: 'PF Deposit', subLabel: 'Employee + employer PF', dueDate: fmtDate(new Date(viewYear, viewMonth, 15)), amount: pfAmount * 2, status: getStatus(new Date(viewYear, viewMonth, 15)) },
      { id: `esi-${viewMonth}`, type: 'pf_esi', label: 'ESI Deposit', subLabel: 'Employee + employer ESI', dueDate: fmtDate(new Date(viewYear, viewMonth, 15)), amount: esiAmount * 2, status: getStatus(new Date(viewYear, viewMonth, 15)) },
    ]

    if (isATQuarter) {
      result.push({ id: `at-${viewMonth}`, type: 'advance_tax', label: 'Advance Tax Installment', subLabel: `Q${atQuarters.indexOf(viewMonth) + 1} payment`, dueDate: fmtDate(new Date(viewYear, viewMonth, 15)), amount: atAmount, status: getStatus(new Date(viewYear, viewMonth, 15)) })
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
      <ComplianceTable items={items} />
    </div>
  )
}
