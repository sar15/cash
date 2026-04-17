'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, ArrowRight, Check, Download, Upload } from 'lucide-react'

import { useCompanyContext } from '@/hooks/use-company-context'
import { useAccountsStore } from '@/stores/accounts-store'
import { useActualsStore } from '@/stores/actuals-store'
import { useCompanyStore } from '@/stores/company-store'
import { useImportMappingStore } from '@/stores/import-mapping-store'
import { apiPost } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'
import { AccountMappingReview } from '@/components/import/AccountMappingReview'

type Step = 1 | 2 | 3 | 4

type ParsedAccountType = 'revenue' | 'expense' | 'asset' | 'liability' | 'equity'

interface PreviewValue {
  period: string
  amountPaise: number
}

interface PreviewRow {
  rowIndex: number
  accountName: string
  mappedAccountId: string | null
  mappedAccountName: string | null
  matchType: 'exact' | 'fuzzy' | 'keyword' | 'unmapped' | 'alias' | 'saved' | 'skipped'
  confidence: number
  category: string | null
  accountType: ParsedAccountType | null
  values: PreviewValue[]
}

interface ValidationItem {
  period: string
  isValid: boolean
  errors: string[]
}

interface ParseResult {
  companyId: string
  fileKey: string
  rows: PreviewRow[]
  warnings: string[]
  validation: ValidationItem[]
  summary: {
    totalRows: number
    mappedRows: number
    unmappedRows: number
    periods: number
  }
}

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [
    { num: 1, label: 'Company' },
    { num: 2, label: 'Upload' },
    { num: 3, label: 'Map' },
    { num: 4, label: 'Publish' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-3">
      {steps.map((step) => (
        <div key={step.num} className="flex items-center gap-2.5">
          <div className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
            currentStep > step.num && 'border-[#059669] bg-[#059669] text-white',
            currentStep === step.num && 'border-[#059669] bg-[#ECFDF5] text-[#059669]',
            currentStep < step.num && 'border-[#E5E7EB] bg-[#F8FAFC] text-[#94A3B8]'
          )}>
            {currentStep > step.num ? <Check className="h-3.5 w-3.5" /> : step.num}
          </div>
          <span className={cn(
            'text-sm font-medium',
            currentStep >= step.num ? 'text-[#0F172A]' : 'text-[#94A3B8]'
          )}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  )
}

function UploadDropzone({ isUploading, onSelect }: { isUploading: boolean; onSelect: (file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault(); setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) onSelect(file)
      }}
      className={cn(
        'rounded-md border-2 border-dashed p-10 text-center transition-colors duration-[80ms]',
        isDragging ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#E5E7EB] bg-[#F8FAFC]',
        isUploading && 'pointer-events-none opacity-60'
      )}
    >
      {isUploading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#059669]" />
          <p className="text-sm text-[#64748B]">Uploading and parsing your workbook...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-md border border-[#E5E7EB] bg-white p-3">
            <Upload className="h-6 w-6 text-[#94A3B8]" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-[#0F172A]">Drop your P&amp;L or balance sheet file</p>
            <p className="max-w-xl text-sm leading-6 text-[#64748B]">
              Upload Excel or CSV data. CashFlowIQ will detect periods, auto-map accounts, and prepare the company for forecasting.
            </p>
          </div>
          <label className="btn-press cursor-pointer rounded bg-[#0F172A] px-4 py-2 text-sm font-medium text-white transition-colors duration-[80ms] hover:bg-[#1E293B]">
            Choose file
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) onSelect(file) }} />
          </label>
          <a href="/api/import/template"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] transition-colors duration-[80ms] hover:underline">
            <Download className="h-3.5 w-3.5" />
            Download the CSV template
          </a>
        </div>
      )}
    </div>
  )
}

function guessAccountType(row: PreviewRow): ParsedAccountType {
  if (row.accountType) return row.accountType
  switch (row.category) {
    case 'Revenue': return 'revenue'
    case 'COGS': case 'Operating Expenses': return 'expense'
    case 'Assets': return 'asset'
    case 'Liabilities': return 'liability'
    case 'Equity': return 'equity'
    default: return 'expense'
  }
}

export default function ImportClient() {
  const router = useRouter()
  const { company, companyId } = useCompanyContext()
  const updateCompany = useCompanyStore((state) => state.updateCompany)
  const loadAccounts = useAccountsStore((state) => state.load)
  const loadActuals = useActualsStore((state) => state.load)
  const resetMappingStore = useImportMappingStore((state) => state.reset)

  const [step, setStep] = useState<Step>(1)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [companyForm, setCompanyForm] = useState({
    name: '', pan: '', gstin: '', fyStartMonth: 4,
  })

  useEffect(() => {
    if (!company) return
    setCompanyForm({
      name: company.name, pan: company.pan ?? '', gstin: company.gstin ?? '', fyStartMonth: company.fyStartMonth,
    })
  }, [company])

  const handleProfileSave = useCallback(async () => {
    if (!companyId) return; setError(null)
    await updateCompany(companyId, {
      name: companyForm.name, pan: companyForm.pan || null, gstin: companyForm.gstin || null, fyStartMonth: companyForm.fyStartMonth,
    })
    setStep(2)
  }, [companyForm, companyId, updateCompany])

  const handleFileSelect = useCallback(async (file: File) => {
    if (!companyId) return; setIsUploading(true); setError(null)
    try {
      const formData = new FormData(); formData.append('file', file); formData.append('companyId', companyId)
      const uploadResponse = await fetch('/api/import/upload', { method: 'POST', body: formData })
      if (!uploadResponse.ok) throw new Error(await uploadResponse.text())
      const uploadData = (await uploadResponse.json()) as { fileKey: string; filename?: string }
      const parsed = await apiPost<ParseResult>('/api/import/parse', { companyId, fileKey: uploadData.fileKey })
      setFileName(uploadData.filename ?? file.name); setParseResult(parsed); setStep(3)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed')
    } finally { setIsUploading(false) }
  }, [companyId])

  const rows = useMemo(() => parseResult?.rows ?? [], [parseResult])

  const [editedRows, setEditedRows] = useState<PreviewRow[]>([])
  const mappedRows = useMemo(() =>
    rows.map((row) => ({ ...row, mappedAccountName: row.mappedAccountName ?? row.accountName, accountType: guessAccountType(row) })),
    [rows]
  )
  useEffect(() => { setEditedRows(mappedRows) }, [mappedRows])

  const handleSave = useCallback(async () => {
    if (!companyId || editedRows.length === 0) return; setIsSaving(true); setError(null)
    try {
      const accountMap = new Map<string, { name: string; accountType: ParsedAccountType; standardMapping?: string; sortOrder: number }>()
      editedRows.forEach((row, index) => {
        const mappedName = row.mappedAccountName?.trim() || row.accountName; const key = mappedName.toLowerCase()
        if (!accountMap.has(key)) {
          accountMap.set(key, { name: mappedName, accountType: guessAccountType(row), standardMapping: row.mappedAccountName ?? undefined, sortOrder: index })
        }
      })
      await apiPost('/api/import/save', {
        companyId, replaceExisting: true, accounts: Array.from(accountMap.values()),
        actuals: editedRows.flatMap((row) => {
          const mappedName = row.mappedAccountName?.trim() || row.accountName
          return row.values.map((value) => ({ accountName: mappedName, period: value.period, amount: value.amountPaise }))
        }),
      })
      await Promise.all([loadAccounts(companyId), loadActuals(companyId)]); setStep(4); router.push('/forecast')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Import save failed')
    } finally { setIsSaving(false) }
  }, [companyId, editedRows, loadAccounts, loadActuals, router])

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Data import"
        title="Import Pipeline"
        description="Upload, map, and publish financials from Excel or CSV."
        badges={
          <>
            <HeaderBadge label={fileName ? fileName : 'No file uploaded'} />
            <HeaderBadge label={parseResult ? `${parseResult.summary.periods} periods detected` : 'Awaiting workbook'} tone={parseResult ? 'success' : 'default'} />
          </>
        }
      />

      <SurfaceCard className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <StepIndicator currentStep={step} />
          {error ? (
            <div className="inline-flex items-center gap-1.5 rounded border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-xs font-medium text-[#DC2626]">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </div>
          ) : null}
        </div>

        {step === 1 ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Company profile before import</p>
                <p className="text-xs text-[#64748B]">Set identity and financial-year context.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="label-xs">Company name</label>
                  <input value={companyForm.name} onChange={(e) => setCompanyForm((c) => ({ ...c, name: e.target.value }))}
                    className="surface-input mt-1.5" />
                </div>
                <div>
                  <label className="label-xs">Financial year start</label>
                  <select value={companyForm.fyStartMonth} onChange={(e) => setCompanyForm((c) => ({ ...c, fyStartMonth: Number(e.target.value) }))}
                    className="surface-select mt-1.5">
                    <option value={4}>April (Indian FY)</option>
                    <option value={1}>January</option>
                    <option value={7}>July</option>
                    <option value={10}>October</option>
                  </select>
                </div>
                <div>
                  <label className="label-xs">PAN</label>
                  <input value={companyForm.pan} onChange={(e) => setCompanyForm((c) => ({ ...c, pan: e.target.value.toUpperCase() }))}
                    className="surface-input mt-1.5" />
                </div>
                <div>
                  <label className="label-xs">GSTIN</label>
                  <input value={companyForm.gstin} onChange={(e) => setCompanyForm((c) => ({ ...c, gstin: e.target.value.toUpperCase() }))}
                    className="surface-input mt-1.5" />
                </div>
              </div>
              <button onClick={() => void handleProfileSave()}
                className="btn-press inline-flex items-center gap-1.5 rounded bg-[#0F172A] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-[80ms] hover:bg-[#1E293B]">
                Continue to upload <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-5">
              <p className="text-sm font-semibold text-[#0F172A]">What happens next</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[#64748B]">
                <p>1. Upload a workbook or CSV from your accountant or ERP.</p>
                <p>2. Review the auto-mapped chart of accounts and any warnings.</p>
                <p>3. Publish the cleaned dataset into your forecast engine.</p>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? <UploadDropzone isUploading={isUploading} onSelect={handleFileSelect} /> : null}

        {step === 3 && parseResult ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
                <p className="label-xs">Rows detected</p>
                <p className="mt-1.5 font-num text-xl font-semibold text-[#0F172A]">{parseResult.summary.totalRows}</p>
              </div>
              <div className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3">
                <p className="label-xs text-[#059669]">Mapped rows</p>
                <p className="mt-1.5 font-num text-xl font-semibold text-[#059669]">{parseResult.summary.mappedRows}</p>
              </div>
              <div className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
                <p className="label-xs text-[#D97706]">Review rows</p>
                <p className="mt-1.5 font-num text-xl font-semibold text-[#D97706]">{parseResult.summary.unmappedRows}</p>
              </div>
            </div>

            {parseResult.warnings.length > 0 ? (
              <div className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
                <p className="text-sm font-semibold text-[#92400E]">Warnings to review</p>
                <ul className="mt-2 space-y-1 text-sm text-[#D97706]">
                  {parseResult.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            ) : null}

            {/* Human-in-the-loop mapping review */}
            <AccountMappingReview
              rows={rows}
              companyId={companyId ?? ''}
              onSaveAndImport={async () => {
                // Mappings already saved by AccountMappingReview — proceed to publish step
                setStep(4)
              }}
              onCancel={() => { resetMappingStore(); setStep(2) }}
            />
          </div>
        ) : null}

        {step === 4 && parseResult ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {parseResult.validation.map((item) => (
                <div key={item.period} className={cn(
                  'rounded-md border px-4 py-3',
                  item.isValid ? 'border-[#A7F3D0] bg-[#ECFDF5]' : 'border-[#FECACA] bg-[#FEF2F2]'
                )}>
                  <p className="text-sm font-semibold text-[#0F172A]">{item.period}</p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    {item.isValid ? 'Balance check passed.' : item.errors[0] ?? 'Needs manual review.'}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Ready to publish</p>
                <p className="text-xs text-[#64748B]">
                  Save {editedRows.length} mapped rows and move into the forecast workspace.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(3)}
                  className="btn-press inline-flex items-center gap-1.5 rounded border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#475569] transition-colors duration-[80ms] hover:border-[#D1D5DB]">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <button onClick={() => void handleSave()} disabled={isSaving}
                  className="btn-press inline-flex items-center gap-1.5 rounded bg-[#059669] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-[80ms] hover:bg-[#047857] disabled:opacity-50">
                  {isSaving ? <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" /> : <Check className="h-3.5 w-3.5" />}
                  Publish to forecast
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </SurfaceCard>
    </div>
  )
}

