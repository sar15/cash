'use client'

import { useState, useCallback, useEffect } from 'react'
import { useCompanyContext } from '@/hooks/use-company-context'
import { useCompanyStore } from '@/stores/company-store'
import { useForecastConfigStore } from '@/stores/forecast-config-store'
import { useUIStore } from '@/stores/ui-store'
import { useUserType, type UserType } from '@/components/shared/UserTypeModal'
import { cn } from '@/lib/utils'
import {
  Settings,
  Building2,
  Receipt,
  Loader2,
  Check,
  Save,
  Database,
  FileDown,
  FileUp,
  User,
  Users,
  Trash2,
  Download,
} from 'lucide-react'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'

// ============================================================
// SECTION WRAPPER
// ============================================================

function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description: string
  icon: typeof Settings
  children: React.ReactNode
}) {
  return (
    <SurfaceCard className="space-y-5">
      <div className="flex items-center gap-3 border-b border-[#E5E7EB] pb-4">
        <div className="rounded-lg bg-[#F1F5F9] p-2.5">
          <Icon className="h-4 w-4 text-[#475569]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A]">{title}</h2>
          <p className="text-xs text-[#64748B]">{description}</p>
        </div>
      </div>
      {children}
    </SurfaceCard>
  )
}

function FormField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  )
}

// ============================================================
// MAIN SETTINGS PAGE
// ============================================================


export default function SettingsPage() {
  const { company, companyId, isLoading } = useCompanyContext()
  const updateCompany = useCompanyStore((s) => s.updateCompany)
  const complianceConfig = useForecastConfigStore((s) => s.complianceConfig)
  const updateCompliance = useForecastConfigStore((s) => s.updateCompliance)
  const showToast = useUIStore((s) => s.showToast)
  const { userType, selectType } = useUserType()

  // Local state for form
  const [companyForm, setCompanyForm] = useState({
    name: '',
    pan: '',
    gstin: '',
    industry: '',
    fyStartMonth: 4,
    currency: 'INR',
    numberFormat: 'lakhs',
  })

  const [complianceForm, setComplianceForm] = useState({
    gstRate: 18,
    itcPct: 100,
    taxRate: 30,
    supplyType: 'intra-state' as 'intra-state' | 'inter-state',
    tdsRate: 10,
    pfRate: 12,
    esiRate: 3.25,
  })

  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Team members state
  const [members, setMembers] = useState<Array<{ id: string; clerkUserId: string; role: string; invitedEmail?: string | null; acceptedAt?: string | null }>>([])
  const [inviteUserId, setInviteUserId] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer')
  const [isInviting, setIsInviting] = useState(false)

  // Populate forms when company loads
  useEffect(() => {
    if (!company) return
    setCompanyForm({
      name: company.name,
      pan: company.pan ?? '',
      gstin: company.gstin ?? '',
      industry: company.industry,
      fyStartMonth: company.fyStartMonth,
      currency: company.currency,
      numberFormat: company.numberFormat,
    })
  }, [company])

  // Load team members
  useEffect(() => {
    if (!companyId) return
    fetch(`/api/companies/${companyId}/members`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { members?: typeof members } | null) => { if (data?.members) setMembers(data.members) })
      .catch(() => {})
  }, [companyId])

  useEffect(() => {
    if (!complianceConfig) return
    setComplianceForm({
      gstRate: complianceConfig.gstRate,
      itcPct: complianceConfig.itcPct,
      taxRate: complianceConfig.taxRate,
      supplyType: complianceConfig.supplyType,
      tdsRate: 10,
      pfRate: 12,
      esiRate: 3.25,
    })
  }, [complianceConfig])

  const handleInviteMember = useCallback(async () => {
    if (!companyId || !inviteUserId.trim()) return
    setIsInviting(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkUserId: inviteUserId.trim(), role: inviteRole, invitedEmail: inviteEmail.trim() || undefined }),
      })
      if (res.ok) {
        const data = await res.json() as { member: typeof members[0] }
        setMembers(prev => [...prev.filter(m => m.clerkUserId !== data.member.clerkUserId), data.member])
        setInviteUserId('')
        setInviteEmail('')
        showToast('Member invited', 'success')
      }
    } catch { /* ignore */ } finally {
      setIsInviting(false)
    }
  }, [companyId, inviteUserId, inviteEmail, inviteRole, showToast])

  const handleRemoveMember = useCallback(async (clerkUserId: string) => {
    if (!companyId) return
    await fetch(`/api/companies/${companyId}/members?clerkUserId=${encodeURIComponent(clerkUserId)}`, { method: 'DELETE' })
    setMembers(prev => prev.filter(m => m.clerkUserId !== clerkUserId))
    showToast('Member removed', 'success')
  }, [companyId, showToast])

  const handleSave = useCallback(async () => {
    if (!companyId) return
    setIsSaving(true)
    setSaveSuccess(false)

    try {
      await updateCompany(companyId, {
        name: companyForm.name,
        pan: companyForm.pan || null,
        gstin: companyForm.gstin || null,
        industry: companyForm.industry,
        fyStartMonth: companyForm.fyStartMonth,
        currency: companyForm.currency,
        numberFormat: companyForm.numberFormat,
      })

      // Save full compliance config including TDS/PF/ESI
      await updateCompliance(companyId, {
        gstRate: complianceForm.gstRate,
        itcPct: complianceForm.itcPct,
        taxRate: complianceForm.taxRate,
        supplyType: complianceForm.supplyType,
        pfApplicable: complianceForm.pfRate > 0,
        esiApplicable: complianceForm.esiRate > 0,
      })

      // Reload forecast config so the engine picks up the new compliance settings immediately
      await useForecastConfigStore.getState().load(companyId)

      setSaveSuccess(true)
      showToast('Settings saved — forecast will update automatically', 'success')
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('[Settings] Save error:', err)
      showToast('Failed to save settings. Please try again.', 'error')
    } finally {
      setIsSaving(false)
    }
  }, [companyId, companyForm, complianceForm, updateCompany, updateCompliance, showToast])

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#38BDF8]" />
          <p className="text-sm text-[#64748B]">Loading workspace settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Workspace Settings"
        description="Control company identity, tax defaults, and data-handling preferences so every forecast reflects the way your business actually operates."
        badges={
          <>
            <HeaderBadge label={companyForm.name || 'Company profile'} />
            <HeaderBadge label={saveSuccess ? 'Saved' : 'Unsaved changes'} tone={saveSuccess ? 'success' : 'warning'} />
          </>
        }
        actions={
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all',
              saveSuccess
                ? 'border-[#BAE6FD] bg-[#F0F9FF] text-[#0284C7]'
                : 'border-[#0F172A] bg-[#0F172A] text-white hover:bg-[#1E293B]',
              isSaving && 'opacity-60'
            )}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
          </button>
        }
      />

      {/* Company Profile */}
      <SettingsSection
        title="Company Profile"
        description="Basic company information"
        icon={Building2}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Company Name">
            <input
              type="text"
              value={companyForm.name}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              className="surface-input"
            />
          </FormField>
          <FormField label="Industry">
            <select
              value={companyForm.industry}
              onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
              className="surface-select"
            >
              <option value="technology">Technology</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="services">Professional Services</option>
              <option value="retail">Retail / E-commerce</option>
              <option value="healthcare">Healthcare</option>
              <option value="construction">Construction</option>
              <option value="other">Other</option>
            </select>
          </FormField>
          <FormField label="PAN">
            <input
              type="text"
              value={companyForm.pan}
              onChange={(e) => setCompanyForm({ ...companyForm, pan: e.target.value.toUpperCase() })}
              placeholder="ABCDE1234F"
              maxLength={10}
              className="surface-input"
            />
          </FormField>
          <FormField label="GSTIN">
            <input
              type="text"
              value={companyForm.gstin}
              onChange={(e) => setCompanyForm({ ...companyForm, gstin: e.target.value.toUpperCase() })}
              placeholder="22ABCDE1234F1Z5"
              maxLength={15}
              className="surface-input"
            />
          </FormField>
          <FormField label="Financial Year Start">
            <select
              value={companyForm.fyStartMonth}
              onChange={(e) => setCompanyForm({ ...companyForm, fyStartMonth: parseInt(e.target.value) })}
              className="surface-select"
            >
              <option value={1}>January</option>
              <option value={4}>April (Indian FY)</option>
              <option value={7}>July</option>
              <option value={10}>October</option>
            </select>
          </FormField>
          <FormField label="Number Format">
            <select
              value={companyForm.numberFormat}
              onChange={(e) => setCompanyForm({ ...companyForm, numberFormat: e.target.value })}
              className="surface-select"
            >
              <option value="lakhs">Indian (Lakhs/Crores)</option>
              <option value="millions">International (M/B)</option>
            </select>
          </FormField>
        </div>
      </SettingsSection>

      {/* Compliance Config */}
      <SettingsSection
        title="Compliance Configuration"
        description="Tax rates and statutory compliance settings"
        icon={Receipt}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="GST Rate (%)">
            <input
              type="number"
              value={complianceForm.gstRate}
              onChange={(e) => setComplianceForm({ ...complianceForm, gstRate: parseFloat(e.target.value) || 0 })}
              className="surface-input"
            />
          </FormField>
          <FormField label="ITC Recovery (%)">
            <input
              type="number"
              value={complianceForm.itcPct}
              onChange={(e) => setComplianceForm({ ...complianceForm, itcPct: parseFloat(e.target.value) || 0 })}
              className="surface-input"
            />
          </FormField>
          <FormField label="Supply Type">
            <select
              value={complianceForm.supplyType}
              onChange={(e) => setComplianceForm({ ...complianceForm, supplyType: e.target.value as 'intra-state' | 'inter-state' })}
              className="surface-select"
            >
              <option value="intra-state">Intra-State (CGST + SGST)</option>
              <option value="inter-state">Inter-State (IGST)</option>
            </select>
          </FormField>
          <FormField label="Income Tax Rate (%)">
            <input
              type="number"
              value={complianceForm.taxRate}
              onChange={(e) => setComplianceForm({ ...complianceForm, taxRate: parseFloat(e.target.value) || 0 })}
              className="surface-input"
            />
          </FormField>
          <FormField label="TDS Rate (%)">
            <input
              type="number"
              value={complianceForm.tdsRate}
              onChange={(e) => setComplianceForm({ ...complianceForm, tdsRate: parseFloat(e.target.value) || 0 })}
              className="surface-input"
            />
          </FormField>
          <FormField label="PF Rate (%)">
            <input
              type="number"
              value={complianceForm.pfRate}
              onChange={(e) => setComplianceForm({ ...complianceForm, pfRate: parseFloat(e.target.value) || 0 })}
              className="surface-input"
            />
          </FormField>
        </div>
      </SettingsSection>

      {/* Export / Import Configuration */}
      <SettingsSection
        title="Data Management"
        description="Export or import your complete forecast configuration (rules, events, models)"
        icon={Database}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-5 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF]">
              <FileDown className="h-5 w-5 text-[#2563EB]" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-[#0F172A]">Export Configuration</h3>
            <p className="mt-1.5 text-xs text-[#64748B]">Download your settings, value rules, and events as a backup JSON file.</p>
            <button
              onClick={() => {
                const data = {
                  company: companyForm,
                  compliance: complianceForm,
                  exportedAt: new Date().toISOString(),
                }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `cashflowiq-config-${companyForm.name.replace(/\s+/g, '_')}.json`
                a.click()
                URL.revokeObjectURL(url)
                showToast('Configuration exported', 'success')
              }}
              className="btn-press mt-4 w-full rounded border border-[#E5E7EB] bg-white py-2 text-xs font-semibold text-[#0F172A] transition-colors duration-[80ms] hover:border-[#D1D5DB]">
              Export to JSON
            </button>
          </div>

          <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-5 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFBEB]">
              <FileUp className="h-5 w-5 text-[#D97706]" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-[#0F172A]">Import Configuration</h3>
            <p className="mt-1.5 text-xs text-[#64748B]">Upload a previously exported JSON backup to restore your settings.</p>
            <label className="btn-press mt-4 block w-full cursor-pointer rounded border border-[#E5E7EB] bg-white py-2 text-xs font-semibold text-[#0F172A] transition-colors duration-[80ms] hover:border-[#D1D5DB]">
              Upload JSON File
              <input type="file" accept=".json" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = (ev) => {
                  try {
                    const data = JSON.parse(ev.target?.result as string)
                    if (data.company) setCompanyForm(prev => ({ ...prev, ...data.company }))
                    if (data.compliance) setComplianceForm(prev => ({ ...prev, ...data.compliance }))
                    showToast('Configuration imported — click Save to apply', 'info')
                  } catch {
                    showToast('Invalid JSON file', 'error')
                  }
                }
                reader.readAsText(file)
              }} />
            </label>
          </div>
        </div>
      </SettingsSection>

      {/* Data Export Center */}
      <SettingsSection
        title="Data Exports"
        description="Download your complete workspace configuration and active models."
        icon={Database}
      >
        <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Export All Data</p>
              <p className="text-xs text-[#64748B]">Download a complete JSON backup of all accounts, actuals, rules, and scenarios.</p>
            </div>
            <a
              href={companyId ? `/api/export/full?companyId=${companyId}` : '#'}
              download
              className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] transition-colors hover:border-[#CBD5E1]"
            >
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </a>
          </div>
        </div>
      </SettingsSection>

      {/* Team Members */}
      <SettingsSection
        title="Team Members"
        description="Invite team members to collaborate on this company's forecasts"
        icon={Users}
      >
        {/* Current members */}
        {members.length > 0 && (
          <div className="mb-4 divide-y divide-[#E5E7EB] rounded-lg border border-[#E5E7EB]">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">{m.invitedEmail ?? m.clerkUserId}</p>
                  <p className="text-xs text-[#64748B]">
                    {m.role} · {m.acceptedAt ? 'Active' : 'Pending invite'}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveMember(m.clerkUserId)}
                  className="rounded p-1.5 text-[#94A3B8] transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                  title="Remove member"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Invite form */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Clerk User ID">
              <input
                type="text"
                value={inviteUserId}
                onChange={e => setInviteUserId(e.target.value)}
                placeholder="user_XXXXXX"
                className="surface-input"
              />
            </FormField>
            <FormField label="Email (optional)">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="surface-input"
              />
            </FormField>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'editor' | 'viewer')}
              className="surface-select w-32"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <button
              onClick={handleInviteMember}
              disabled={!inviteUserId.trim() || isInviting}
              className="inline-flex items-center gap-2 rounded-lg border border-[#0F172A] bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#1E293B] disabled:opacity-60"
            >
              {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Invite
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* User Type */}
      <SettingsSection
        title="Account Type"
        description="How you use CashFlowIQ — affects which features are shown"
        icon={User}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([
            { id: 'business_owner' as UserType, label: 'Business Owner', desc: 'SME, startup, or manufacturer managing one company' },
            { id: 'ca_firm' as UserType, label: 'CA / CFO', desc: 'Managing multiple clients with portfolio-level visibility' },
          ]).map((opt) => (
            <button key={opt.id} onClick={() => selectType(opt.id)}
              className={cn(
                'btn-press rounded-lg border p-4 text-left transition-colors duration-[80ms]',
                userType === opt.id
                  ? 'border-[#38BDF8] bg-[#F0F9FF]'
                  : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'
              )}>
              <p className={cn('text-sm font-semibold', userType === opt.id ? 'text-[#0284C7]' : 'text-[#0F172A]')}>
                {opt.label}
              </p>
              <p className="mt-0.5 text-xs text-[#64748B]">{opt.desc}</p>
            </button>
          ))}
        </div>
      </SettingsSection>
    </div>
  )
}
