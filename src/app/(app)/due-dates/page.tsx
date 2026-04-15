'use client'

import { useMemo, useCallback } from 'react'
import { useCompanyContext } from '@/hooks/use-company-context'
import { ComplianceWidget } from '@/components/dashboard/ComplianceWidget'
import { CalendarClock, Bell, Settings, Mail, Save, Check, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'
import { apiGet, apiPost } from '@/lib/api/client'

export default function DueDatesPage() {
  const { companies, isCA, isLoading, companyId } = useCompanyContext()
  const [remindersEnabled, setRemindersEnabled] = useState(false)
  const [reminderDays, setReminderDays] = useState('3')
  const [alertEmail, setAlertEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load reminder config from DB
  useEffect(() => {
    if (!companyId) return
    apiGet<{ config: { enabled: boolean; alertEmail: string | null; reminderDays: number } }>(
      `/api/reminder-config?companyId=${companyId}`
    ).then(data => {
      setRemindersEnabled(data.config.enabled ?? false)
      setReminderDays(String(data.config.reminderDays ?? 3))
      setAlertEmail(data.config.alertEmail ?? '')
    }).catch(() => {
      // Fallback to localStorage for offline/error case
      try {
        const saved = localStorage.getItem('cashflowiq_reminder_config')
        if (saved) {
          const parsed = JSON.parse(saved) as { enabled: boolean; days: string; email: string }
          setRemindersEnabled(parsed.enabled ?? false)
          setReminderDays(parsed.days ?? '3')
          setAlertEmail(parsed.email ?? '')
        }
      } catch { /* ignore */ }
    })
  }, [companyId])

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
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch {
      // Fallback to localStorage
      try {
        localStorage.setItem('cashflowiq_reminder_config', JSON.stringify({ enabled: remindersEnabled, days: reminderDays, email: alertEmail }))
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
      } catch { /* ignore */ }
    } finally {
      setIsSaving(false)
    }
  }, [companyId, remindersEnabled, alertEmail, reminderDays])

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
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#059669]" />
          <p className="text-sm text-[#64748B]">Loading due dates...</p>
        </div>
      </div>
    )
  }

  if (!isCA) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <SurfaceCard className="max-w-md p-8 text-center">
          <div className="mx-auto rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-5 w-fit">
            <CalendarClock className="h-10 w-10 text-[#94A3B8]" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-[#0F172A]">Due Date Manager</h2>
          <p className="mt-3 text-sm leading-6 text-[#64748B]">
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
        <div className="animate-slide-up rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#DC2626]">Overdue</p>
          <p className="mt-2 font-num text-3xl font-semibold text-[#DC2626] tabular-nums">{overdue.length}</p>
        </div>
        <div className="animate-slide-up rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D97706]">Upcoming</p>
          <p className="mt-2 font-num text-3xl font-semibold text-[#D97706] tabular-nums">{upcoming.length}</p>
        </div>
        <div className="animate-slide-up rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#059669]">Filed</p>
          <p className="mt-2 font-num text-3xl font-semibold text-[#059669] tabular-nums">{filed.length}</p>
        </div>
      </div>

      {/* Reminders Config */}
      <SurfaceCard>
        <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#EFF6FF] p-2.5">
              <Bell className="h-4 w-4 text-[#2563EB]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">Auto-Reminder Configuration</h2>
              <p className="text-xs text-[#64748B]">Configure automated email alerts for upcoming compliance deadlines.</p>
            </div>
          </div>
          <button
            onClick={handleSaveReminders}
            disabled={isSaving}
            className="flex w-fit items-center gap-2 rounded-lg border border-[#059669] bg-[#059669] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#047857] disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveSuccess ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saveSuccess ? 'Saved' : 'Save Config'}
          </button>
        </div>

        <div className="space-y-5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-[#0F172A]">Enable Email Alerts</h3>
              <p className="text-xs text-[#64748B]">Receive an email when a filing is approaching.</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input type="checkbox" className="peer sr-only" checked={remindersEnabled} onChange={(e) => setRemindersEnabled(e.target.checked)} />
              <div className="peer h-6 w-11 rounded-full bg-[#E5E7EB] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-[#E5E7EB] after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#059669] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">Alert Email</label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                <input
                  type="email"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  placeholder="admin@cafirm.com"
                  disabled={!remindersEnabled}
                  className="surface-input pl-9 disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">Remind Me</label>
              <div className="relative mt-2">
                <Settings className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                <select
                  value={reminderDays}
                  onChange={(e) => setReminderDays(e.target.value)}
                  disabled={!remindersEnabled}
                  className="surface-select pl-9 disabled:opacity-50"
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
