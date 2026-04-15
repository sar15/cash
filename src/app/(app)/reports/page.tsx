'use client'

import { useState } from 'react'
import { useCompanyContext } from '@/hooks/use-company-context'
import { FileText, Download, Calendar } from 'lucide-react'
import { PageHeader, HeaderBadge, SurfaceCard } from '@/components/shared/page-header'
import { cn } from '@/lib/utils'

export default function ReportsPage() {
  const { company, companyId } = useCompanyContext()
  const [isGenerating, setIsGenerating] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [includeWaterfall, setIncludeWaterfall] = useState(true)
  const [includeScenarios, setIncludeScenarios] = useState(false)

  const handleGenerate = async () => {
    if (!companyId || !periodStart || !periodEnd) return

    setIsGenerating(true)
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          periodStart,
          periodEnd,
          includeWaterfall,
          includeScenarios,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Open download URL
        window.open(data.downloadUrl, '_blank')
      }
    } catch (error) {
      console.error('Report generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reports"
        title="PDF Report Generation"
        description={`Generate professional reports for ${company?.name ?? 'company'}`}
        badges={<HeaderBadge label="PDF Export" tone="success" />}
      />

      <SurfaceCard>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
            <FileText className="h-6 w-6 text-[#059669]" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[#0F172A]">
              Generate Report
            </h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Create a comprehensive PDF report with P&L, Balance Sheet, Cash
              Flow, and key metrics
            </p>

            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                    Period Start
                  </label>
                  <input
                    type="month"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#0F172A]">
                    Period End
                  </label>
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
                  <span className="text-sm text-[#334155]">
                    Include waterfall chart
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeScenarios}
                    onChange={(e) => setIncludeScenarios(e.target.checked)}
                    className="rounded border-[#E2E8F0]"
                  />
                  <span className="text-sm text-[#334155]">
                    Include scenario comparison
                  </span>
                </label>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !periodStart || !periodEnd}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors',
                  isGenerating || !periodStart || !periodEnd
                    ? 'cursor-not-allowed bg-[#94A3B8]'
                    : 'bg-[#059669] hover:bg-[#047857]'
                )}
              >
                {isGenerating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-5 w-5 text-[#64748B]" />
          <h3 className="text-sm font-semibold text-[#0F172A]">
            Recent Reports
          </h3>
        </div>
        <div className="py-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-[#CBD5E1]" />
          <p className="mt-2 text-sm text-[#94A3B8]">No reports generated yet</p>
          <p className="mt-1 text-xs text-[#CBD5E1]">
            Generate your first report to see it here
          </p>
        </div>
      </SurfaceCard>
    </div>
  )
}
