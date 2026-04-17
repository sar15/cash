'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import { useCompanyContext } from '@/hooks/use-company-context'
import { CalendarClock, Bell, Mail, Save, Check, Loader2, AlertTriangle, Clock, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'
import { apiGet, apiPost } from '@/lib/api/client'
import { cn } from '@/lib/utils'

interface Filing {
  id: string
  name: string
  type: 'GST-R1' | 'GST-R3B' | 'TDS' | 'PF/ESI' | 'Advance Tax' | 'ITR'
  dueDate: Date
  status: 'overdue' | 'due_soon' | 'upcoming' | 'filed'
  clientName: string
  companyId: string
  daysUntil: number
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'GST-R1':      { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#BFDBFE]' },
  'GST-R3B':     { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#BFDBFE]' },
  'TDS':         { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]', border: 'border-[#FDE68A]' },
  'PF/ESI':      { bg: 'bg-[#ECFDF5]', text: 'text-[#059669]', border: 'border-[#A7F3D0]' },
  'Advance Tax': { bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', border: 'border-[#FECACA]' },
  'ITR':         { bg: 'bg-[#F5F3FF]', text: 'text-[#7C3AED]', border: 'border-[#DDD6FE]' },
}

function buildFilings(companies: { id: string; name: string }[], month: number, year: number): Filing[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const getDaysUntil = (d: Date) => Math.round((d.getTime() - today.getTime()) / 86400000)
  const getStatus = (d: Date): Filing['status'] => {
    const days = getDaysUntil(d)
    if (days < 0) return 'overdue'
    if (days <= 5) return 'due_soon'
    return 'upcoming'
  }

  const filings: Filing[] = []

  companies.forEach(company => {
    const base: Array<{ name: string; type: Filing['type']; day: number }> = [
      { name: 'GSTR-1', type: 'GST-R1', day: 11 },
      { name: 'TDS Deposit', type: 'TDS', day: 7 },
      { name: 'GSTR-3B', type: 'GST-R3B', day: 20 },
      { name: 'PF/ESI Deposit', type: 'PF/ESI', day: 15 },
    ]

    // Advance tax quarters: Jun 15, Sep 15, Dec 15, Mar 15
    const atMonths = [5, 8, 11, 2]
    if (atMonths.includes(month)) {
      base.push({ name: 'Advance Tax', type: 'Advance Tax', day: 15 })
    }

    base.forEach(f => {
      const dueDate = new Date(year, month, f.day)
      filings.push({
        id: `${f.type}-${company.id}-${year}-${month}`,
        name: f.name,
        type: f.type,
        dueDate,
        status: getStatus(dueDate),
        clientName: company.name,
        companyId: company.id,
        daysUntil: getDaysUntil(dueDate),
      })
    })
  })

  return filings.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export default function DueDatesPage() {
  const { companies, isCA, isLoading, companyId } = useCompanyContext()
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [remindersEnabled, setRemindersEnabled] = useState(false)
  const [reminderDays, setReminderDays] = useState('3')
  const [alertEmail, setAlertEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    if (!companyId) return
    apiGet<{ config: { enabled: boolean; alertEmail: string | null; reminderDays: number } }>(
      `/api/reminder-config?companyId=${companyId}`
    ).then(data => {
      setRemindersEnabled(data.config.enabled ?? false)
      setReminderDays(String(data.config.reminderDays ?? 3))
      setAlertEmail(data.config.alertEmail ?? '')
    }).catch(() => {})
  }, [companyId])

  const handleSave = useCallback(async () => {
    if (!companyId) return
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      await apiPost(`/api/reminder-config?companyId=${companyId}`, {
        enabled: remindersEnabled,
        alertEmail: alertEmail || null,
        reminderDays: parseInt(reminderDays),
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch { /* silent */ } finally {
      setIsSaving(false)
    }
  }, [companyId, remindersEnabled, alertEmail, reminderDays])

  const allFilings = useMemo(() =>
    buildFilings(companies, viewMonth, viewYear),
    [companies, viewMonth, viewYear]
  )

  const filtered = useMemo(() =>
    filterType === 'all' ? allFilings : allFilings.filter(f => f.type === filterType),
    [allFilings, filterType]
  )

  const stats = useMemo(() => ({
    overdue: allFilings.filter(f => f.status === 'overdue').length,
    dueSoon: allFilings.filter(f => f.status === 'due_soon').length,
    upcoming: allFilings.filter(f => f.status === 'upcoming').length,
    total: allFilings.length,
  }), [allFilings])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#2563EB]" />
      </div>
    )
  }

  if (!isCA) {
    return (
      <div className="flex h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
            <CalendarClock className="h-6 w-6 text-[#94A3B8]" />
          </div>
          <h2 className="text-lg font-semibold text-[#0F172A]">Due Date Manager</h2>
          <p className="mt-2 text-sm leading-6 text-[#64748B]">
            This feature is for CAs managing multiple clients. Switch to CA mode in Settings to access the consolidated due date view.
          </p>
        </div>
      </div>
    )
  }

  const types = ['all', 'GST-R1', 'GST-R3B', 'TDS', 'PF/ESI', 'Advance Tax']

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Due dates"
        title="Compliance Due Dates"
        description={`${MONTH_NAMES[viewMonth]} ${viewYear} · ${companies.length} client${companies.length !== 1 ? 's' : ''}`}
        badges={
          <>
            {stats.overdue > 0 && <HeaderBadge label={`${stats.overdue} overdue`} tone="danger" dot />}
            {stats.dueSoon > 0 && <HeaderBadge label={`${stats.dueSoon} due soon`} tone="warning" dot />}
            <HeaderBadge label={`${stats.total} total`} />
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A] transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[130px] text-center text-sm font-semibold text-[#0F172A]">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A] transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Overdue', value: stats.overdue, color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]' },
          { label: 'Due in 5 days', value: stats.dueSoon, color: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
          { label: 'Upcoming', value: stats.upcoming, color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]', border: 'border-[#BFDBFE]' },
          { label: 'Total filings', value: stats.total, color: 'text-[#0F172A]', bg: 'bg-[#F8FAFC]', border: 'border-[#E2E8F0]' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-lg border p-4', s.bg, s.border)}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">{s.label}</p>
            <p className={cn('mt-1.5 text-2xl font-bold tabular-nums', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Reminder config */}
      <SurfaceCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
              <Bell className="h-4 w-4 text-[#2563EB]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Email Reminders</p>
              <p className="text-xs text-[#64748B]">Automated alerts before compliance deadlines</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E293B] disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveSuccess ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saveSuccess ? 'Saved' : 'Save'}
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Enable alerts</p>
              <p className="text-xs text-[#64748B]">Send email reminders</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={remindersEnabled}
              onClick={() => setRemindersEnabled(v => !v)}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                remindersEnabled ? 'bg-[#2563EB]' : 'bg-[#E2E8F0]'
              )}
            >
              <span className={cn(
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                remindersEnabled ? 'translate-x-5' : 'translate-x-0'
              )} />
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#374151]">Alert email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="email"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="admin@cafirm.com"
                disabled={!remindersEnabled}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/10 disabled:opacity-50 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#374151]">Remind me</label>
            <select
              value={reminderDays}
              onChange={(e) => setReminderDays(e.target.value)}
              disabled={!remindersEnabled}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none disabled:opacity-50 transition-colors"
            >
              <option value="1">1 day before</option>
              <option value="3">3 days before</option>
              <option value="5">5 days before</option>
              <option value="7">1 week before</option>
            </select>
          </div>
        </div>
      </SurfaceCard>

      {/* Filing table */}
      <SurfaceCard noPad>
        {/* Filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-[#E2E8F0] px-4 py-2.5">
          {types.map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                filterType === t
                  ? 'bg-[#0F172A] text-white'
                  : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
              )}
            >
              {t === 'all' ? `All (${allFilings.length})` : t}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="fin-table w-full">
            <thead>
              <tr>
                <th className="text-left">Filing</th>
                <th className="text-left">Client</th>
                <th className="text-left">Due Date</th>
                <th className="text-left">Status</th>
                <th className="text-right">Days</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-[#94A3B8]">
                    No filings for this period
                  </td>
                </tr>
              ) : (
                filtered.map(filing => {
                  const tc = TYPE_COLORS[filing.type] ?? TYPE_COLORS['TDS']
                  const StatusIcon = filing.status === 'overdue' ? AlertTriangle
                    : filing.status === 'due_soon' ? Clock
                    : filing.status === 'filed' ? CheckCircle2
                    : Clock

                  return (
                    <tr key={filing.id} className="hover-row">
                      <td className="!font-sans">
                        <div className="flex items-center gap-2.5">
                          <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold', tc.bg, tc.border, tc.text)}>
                            {filing.type}
                          </span>
                          <span className="text-sm font-medium text-[#0F172A]">{filing.name}</span>
                        </div>
                      </td>
                      <td className="!font-sans text-sm text-[#334155]">{filing.clientName}</td>
                      <td className="!font-sans text-sm text-[#334155]">
                        {filing.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="!font-sans">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium',
                          filing.status === 'overdue' && 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]',
                          filing.status === 'due_soon' && 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]',
                          filing.status === 'upcoming' && 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]',
                          filing.status === 'filed' && 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]',
                        )}>
                          <StatusIcon className="h-3 w-3" />
                          {filing.status === 'overdue' ? 'Overdue'
                            : filing.status === 'due_soon' ? 'Due Soon'
                            : filing.status === 'filed' ? 'Filed'
                            : 'Upcoming'}
                        </span>
                      </td>
                      <td className={cn(
                        'text-right text-sm font-semibold tabular-nums',
                        filing.daysUntil < 0 ? 'text-[#DC2626]'
                          : filing.daysUntil <= 5 ? 'text-[#D97706]'
                          : 'text-[#64748B]'
                      )}>
                        {filing.daysUntil < 0
                          ? `${Math.abs(filing.daysUntil)}d ago`
                          : filing.daysUntil === 0
                          ? 'Today'
                          : `${filing.daysUntil}d`}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>
  )
}
