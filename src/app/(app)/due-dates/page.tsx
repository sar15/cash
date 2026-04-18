'use client'

import { useCallback, useState, useEffect } from 'react'
import { useCompanyContext } from '@/hooks/use-company-context'
import {
  CalendarClock, Bell, Mail, Save, Check, Loader2,
  AlertTriangle, ChevronLeft, ChevronRight,
  Send,
} from 'lucide-react'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'
import { apiGet, apiPost, apiPatch } from '@/lib/api/client'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComplianceTask {
  id: string
  companyId: string
  filingType: string
  periodLabel: string
  dueDate: string
  status: 'not_started' | 'waiting_on_client' | 'docs_received' | 'processing' | 'pending_otp' | 'filed'
  assignedTo: string | null
  filedAt: string | null
  arn: string | null
  notes: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FILING_TYPES = [
  { type: 'GSTR-1',  day: 11, label: 'GSTR-1 Filing' },
  { type: 'GSTR-3B', day: 20, label: 'GSTR-3B Payment' },
  { type: 'TDS',     day: 7,  label: 'TDS Deposit' },
  { type: 'PF/ESI',  day: 15, label: 'PF/ESI Deposit' },
]

const AT_MONTHS = [5, 8, 11, 2]

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'GSTR-1':      { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#BFDBFE]' },
  'GSTR-3B':     { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#BFDBFE]' },
  'TDS':         { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]', border: 'border-[#FDE68A]' },
  'PF/ESI':      { bg: 'bg-[#ECFDF5]', text: 'text-[#059669]', border: 'border-[#A7F3D0]' },
  'Advance Tax': { bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', border: 'border-[#FECACA]' },
  'ITR':         { bg: 'bg-[#F5F3FF]', text: 'text-[#7C3AED]', border: 'border-[#DDD6FE]' },
}

const STATUS_CONFIG: Record<ComplianceTask['status'], { label: string; color: string; bg: string; border: string }> = {
  not_started:       { label: 'Not Started',       color: 'text-[#94A3B8]', bg: 'bg-[#F8FAFC]', border: 'border-[#E2E8F0]' },
  waiting_on_client: { label: 'Waiting on Client', color: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
  docs_received:     { label: 'Docs Received',     color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]', border: 'border-[#BFDBFE]' },
  processing:        { label: 'Processing',         color: 'text-[#7C3AED]', bg: 'bg-[#F5F3FF]', border: 'border-[#DDD6FE]' },
  pending_otp:       { label: 'Pending OTP',        color: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
  filed:             { label: 'Filed',              color: 'text-[#059669]', bg: 'bg-[#ECFDF5]', border: 'border-[#A7F3D0]' },
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDaysUntil(dueDateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

function getAutoStatus(dueDateStr: string, status: ComplianceTask['status']): 'overdue' | 'due_soon' | 'upcoming' | 'filed' {
  if (status === 'filed') return 'filed'
  const days = getDaysUntil(dueDateStr)
  if (days < 0) return 'overdue'
  if (days <= 5) return 'due_soon'
  return 'upcoming'
}

function generateExpectedTasks(
  companies: { id: string; name: string }[],
  month: number,
  year: number
) {
  const tasks: Array<{
    companyId: string
    clientName: string
    filingType: string
    periodLabel: string
    dueDate: string
  }> = []
  const monthStr = String(month + 1).padStart(2, '0')
  const periodLabel = `${MONTH_NAMES[month]} ${year}`

  companies.forEach(company => {
    FILING_TYPES.forEach(f => {
      tasks.push({
        companyId: company.id,
        clientName: company.name,
        filingType: f.type,
        periodLabel,
        dueDate: `${year}-${monthStr}-${String(f.day).padStart(2, '0')}`,
      })
    })
    if (AT_MONTHS.includes(month)) {
      tasks.push({
        companyId: company.id,
        clientName: company.name,
        filingType: 'Advance Tax',
        periodLabel,
        dueDate: `${year}-${monthStr}-15`,
      })
    }
  })

  return tasks
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DueDatesPage() {
  const { companies, isCA, isLoading, companyId } = useCompanyContext()
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [tasks, setTasks] = useState<ComplianceTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const [remindersEnabled, setRemindersEnabled] = useState(false)
  const [reminderDays, setReminderDays] = useState('3')
  const [alertEmail, setAlertEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

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

  const loadTasks = useCallback(async () => {
    if (!companyId || !isCA) return
    setTasksLoading(true)
    try {
      const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
      const data = await apiGet<{ tasks: ComplianceTask[] }>(
        `/api/compliance-tasks?companyId=${companyId}&month=${monthStr}`
      )
      setTasks(data.tasks ?? [])
    } catch {
      setTasks([])
    } finally {
      setTasksLoading(false)
    }
  }, [companyId, isCA, viewMonth, viewYear])

  useEffect(() => { void loadTasks() }, [loadTasks])

  // Merge expected tasks with DB state — DB wins
  const mergedRows = (() => {
    const expected = generateExpectedTasks(companies, viewMonth, viewYear)
    const taskMap = new Map(tasks.map(t => [`${t.companyId}|${t.filingType}|${t.periodLabel}`, t]))
    return expected.map(exp => {
      const key = `${exp.companyId}|${exp.filingType}|${exp.periodLabel}`
      const db = taskMap.get(key)
      return {
        ...exp,
        id: db?.id ?? null,
        status: (db?.status ?? 'not_started') as ComplianceTask['status'],
        filedAt: db?.filedAt ?? null,
        arn: db?.arn ?? null,
        notes: db?.notes ?? null,
        autoStatus: getAutoStatus(exp.dueDate, db?.status ?? 'not_started'),
        daysUntil: getDaysUntil(exp.dueDate),
      }
    })
  })()

  const updateStatus = useCallback(async (
    row: typeof mergedRows[0],
    newStatus: ComplianceTask['status']
  ) => {
    if (!companyId) return
    const key = row.id ?? `${row.companyId}|${row.filingType}|${row.periodLabel}`
    setUpdatingId(key)
    try {
      if (row.id) {
        await apiPatch(`/api/compliance-tasks/${row.id}?companyId=${companyId}`, { status: newStatus })
      } else {
        await apiPost(`/api/compliance-tasks?companyId=${row.companyId}`, {
          filingType: row.filingType,
          periodLabel: row.periodLabel,
          dueDate: row.dueDate,
          status: newStatus,
        })
      }
      await loadTasks()
    } catch { /* silent */ } finally {
      setUpdatingId(null)
    }
  }, [companyId, loadTasks])

  const handleSaveReminders = useCallback(async () => {
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

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const filtered = mergedRows.filter(r => {
    if (filterType !== 'all' && r.filingType !== filterType) return false
    if (filterStatus !== 'all' && r.autoStatus !== filterStatus) return false
    return true
  })

  const stats = {
    overdue:  mergedRows.filter(r => r.autoStatus === 'overdue').length,
    dueSoon:  mergedRows.filter(r => r.autoStatus === 'due_soon').length,
    upcoming: mergedRows.filter(r => r.autoStatus === 'upcoming').length,
    filed:    mergedRows.filter(r => r.autoStatus === 'filed').length,
    total:    mergedRows.length,
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

  const filingTypes = ['all', 'GSTR-1', 'GSTR-3B', 'TDS', 'PF/ESI', 'Advance Tax']

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
            <HeaderBadge label={`${stats.filed} filed`} tone="success" />
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

      {/* Stats — clickable to filter */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Overdue',       value: stats.overdue,  color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]', filter: 'overdue' },
          { label: 'Due in 5 days', value: stats.dueSoon,  color: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]', filter: 'due_soon' },
          { label: 'Upcoming',      value: stats.upcoming, color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]', border: 'border-[#BFDBFE]', filter: 'upcoming' },
          { label: 'Filed',         value: stats.filed,    color: 'text-[#059669]', bg: 'bg-[#ECFDF5]', border: 'border-[#A7F3D0]', filter: 'filed' },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => setFilterStatus(filterStatus === s.filter ? 'all' : s.filter)}
            className={cn('rounded-lg border p-4 text-left transition-all', s.bg, s.border,
              filterStatus === s.filter && 'ring-2 ring-offset-1 ring-[#0F172A]'
            )}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">{s.label}</p>
            <p className={cn('mt-1.5 text-2xl font-bold tabular-nums', s.color)}>{s.value}</p>
          </button>
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
            onClick={handleSaveReminders}
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
              className={cn('relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                remindersEnabled ? 'bg-[#2563EB]' : 'bg-[#E2E8F0]'
              )}
            >
              <span className={cn('pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                remindersEnabled ? 'translate-x-5' : 'translate-x-0'
              )} />
            </button>
          </div>
          <div>
            <label htmlFor="due-dates-alert-email" className="mb-1.5 block text-xs font-semibold text-[#374151]">Alert email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                id="due-dates-alert-email"
                name="alert-email"
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
            <label htmlFor="due-dates-reminder-days" className="mb-1.5 block text-xs font-semibold text-[#374151]">Remind me</label>
            <select
              id="due-dates-reminder-days"
              name="reminder-days"
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
        <div className="flex items-center gap-1 overflow-x-auto border-b border-[#E2E8F0] px-4 py-2.5">
          {filingTypes.map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn('shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                filterType === t ? 'bg-[#0F172A] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
              )}
            >
              {t === 'all' ? `All (${mergedRows.length})` : t}
            </button>
          ))}
          {filterStatus !== 'all' && (
            <button
              onClick={() => setFilterStatus('all')}
              className="ml-auto shrink-0 rounded-md border border-[#E2E8F0] px-2 py-1 text-[10px] font-medium text-[#94A3B8] hover:text-[#0F172A] transition-colors"
            >
              Clear filter ×
            </button>
          )}
        </div>

        {tasksLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#2563EB]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="fin-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Filing</th>
                  <th className="text-left">Client</th>
                  <th className="text-left">Due Date</th>
                  <th className="text-left">Workflow Status</th>
                  <th className="text-right">Days</th>
                  <th className="text-right">Remind</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-[#94A3B8]">
                      No filings for this period
                    </td>
                  </tr>
                ) : (
                  filtered.map(row => {
                    const tc = TYPE_COLORS[row.filingType] ?? TYPE_COLORS['TDS']
                    const sc = STATUS_CONFIG[row.status]
                    const rowKey = `${row.companyId}|${row.filingType}|${row.periodLabel}`
                    const isUpdating = updatingId === (row.id ?? rowKey)

                    const mailtoHref = `mailto:?subject=${encodeURIComponent(
                      `${row.filingType} due ${row.dueDate} — ${row.clientName}`
                    )}&body=${encodeURIComponent(
                      `Dear ${row.clientName},\n\nThis is a reminder that your ${row.filingType} for ${row.periodLabel} is due on ${row.dueDate}.\n\nPlease share the required documents at the earliest.\n\nRegards`
                    )}`

                    return (
                      <tr key={rowKey} className="hover-row">
                        <td className="!font-sans">
                          <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold', tc.bg, tc.border, tc.text)}>
                            {row.filingType}
                          </span>
                        </td>
                        <td className="!font-sans text-sm text-[#334155]">{row.clientName}</td>
                        <td className="!font-sans text-sm text-[#334155]">
                          {new Date(row.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="!font-sans">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={row.status}
                              disabled={isUpdating}
                              onChange={e => void updateStatus(row, e.target.value as ComplianceTask['status'])}
                              className={cn(
                                'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors focus:outline-none disabled:opacity-60 cursor-pointer',
                                sc.bg, sc.border, sc.color
                              )}
                            >
                              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                                <option key={val} value={val}>{cfg.label}</option>
                              ))}
                            </select>
                            {isUpdating && <Loader2 className="h-3 w-3 animate-spin text-[#94A3B8]" />}
                            {row.autoStatus === 'overdue' && row.status !== 'filed' && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-[#DC2626]">
                                <AlertTriangle className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={cn('text-right text-sm font-semibold tabular-nums',
                          row.daysUntil < 0 ? 'text-[#DC2626]' : row.daysUntil <= 5 ? 'text-[#D97706]' : 'text-[#64748B]'
                        )}>
                          {row.daysUntil < 0 ? `${Math.abs(row.daysUntil)}d ago`
                            : row.daysUntil === 0 ? 'Today'
                            : `${row.daysUntil}d`}
                        </td>
                        <td className="!font-sans text-right">
                          <a
                            href={mailtoHref}
                            className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] px-2 py-1 text-[11px] font-medium text-[#64748B] transition-colors hover:border-[#2563EB] hover:text-[#2563EB]"
                            title="Open pre-filled reminder email"
                          >
                            <Send className="h-3 w-3" />
                            Remind
                          </a>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  )
}
