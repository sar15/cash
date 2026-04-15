'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import { useCompanyStore } from '@/stores/company-store'
import { useCompanyContext } from '@/hooks/use-company-context'
import { useCurrentForecast } from '@/hooks/use-current-forecast'
import { ArrowLeft, Settings, Upload, TrendingUp, FileText, ClipboardCheck } from 'lucide-react'
import Link from 'next/link'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'
import { QuickMetricsGrid } from '@/components/dashboard/MetricCards'
import { CashRunwayChart } from '@/components/dashboard/CashRunwayChart'
import { formatAuto } from '@/lib/utils/indian-format'
import { cn } from '@/lib/utils'

export default function ClientDetailPage() {
  const params = useParams()
  const clientId = params.clientId as string
  const { switchCompany } = useCompanyContext()
  const company = useCompanyStore((s) =>
    s.companies.find((c) => c.id === clientId)
  )

  // Auto-switch to this client's company on mount
  useEffect(() => {
    if (clientId) switchCompany(clientId)
  }, [clientId, switchCompany])

  // Engine result is now scoped to this client (after switchCompany)
  const { engineResult, forecastMonths, hasAccounts, isReady } = useCurrentForecast()

  if (!company) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-[#94A3B8]">Client not found</p>
      </div>
    )
  }

  const quickActions = [
    { label: 'Forecast', href: '/forecast', icon: TrendingUp, color: 'bg-[#059669] hover:bg-[#047857]' },
    { label: 'Import Data', href: '/data', icon: Upload, color: 'bg-[#2563EB] hover:bg-[#1D4ED8]' },
    { label: 'Compliance', href: '/compliance', icon: ClipboardCheck, color: 'bg-[#D97706] hover:bg-[#B45309]' },
    { label: 'Reports', href: '/reports', icon: FileText, color: 'bg-[#475569] hover:bg-[#334155]' },
    { label: 'Settings', href: '/settings', icon: Settings, color: 'bg-[#0F172A] hover:bg-[#1E293B]' },
  ]

  // Compute metrics from engine
  const metrics = (() => {
    if (!engineResult || !hasAccounts) return null
    const months = engineResult.rawIntegrationResults
    if (months.length === 0) return null
    const lastMonth = months[months.length - 1]
    const cashPosition = lastMonth?.bs?.cash ?? 0
    const totalOutflows = months.reduce((sum, m) => sum + Math.abs(Math.min(0, m?.cf?.operatingCashFlow ?? 0)), 0)
    const totalExpenses = months.reduce((sum, m) => sum + (m?.pl?.expense ?? 0) + (m?.pl?.cogs ?? 0), 0)
    const avgBurn = totalOutflows > 0 ? totalOutflows / months.length : totalExpenses / Math.max(months.length, 1)
    const runway = avgBurn > 0 ? Math.min(cashPosition / avgBurn, 36) : 36
    const netIncome = months.reduce((sum, m) => sum + (m?.pl?.netIncome ?? 0), 0)
    const ar = lastMonth?.bs?.ar ?? 0
    const ap = lastMonth?.bs?.ap ?? 0
    const monthlyRev = lastMonth?.pl?.revenue ?? 1
    const wcDays = Math.round(((ar - ap) / Math.max(Math.abs(monthlyRev), 1)) * 30)
    return { cashPosition, runway, netIncome, wcDays }
  })()

  // Compliance alerts from engine
  const complianceAlerts = engineResult?.compliance?.alerts ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Client detail"
        title={company.name}
        description={`${company.industry} · ${company.pan ?? 'No PAN'} · ${company.gstin ?? 'No GSTIN'}`}
        badges={
          <>
            <HeaderBadge label={company.industry} />
            {hasAccounts
              ? <HeaderBadge label={`${forecastMonths.length} months forecast`} tone="success" />
              : <HeaderBadge label="No data imported" tone="warning" />
            }
            {complianceAlerts.length > 0 && (
              <HeaderBadge label={`${complianceAlerts.length} compliance alerts`} tone="danger" />
            )}
          </>
        }
        actions={
          <Link
            href="/clients"
            className="btn-press inline-flex items-center gap-1.5 rounded border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#475569] transition-colors duration-[80ms] hover:border-[#D1D5DB]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Portfolio
          </Link>
        }
      />

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className={cn(
              'btn-press flex flex-col items-center gap-2 rounded-md px-3 py-3 text-white transition-colors',
              action.color
            )}
          >
            <action.icon className="h-5 w-5" />
            <span className="text-xs font-medium">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Metrics — real data from engine */}
      {metrics && isReady ? (
        <>
          <QuickMetricsGrid
            cashPosition={metrics.cashPosition}
            runway={metrics.runway}
            netIncome={metrics.netIncome}
            workingCapitalDays={metrics.wcDays}
            monthlyCash={(engineResult?.rawIntegrationResults ?? []).map(m => m?.bs?.cash ?? 0)}
            monthlyNetIncome={(engineResult?.rawIntegrationResults ?? []).map(m => m?.pl?.netIncome ?? 0)}
          />
          {forecastMonths.length > 0 && (
            <CashRunwayChart
              monthlyBalances={(engineResult?.rawIntegrationResults ?? []).map(m => m?.bs?.cash ?? 0)}
              monthLabels={forecastMonths}
              dangerThreshold={5_00_000_00}
            />
          )}
        </>
      ) : (
        <SurfaceCard className="py-10 text-center">
          <p className="text-sm font-medium text-[#0F172A]">No financial data imported yet</p>
          <p className="mt-2 text-xs text-[#94A3B8]">
            Import {company.name}&apos;s P&L or balance sheet to see forecast metrics here.
          </p>
          <Link href="/data"
            className="btn-press mt-4 inline-flex items-center gap-1.5 rounded bg-[#0F172A] px-3 py-1.5 text-sm font-medium text-white transition-colors duration-[80ms] hover:bg-[#1E293B]">
            <Upload className="h-3.5 w-3.5" /> Import data
          </Link>
        </SurfaceCard>
      )}

      {/* Compliance alerts */}
      {complianceAlerts.length > 0 && (
        <SurfaceCard>
          <p className="mb-3 text-sm font-semibold text-[#0F172A]">Compliance Alerts</p>
          <div className="space-y-2">
            {complianceAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2">
                <div>
                  <span className="text-xs font-semibold text-[#DC2626]">{alert.type}</span>
                  <span className="ml-2 text-xs text-[#991B1B]">Due {alert.dueDate}</span>
                </div>
                <div className="text-right">
                  <p className="font-num text-sm font-semibold text-[#DC2626]">{formatAuto(alert.amount)}</p>
                  {alert.shortfall > 0 && (
                    <p className="text-[10px] text-[#DC2626]">Shortfall: {formatAuto(alert.shortfall)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}
    </div>
  )
}
