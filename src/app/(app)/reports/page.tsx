'use client'

import { useState, useRef, useMemo } from 'react'
import { useCompanyContext } from '@/hooks/use-company-context'
import { useCurrentForecast } from '@/hooks/use-current-forecast'
import { useCompanyStore } from '@/stores/company-store'
import { useUser } from '@clerk/nextjs'
import { FileText, Download, Calendar, BarChart3, Loader2 } from 'lucide-react'
import { PageHeader, HeaderBadge, SurfaceCard } from '@/components/shared/page-header'
import { cn } from '@/lib/utils'
import { aggregateAnnual } from '@/lib/reports/annual-aggregator'
import { generatePeriodKey } from '@/lib/utils/date-utils'
import { AnnualStatementView, type AnnualStatementViewHandle } from '@/components/reports/AnnualStatementView'

type ReportsTab = 'pdf' | 'annual'

export default function ReportsPage() {
  const { company, companyId } = useCompanyContext()
  const { engineResult, isReady } = useCurrentForecast()
  const companyData = useCompanyStore((s) => s.activeCompany())
  const { user } = useUser()

  // Tab state
  const [activeTab, setActiveTab] = useState<ReportsTab>('pdf')

  // PDF export state
  const [isGenerating, setIsGenerating] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [includeWaterfall, setIncludeWaterfall] = useState(true)
  const [includeScenarios, setIncludeScenarios] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Annual tab PDF export state
  const [isExportingAnnual, setIsExportingAnnual] = useState(false)
  const [annualExportError, setAnnualExportError] = useState<string | null>(null)

  // Ref to AnnualStatementView for flushing notes before export
  const annualViewRef = useRef<AnnualStatementViewHandle>(null)

  // Determine user role (owner if company.clerkUserId matches user.id, else editor)
  const userRole = useMemo<'owner' | 'editor' | 'viewer'>(() => {
    if (!user || !companyData) return 'viewer'
    if (companyData.clerkUserId === user.id) return 'owner'
    return 'editor'
  }, [user, companyData])

  // Aggregate current year data for Annual tab
  const currentYear = useMemo(() => {
    if (!engineResult?.rawIntegrationResults?.length) return null
    return aggregateAnnual(engineResult.rawIntegrationResults)
  }, [engineResult])

  // Generate period keys
  const fyStartMonth = companyData?.fyStartMonth ?? 4
  const currentYearNum = new Date().getFullYear()
  const periodKey = generatePeriodKey(fyStartMonth, currentYearNum)
  const priorPeriodKey = generatePeriodKey(fyStartMonth, currentYearNum - 1)

  // ── PDF Report Generation ─────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!companyId || !periodStart || !periodEnd) return

    setIsGenerating(true)
    setError(null)
    try {
      const startDate = `${periodStart}-01`
      const endParts = periodEnd.split('-')
      const lastDay = new Date(parseInt(endParts[0]), parseInt(endParts[1]), 0).getDate()
      const endDate = `${periodEnd}-${String(lastDay).padStart(2, '0')}`

      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Company-Id': companyId },
        body: JSON.stringify({
          companyId,
          periodStart: startDate,
          periodEnd: endDate,
          includeWaterfall,
          includeScenarios,
        }),
      })

      if (response.ok) {
        const contentType = response.headers.get('content-type') ?? ''
        if (contentType.includes('application/pdf')) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${company?.name ?? 'report'}_${periodStart}_${periodEnd}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        } else {
          const data = await response.json()
          window.open(data.downloadUrl, '_blank')
        }
      } else {
        const err = await response.json().catch(() => ({ error: 'Report generation failed' }))
        setError((err as { error?: string }).error ?? 'Report generation failed')
      }
    } catch (error) {
      console.error('Report generation failed:', error)
      setError('Failed to generate report. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Annual Statements PDF Export ──────────────────────────────────────────
  const handleExportAnnualPDF = async () => {
    if (!companyId || !engineResult) return

    setIsExportingAnnual(true)
    setAnnualExportError(null)

    try {
      // Step 1: Flush all pending note saves before export
      if (annualViewRef.current) {
        await annualViewRef.current.flushAllNotes()
      }

      // Step 2: Fetch latest notes from API for all three statements
      const fetchNote = async (statementType: 'PL' | 'BS' | 'CF') => {
        try {
          const params = new URLSearchParams({ companyId, statementType, periodKey })
          const res = await fetch(`/api/notes?${params.toString()}`)
          if (!res.ok) return ''
          const data = await res.json()
          const bullets = (data.autoSummary as string[]).map((b: string) => `• ${b}`).join('\n')
          const userText = data.userNotes ?? ''
          return [bullets, userText].filter(Boolean).join('\n\n')
        } catch { return '' }
      }

      const [plNotes, bsNotes, cfNotes] = await Promise.all([
        fetchNote('PL'), fetchNote('BS'), fetchNote('CF'),
      ])

      // Step 3: Call the new annual PDF endpoint (two-column Schedule III format)
      const response = await fetch('/api/reports/generate-annual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Company-Id': companyId },
        body: JSON.stringify({
          notes: {
            pl: plNotes || undefined,
            bs: bsNotes || undefined,
            cf: cfNotes || undefined,
          },
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${company?.name ?? 'report'}_annual_${periodKey}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        const err = await response.json().catch(() => ({ error: 'Export failed' }))
        setAnnualExportError((err as { error?: string }).error ?? 'Export failed')
      }
    } catch (err) {
      console.error('Annual PDF export failed:', err)
      setAnnualExportError('Failed to export PDF. Please try again.')
    } finally {
      setIsExportingAnnual(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description={`Financial reports for ${company?.name ?? 'company'}`}
        badges={
          <>
            <HeaderBadge label="PDF Export" tone="success" />
            <HeaderBadge label="Annual Statements" />
          </>
        }
      />

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1 w-fit">
        <button
          onClick={() => setActiveTab('pdf')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'pdf'
              ? 'bg-white text-[#0F172A] shadow-sm'
              : 'text-[#64748B] hover:text-[#0F172A]'
          )}
        >
          <FileText className="h-3.5 w-3.5" />
          PDF Export
        </button>
        <button
          onClick={() => setActiveTab('annual')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'annual'
              ? 'bg-white text-[#0F172A] shadow-sm'
              : 'text-[#64748B] hover:text-[#0F172A]'
          )}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Annual Statements
        </button>
      </div>

      {/* ── PDF Export Tab ── */}
      {activeTab === 'pdf' && (
        <>
          <SurfaceCard>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
                <FileText className="h-6 w-6 text-[#059669]" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[#0F172A]">Generate Report</h3>
                <p className="mt-1 text-sm text-[#64748B]">
                  Create a comprehensive PDF report with Schedule III P&L, Balance Sheet, Cash Flow, and key metrics
                </p>

                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#0F172A]">Period Start</label>
                      <input
                        type="month"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#0F172A]">Period End</label>
                      <input
                        type="month"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={includeWaterfall}
                        onChange={(e) => setIncludeWaterfall(e.target.checked)}
                        className="rounded border-[#E2E8F0]"
                      />
                      <span className="text-sm text-[#334155]">Include waterfall chart</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={includeScenarios}
                        onChange={(e) => setIncludeScenarios(e.target.checked)}
                        className="rounded border-[#E2E8F0]"
                      />
                      <span className="text-sm text-[#334155]">Include scenario comparison</span>
                    </label>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !periodStart || !periodEnd}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors',
                      isGenerating || !periodStart || !periodEnd
                        ? 'cursor-not-allowed bg-[#94A3B8]'
                        : 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                    )}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Download PDF Report
                      </>
                    )}
                  </button>
                  {error && <p className="text-sm text-[#DC2626]">{error}</p>}
                </div>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-[#64748B]" />
              <h3 className="text-sm font-semibold text-[#0F172A]">Recent Reports</h3>
            </div>
            <div className="py-8 text-center">
              <FileText className="mx-auto h-8 w-8 text-[#CBD5E1]" />
              <p className="mt-2 text-sm text-[#94A3B8]">No reports generated yet</p>
              <p className="mt-1 text-xs text-[#CBD5E1]">Generate your first report to see it here</p>
            </div>
          </SurfaceCard>
        </>
      )}

      {/* ── Annual Statements Tab ── */}
      {activeTab === 'annual' && (
        <div className="space-y-4">
          {/* Export to PDF button */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Schedule III Annual Statements</p>
              <p className="text-xs text-[#64748B]">
                {periodKey} · Full-year P&L, Balance Sheet, and Cash Flow with MD&A notes
              </p>
            </div>
            <button
              onClick={handleExportAnnualPDF}
              disabled={isExportingAnnual || !currentYear}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors',
                isExportingAnnual || !currentYear
                  ? 'cursor-not-allowed bg-[#94A3B8]'
                  : 'bg-[#059669] hover:bg-[#047857]'
              )}
            >
              {isExportingAnnual ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving & Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export to PDF
                </>
              )}
            </button>
          </div>

          {annualExportError && (
            <p className="text-sm text-[#DC2626]">{annualExportError}</p>
          )}

          {/* Annual statements view */}
          {!isReady ? (
            <SurfaceCard>
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#94A3B8]" />
                  <p className="text-sm text-[#64748B]">Loading forecast data...</p>
                </div>
              </div>
            </SurfaceCard>
          ) : !currentYear ? (
            <SurfaceCard>
              <div className="py-12 text-center">
                <BarChart3 className="mx-auto h-8 w-8 text-[#CBD5E1]" />
                <p className="mt-2 text-sm text-[#94A3B8]">No forecast data available</p>
                <p className="mt-1 text-xs text-[#CBD5E1]">
                  Open the Forecast page to generate a forecast first
                </p>
              </div>
            </SurfaceCard>
          ) : (
            <SurfaceCard noPad>
              <AnnualStatementView
                ref={annualViewRef}
                currentYear={currentYear}
                priorYear={null}
                priorYearDataSource="forecast"
                companyId={companyId ?? ''}
                scenarioId={null}
                periodKey={periodKey}
                priorPeriodKey={priorPeriodKey}
                userRole={userRole}
                forecastUpdatedAt={null}
              />
            </SurfaceCard>
          )}
        </div>
      )}
    </div>
  )
}
