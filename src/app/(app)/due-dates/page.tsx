'use client'

import { useMemo } from 'react'
import { useCompanyContext } from '@/hooks/use-company-context'
import { ComplianceWidget } from '@/components/dashboard/ComplianceWidget'
import { CalendarClock, Loader2, Bell, Settings, Mail, Save, Check } from 'lucide-react'
import { useState } from 'react'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'

export default function DueDatesPage() {
  const { companies, isCA, isLoading } = useCompanyContext()
  const [remindersEnabled, setRemindersEnabled] = useState(false)
  const [reminderDays, setReminderDays] = useState('3')
  const [alertEmail, setAlertEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleSaveReminders = () => {
    setIsSaving(true)
    setSaveSuccess(false)
    setTimeout(() => {
      setIsSaving(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    }, 1000)
  }

  // Generate due dates across all companies
  const allFilings = useMemo(() => {
    if (companies.length === 0) return []

    const now = new Date()
    const m = now.getMonth()
    const y = now.getFullYear()

    return companies.flatMap((company) => [
      {
        id: `gst-${company.id}`,
        name: 'GST R-1',
        dueDate: new Date(y, m, 11).toISOString(),
        status: (now.getDate() > 11 ? 'overdue' : 'upcoming') as 'overdue' | 'upcoming',
        clientName: company.name,
      },
      {
        id: `tds-${company.id}`,
        name: 'TDS Deposit',
        dueDate: new Date(y, m, 7).toISOString(),
        status: (now.getDate() > 7 ? 'overdue' : 'upcoming') as 'overdue' | 'upcoming',
        clientName: company.name,
      },
      {
        id: `gst3b-${company.id}`,
        name: 'GST R-3B',
        dueDate: new Date(y, m, 20).toISOString(),
        status: (now.getDate() > 20 ? 'overdue' : 'upcoming') as 'overdue' | 'upcoming',
        clientName: company.name,
      },
      {
        id: `pf-${company.id}`,
        name: 'PF/ESI Deposit',
        dueDate: new Date(y, m, 15).toISOString(),
        status: (now.getDate() > 15 ? 'filed' : 'upcoming') as 'filed' | 'upcoming',
        clientName: company.name,
      },
    ])
  }, [companies])

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm text-slate-400">Loading due dates...</p>
        </div>
      </div>
    )
  }

  if (!isCA) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <SurfaceCard className="max-w-md p-8 text-center">
          <div className="mx-auto rounded-2xl border border-white/10 bg-white/5 p-5 w-fit">
            <CalendarClock className="h-10 w-10 text-slate-500" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-white">Due Date Manager</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            This feature is for CAs managing multiple clients. Add more companies
            to see a consolidated due date view.
          </p>
        </SurfaceCard>
      </div>
    )
  }

  // Split into overdue and upcoming
  const overdue = allFilings.filter((f) => f.status === 'overdue')
  const upcoming = allFilings.filter((f) => f.status === 'upcoming')
  const filed = allFilings.filter((f) => f.status === 'filed')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Due dates"
        title="Due Date Manager"
        description={`Track every near-term filing across ${companies.length} clients and keep reminders centralized for the firm.`}
        badges={
          <>
            <HeaderBadge label={`${overdue.length} overdue`} tone={overdue.length > 0 ? 'danger' : 'success'} />
            <HeaderBadge label={`${upcoming.length} upcoming`} tone="warning" />
          </>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stagger-enter rounded-[20px] border border-rose-400/15 bg-rose-400/5 p-5 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-300">Overdue</p>
          <p className="mt-2 text-3xl font-semibold text-rose-300 tabular-nums">{overdue.length}</p>
        </div>
        <div className="stagger-enter rounded-[20px] border border-amber-400/15 bg-amber-400/5 p-5 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">Upcoming</p>
          <p className="mt-2 text-3xl font-semibold text-amber-300 tabular-nums">{upcoming.length}</p>
        </div>
        <div className="stagger-enter rounded-[20px] border border-emerald-400/15 bg-emerald-400/5 p-5 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Filed</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300 tabular-nums">{filed.length}</p>
        </div>
      </div>

      {/* Reminders Config */}
      <SurfaceCard>
        <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-400/10 p-2.5">
              <Bell className="h-5 w-5 text-sky-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Auto-Reminder Configuration</h2>
              <p className="text-xs text-slate-400">Configure automated email alerts for upcoming compliance deadlines.</p>
            </div>
          </div>
          <button
            onClick={handleSaveReminders}
            disabled={isSaving}
            className="flex w-fit items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveSuccess ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saveSuccess ? 'Saved' : 'Save Config'}
          </button>
        </div>

        <div className="space-y-5 rounded-[20px] border border-white/8 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-white">Enable Email Alerts</h3>
              <p className="text-xs text-slate-400">Receive an email when a filing is approaching.</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input type="checkbox" className="peer sr-only" checked={remindersEnabled} onChange={(e) => setRemindersEnabled(e.target.checked)} />
              <div className="peer h-6 w-11 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-white/20 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Alert Email</label>
              <div className="relative mt-2">
                <Mail className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  placeholder="admin@cafirm.com"
                  disabled={!remindersEnabled}
                  className="surface-input pl-10 disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Remind Me</label>
              <div className="relative mt-2">
                <Settings className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                <select
                  value={reminderDays}
                  onChange={(e) => setReminderDays(e.target.value)}
                  disabled={!remindersEnabled}
                  className="surface-select pl-10 disabled:opacity-50"
                >
                  <option value="1">1 Day Before</option>
                  <option value="3">3 Days Before</option>
                  <option value="5">5 Days Before</option>
                  <option value="7">1 Week Before</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* Full filing list */}
      <ComplianceWidget filings={allFilings} showClientName />
    </div>
  )
}
