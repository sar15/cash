'use client'

import { useMemo } from 'react'
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import { useCompanyContext } from '@/hooks/use-company-context'
import { useCurrentForecast } from '@/hooks/use-current-forecast'
import { useScenarioStore } from '@/stores/scenario-store'
import { useMicroForecastStore } from '@/stores/micro-forecast-store'
import { cn } from '@/lib/utils'
import { formatAuto } from '@/lib/utils/indian-format'
import { QuickMetricsGrid } from '@/components/dashboard/MetricCards'
import { PageHeader, HeaderBadge, SurfaceCard } from '@/components/shared/page-header'

function CashAlertBanner({
  cashOnHand,
  outflows,
  daysUntilDue,
  dueType,
}: {
  cashOnHand: number
  outflows: number
  daysUntilDue: number
  dueType: string
}) {
  const buffer = cashOnHand - outflows
  const tone = buffer > 0 ? (daysUntilDue <= 3 ? 'amber' : 'green') : 'red'
  const Icon = tone === 'green' ? CheckCircle2 : tone === 'amber' ? Clock : AlertTriangle

  const bgColor = tone === 'green' ? 'bg-[#ECFDF5] border-[#A7F3D0]' :
                  tone === 'amber' ? 'bg-[#FFFBEB] border-[#FDE68A]' :
                  'bg-[#FEF2F2] border-[#FECACA]'
  const iconColor = tone === 'green' ? 'text-[#059669]' :
                    tone === 'amber' ? 'text-[#D97706]' :
                    'text-[#DC2626]'
  const textColor = tone === 'green' ? 'text-[#065F46]' :
                    tone === 'amber' ? 'text-[#92400E]' :
                    'text-[#991B1B]'

  return (
    <div className={cn('flex items-start gap-3 rounded-md border px-4 py-3', bgColor)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColor)} />
      <div className={cn('text-sm', textColor)}>
        <span className="font-semibold">
          {dueType} due in {daysUntilDue}d
        </span>
        <span className="text-[#475569]">
          {' · '}Cash{' '}
          <span className="font-num font-medium">{formatAuto(cashOnHand)}</span>
          {' · '}Outflow{' '}
          <span className="font-num font-medium">{formatAuto(outflows)}</span>
          {' · '}Buffer{' '}
          <span className={cn('font-num font-semibold', buffer >= 0 ? '' : 'text-[#DC2626]')}>
            {formatAuto(buffer)}
          </span>
        </span>
      </div>
    </div>
  )
}

function ComplianceRow({
  label,
  due,
  amount,
  status,
}: {
  label: string
  due: string
  amount: number
  status: 'paid' | 'upcoming' | 'overdue'
}) {
  const dotClass =
    status === 'paid' ? 'health-dot health-dot-green' :
    status === 'upcoming' ? 'health-dot health-dot-amber' :
    'health-dot health-dot-red'

  return (
    <tr className="hover-row border-b border-[#F1F5F9]">
      <td className="py-2 pl-1 pr-2">
        <span className={dotClass} />
      </td>
      <td className="py-2 text-sm text-[#0F172A]">{label}</td>
      <td className="py-2 text-xs text-[#94A3B8]">{due}</td>
      <td className="py-2 text-right font-num text-sm text-[#334155]">{formatAuto(amount)}</td>
    </tr>
  )
}

export default function DashboardPage() {
  const { company, isLoading: companyLoading } = useCompanyContext()
  const { engineResult, forecastMonths, isReady } = useCurrentForecast()
  const scenarios = useScenarioStore((state) => state.scenarios)
  const microForecastItems = useMicroForecastStore((state) => state.items)
  const activeEvents = useMemo(() => microForecastItems.filter((item) => item.isActive), [microForecastItems])

  const dashboardData = useMemo(() => {
    const baselineMonths = engineResult?.rawIntegrationResults ?? []
    if (baselineMonths.length === 0) {
      return { cashPosition: 0, runway: 0, netIncome: 0, wcDays: 0 }
    }

    const lastMonth = baselineMonths[baselineMonths.length - 1]
    const cashPosition = lastMonth?.bs?.cash ?? 0

    let totalBurn = 0
    let burnMonths = 0
    baselineMonths.forEach((m) => {
      const outflow = (m?.cf?.operatingCashFlow ?? 0)
      if (outflow < 0) {
        totalBurn += Math.abs(outflow)
        burnMonths++
      }
    })
    const avgBurn = burnMonths > 0 ? totalBurn / burnMonths : 1
    const runway = avgBurn > 0 ? cashPosition / avgBurn : 99

    const netIncome = baselineMonths.reduce((sum, m) => sum + (m?.pl?.netIncome ?? 0), 0)

    const ar = lastMonth?.bs?.ar ?? 0
    const ap = lastMonth?.bs?.ap ?? 0
    const monthlyRev = baselineMonths[baselineMonths.length - 1]?.pl?.revenue ?? 1
    const wcDays = Math.round(((ar - ap) / (Math.abs(monthlyRev) || 1)) * 30)

    return { cashPosition, runway, netIncome, wcDays }
  }, [engineResult])

  const complianceItems = useMemo(() => {
    const compliance = engineResult?.compliance
    if (!compliance) return []
    const today = new Date()
    const month = today.getMonth()

    const gstMonth = compliance.gst?.months?.[0]
    const tdsMonth = compliance.tds?.months?.[0]
    const pfMonth = compliance.pfEsi?.months?.[0]

    return [
      {
        label: 'GST Payment',
        due: `20/${String(month + 2).padStart(2, '0')}`,
        amount: gstMonth?.netPayable ?? 0,
        status: 'upcoming' as const,
      },
      {
        label: 'TDS Deposit',
        due: `07/${String(month + 2).padStart(2, '0')}`,
        amount: tdsMonth?.salaryTDS ?? 0,
        status: 'upcoming' as const,
      },
      {
        label: 'PF Contribution',
        due: `15/${String(month + 2).padStart(2, '0')}`,
        amount: pfMonth?.employerPF ?? 0,
        status: 'upcoming' as const,
      },
    ].filter(i => i.amount > 0)
  }, [engineResult])

  if (companyLoading || !isReady) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#059669]" />
          <p className="text-sm text-[#94A3B8]">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={`${company?.name ?? 'Company'} · Cash, compliance and runway at a glance`}
        badges={
          <>
            <HeaderBadge label={`${forecastMonths.length} months modeled`} />
            {scenarios.length > 0 && <HeaderBadge label={`${scenarios.length} scenarios`} />}
            {activeEvents.length > 0 && (
              <HeaderBadge label={`${activeEvents.length} active events`} tone="success" />
            )}
          </>
        }
        actions={
          <Link
            href="/forecast"
            className="btn-press inline-flex items-center gap-1.5 rounded border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#0F172A] transition-colors duration-[80ms] hover:border-[#D1D5DB]"
          >
            Open forecast
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {/* Cash alert — the 11pm check */}
      {dashboardData.cashPosition > 0 && complianceItems.length > 0 && (
        <CashAlertBanner
          cashOnHand={dashboardData.cashPosition}
          outflows={complianceItems.reduce((s, i) => s + i.amount, 0)}
          daysUntilDue={Math.max(1, 20 - new Date().getDate())}
          dueType="GST"
        />
      )}

      {/* Four metric cards */}
      <QuickMetricsGrid
        cashPosition={dashboardData.cashPosition}
        runway={dashboardData.runway}
        netIncome={dashboardData.netIncome}
        workingCapitalDays={dashboardData.wcDays}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        {/* Monthly cash trend — dense table, not a chart */}
        <SurfaceCard>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#0F172A]">Monthly forecast</span>
            <Link href="/forecast" className="text-xs font-medium text-[#2563EB] hover:underline">
              Full grid →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="fin-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Month</th>
                  <th>Revenue</th>
                  <th>Expenses</th>
                  <th>Net Income</th>
                  <th>Cash</th>
                </tr>
              </thead>
              <tbody>
                {(engineResult?.rawIntegrationResults ?? []).slice(0, 6).map((month, idx) => {
                  const rev = month?.pl?.revenue ?? 0
                  const exp = (month?.pl?.cogs ?? 0) + (month?.pl?.expense ?? 0)
                  const net = month?.pl?.netIncome ?? 0
                  const cash = month?.bs?.cash ?? 0

                  return (
                    <tr key={forecastMonths[idx] ?? idx}>
                      <td className="!font-sans !text-[#0F172A]">{forecastMonths[idx]}</td>
                      <td>{formatAuto(rev)}</td>
                      <td>{formatAuto(exp)}</td>
                      <td className={net < 0 ? 'text-[#DC2626]' : ''}>
                        {formatAuto(net)}
                      </td>
                      <td className="font-semibold">{formatAuto(cash)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        {/* Compliance due dates */}
        <SurfaceCard>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#0F172A]">Upcoming compliance</span>
            <Link href="/compliance" className="text-xs font-medium text-[#2563EB] hover:underline">
              All due dates →
            </Link>
          </div>
          {complianceItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#94A3B8]">No compliance obligations loaded yet.</p>
          ) : (
            <table className="w-full">
              <tbody>
                {complianceItems.map((item) => (
                  <ComplianceRow key={item.label} {...item} />
                ))}
              </tbody>
            </table>
          )}
        </SurfaceCard>
      </div>
    </div>
  )
}
