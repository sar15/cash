'use client'

import { useState, useCallback, useEffect } from 'react'
import { useCompanyContext } from '@/hooks/use-company-context'
import { useCompanyStore } from '@/stores/company-store'
import { useForecastConfigStore } from '@/stores/forecast-config-store'
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
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-emerald-400/10 p-2.5">
          <Icon className="h-5 w-5 text-emerald-300" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-xs text-slate-400">{description}</p>
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
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
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

      // Save compliance config
      await updateCompliance(companyId, {
        gstRate: complianceForm.gstRate,
        itcPct: complianceForm.itcPct,
        taxRate: complianceForm.taxRate,
        supplyType: complianceForm.supplyType,
      })

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('[Settings] Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }, [companyId, companyForm, complianceForm, updateCompany, updateCompliance])

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm text-slate-400">Loading workspace settings...</p>
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
              'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-slate-950 transition-all',
              saveSuccess ? 'bg-emerald-400' : 'bg-emerald-500 hover:bg-emerald-400',
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
          <div className="hover-lift rounded-[20px] border border-white/8 bg-white/5 p-5 text-center transition-colors hover:bg-white/8">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/10">
              <FileDown className="h-5 w-5 text-sky-300" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">Export Configuration</h3>
            <p className="mt-1.5 text-xs text-slate-400">Download your settings, value rules, and events as a backup JSON file.</p>
            <button className="mt-4 w-full rounded-full border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/10">
              Export to JSON
            </button>
          </div>

          <div className="hover-lift rounded-[20px] border border-white/8 bg-white/5 p-5 text-center transition-colors hover:bg-white/8">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10">
              <FileUp className="h-5 w-5 text-amber-300" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">Import Configuration</h3>
            <p className="mt-1.5 text-xs text-slate-400">Upload a previously exported JSON backup to restore your settings and models.</p>
            <button className="mt-4 w-full rounded-full border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/10">
              Upload JSON File
            </button>
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}
