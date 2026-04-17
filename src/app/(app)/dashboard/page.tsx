'use client'

import { useMemo, useState, useCallback } from 'react'
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useCompanyContext } from '@/hooks/use-company-context'
import { useCurrentForecast } from '@/hooks/use-current-forecast'
import { useScenarioStore } from '@/stores/scenario-store'
import { useMicroForecastStore } from '@/stores/micro-forecast-store'
import { useAccountsStore } from '@/stores/accounts-store'
import { useActualsStore } from '@/stores/actuals-store'
import { cn } from '@/lib/utils'
import { formatAuto } from '@/lib/utils/indian-format'
import { apiPost } from '@/lib/api/client'
import { QuickMetricsGrid } from '@/components/dashboard/MetricCards'
import { PageHeader, HeaderBadge, SurfaceCard } from '@/components/shared/page-header'
import { DashboardSkeleton } from '@/components/shared/skeleton'
import { CashRunwayChart } from '@/components/dashboard/CashRunwayChart'
import { CashFlowWaterfall } from '@/components/dashboard/CashFlowWaterfall'

function RunwaySummaryBanner({
  runway,
  companyName,
  cashPosition,
  monthlyBurn,
}: {
  runway: number
  cashPosition: number
  companyName: string
  monthlyBurn: number
}) {
  const tone = runway >= 6 ? 'green' : runway >= 3 ? 'amber' : 'red'
  const bgColor = tone === 'green' ? 'bg-[#ECFDF5] border-[#A7F3D0]' :
                  tone === 'amber' ? 'bg-[#FFFBEB] border-[#FDE68A]' :
                  'bg-[#FEF2F2] border-[#FECACA]'
  const textColor = tone === 'green' ? 'text-[#065F46]' :
                    tone === 'amber' ? 'text-[#92400E]' :
                    'text-[#991B1B]'
  const Icon = tone === 'green' ? CheckCircle2 : tone === 'amber' ? Clock : AlertTriangle
  const iconColor = tone === 'green' ? 'text-[#059669]' :
                    tone === 'amber' ? 'text-[#D97706]' :
                    'text-[#DC2626]'

  const runwayText = runway >= 36 ? 'more than 3 years' : `${runway.toFixed(1)} months`
  const burnText = monthlyBurn > 0 ? ` at ₹${(monthlyBurn / 10_000_000).toFixed(1)}L/month burn` : ''

  const message = runway >= 36
    ? `${companyName} has strong cash reserves — no liquidity risk in the forecast horizon.`
    : runway >= 6
    ? `${companyName} has ${runwayText} of cash runway${burnText}.`
    : runway >= 3
    ? `${companyName} has ${runwayText} of runway${burnText}. Monitor cash closely.`
    : `${companyName} has only ${runwayText} of runway. Take action now to extend cash.`

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3', bgColor)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColor)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', textColor)}>{message}</p>
        {tone !== 'green' && cashPosition > 0 && (
          <p className="mt-1 text-xs text-[#64748B]">
            Current cash: <span className="font-semibold">{formatAuto(cashPosition)}</span>
            {monthlyBurn > 0 && <> · Monthly burn: <span className="font-semibold">{formatAuto(monthlyBurn)}</span></>}
          </p>
        )}
      </div>
      {tone !== 'green' && (
        <Link href="/forecast" className="shrink-0 text-xs font-semibold text-[#2563EB] hover:underline">
          View forecast →
        </Link>
      )}
    </div>
  )
}

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

export default function DashboardPage() {
  const { company, isLoading: companyLoading, companyId } = useCompanyContext()
  const { engineResult, forecastMonths, isReady, hasAccounts } = useCurrentForecast()
  const scenarios = useScenarioStore((state) => state.scenarios)
  const microForecastItems = useMicroForecastStore((state) => state.items)
  const activeEvents = useMemo(() => microForecastItems.filter((item) => item.isActive), [microForecastItems])
  const reloadAccounts = useAccountsStore((s) => s.load)
  const reloadActuals = useActualsStore((s) => s.load)
  const [isSeeding, setIsSeeding] = useState(false)

  const handleLoadSampleData = useCallback(async () => {
    if (!companyId) return
    setIsSeeding(true)
    try {
      await apiPost(`/api/import/seed-demo`, { companyId })
      await Promise.all([reloadAccounts(companyId), reloadActuals(companyId)])
    } catch (err) {
      console.error('[Dashboard] Sample data seed failed:', err)
    } finally {
      setIsSeeding(false)
    }
  }, [companyId, reloadAccounts, reloadActuals])

  const dashboardData = useMemo(() => {
    const baselineMonths = engineResult?.rawIntegrationResults ?? []
    if (baselineMonths.length === 0) {
      return { cashPosition: 0, runway: 0, netIncome: 0, wcDays: 0, grossMarginPct: 0, operatingCashFlow: 0, freeCashFlow: 0, monthlyBurn: 0, negativeCashMonth: null as null | { label: string; balance: number } }
    }

    const lastMonth = baselineMonths[baselineMonths.length - 1]
    const cashPosition = lastMonth?.bs?.cash ?? 0

    // Runway = cash / avg monthly cash outflows
    const totalOutflows = baselineMonths.reduce((sum, m) => {
      const opOut = Math.abs(Math.min(0, m?.cf?.operatingCashFlow ?? 0))
      const finOut = Math.abs(Math.min(0, m?.cf?.financingCashFlow ?? 0))
      return sum + opOut + finOut
    }, 0)
    const avgMonthlyBurn = totalOutflows / Math.max(baselineMonths.length, 1)
    const totalExpenses = baselineMonths.reduce(
      (sum, m) => sum + (m?.pl?.expense ?? 0) + (m?.pl?.cogs ?? 0),
      0
    )
    const avgExpenseBurn = totalExpenses / Math.max(baselineMonths.length, 1)
    const effectiveBurn = avgMonthlyBurn > 0 ? avgMonthlyBurn : avgExpenseBurn
    const runway = effectiveBurn > 0 ? Math.min(cashPosition / effectiveBurn, 36) : 36

    const netIncome = baselineMonths.reduce((sum, m) => sum + (m?.pl?.netIncome ?? 0), 0)

    // Gross Margin %
    const totalRevenue = baselineMonths.reduce((sum, m) => sum + (m?.pl?.revenue ?? 0), 0)
    const totalCogs = baselineMonths.reduce((sum, m) => sum + (m?.pl?.cogs ?? 0), 0)
    const grossMarginPct = totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue) * 100 : 0

    // Operating Cash Flow (cumulative)
    const operatingCashFlow = baselineMonths.reduce((sum, m) => sum + (m?.cf?.operatingCashFlow ?? 0), 0)

    // Free Cash Flow = OCF + Investing CF (CapEx is negative investing)
    const freeCashFlow = baselineMonths.reduce((sum, m) =>
      sum + (m?.cf?.operatingCashFlow ?? 0) + (m?.cf?.investingCashFlow ?? 0), 0)

    const ar = lastMonth?.bs?.ar ?? 0
    const ap = lastMonth?.bs?.ap ?? 0
    const monthlyRev = baselineMonths[baselineMonths.length - 1]?.pl?.revenue ?? 1
    const wcDays = Math.round(((ar - ap) / (Math.abs(monthlyRev) || 1)) * 30)

    // Projected negative cash — check next 3 months
    const next3 = baselineMonths.slice(0, 3)
    const firstNegIdx = next3.findIndex(m => (m?.bs?.cash ?? 0) < 0)
    const negativeCashMonth = firstNegIdx !== -1
      ? { label: forecastMonths[firstNegIdx] ?? `Month ${firstNegIdx + 1}`, balance: next3[firstNegIdx]?.bs?.cash ?? 0 }
      : null

    return { cashPosition, runway, netIncome, wcDays, grossMarginPct, operatingCashFlow, freeCashFlow, monthlyBurn: effectiveBurn ?? 0, negativeCashMonth }
  }, [engineResult, forecastMonths])

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
    return <DashboardSkeleton />
  }

  if (!hasAccounts) {
    return (
      <div className="space-y-5">
        <PageHeader title="Dashboard" description={`${company?.name ?? 'Company'} · Get started by importing your financial data`} />
        <SurfaceCard className="mx-auto mt-6 max-w-xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F8FAFC]">
            <ArrowUpRight className="h-5 w-5 text-[#94A3B8]" />
          </div>
          <h2 className="text-base font-semibold text-[#0F172A]">No accounts imported yet</h2>
          <p className="mt-2 text-sm leading-6 text-[#64748B]">
            Upload your P&amp;L or balance sheet to start forecasting. CashFlowIQ will auto-map your chart of accounts and build a 12-month forecast.
          </p>
          <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/data"
              className="btn-press inline-flex items-center gap-1.5 rounded bg-[#0F172A] px-4 py-2 text-sm font-medium text-white transition-colors duration-[80ms] hover:bg-[#1E293B]"
            >
              Import your data
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={handleLoadSampleData}
              disabled={isSeeding}
              className="btn-press inline-flex items-center gap-1.5 rounded border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#059669] transition-colors duration-[80ms] hover:border-[#A7F3D0] hover:bg-[#ECFDF5] disabled:opacity-60"
            >
              {isSeeding ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading sample data...</>
              ) : (
                <>Try with sample data</>
              )}
            </button>
          </div>
          <p className="mt-3 text-xs text-[#94A3B8]">
            Sample data: Indian manufacturing SME · 12 months of actuals · Apr 2024 – Mar 2025
          </p>
        </SurfaceCard>
      </div>
    )
  }

  return (
    <div className="space-y-5 stagger-children">
      <PageHeader
        title={company?.name ?? 'Dashboard'}
        description="Cash position, runway, and compliance at a glance"
        badges={
          <>
            <HeaderBadge label={`${forecastMonths.length}mo forecast`} dot />
            {scenarios.length > 0 && <HeaderBadge label={`${scenarios.length} scenarios`} />}
            {activeEvents.length > 0 && (
              <HeaderBadge label={`${activeEvents.length} events active`} tone="success" dot />
            )}
          </>
        }
        actions={
          <Link
            href="/forecast"
            className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm font-medium text-[#0F172A] shadow-sm transition-all duration-[80ms] hover:border-[#CBD5E1] hover:shadow-md"
          >
            Open forecast
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {/* Plain-English runway summary */}
      <RunwaySummaryBanner
        runway={dashboardData.runway}
        cashPosition={dashboardData.cashPosition}
        companyName={company?.name ?? 'Your company'}
        monthlyBurn={dashboardData.monthlyBurn}
      />

      {/* Projected negative cash alert — shown when any of the next 3 months goes negative */}
      {dashboardData.negativeCashMonth && (
        <div className="flex items-start gap-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#991B1B]">
              ⚠️ Projected cash balance drops below zero in {dashboardData.negativeCashMonth.label}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              Projected balance: <span className="font-semibold text-[#DC2626]">{formatAuto(dashboardData.negativeCashMonth.balance)}</span>
              {' · '}Take action now to extend runway.
            </p>
          </div>
          <Link href="/forecast" className="shrink-0 text-xs font-semibold text-[#DC2626] hover:underline">
            View forecast →
          </Link>
        </div>
      )}

      {/* Cash alert */}
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
        grossMarginPct={dashboardData.grossMarginPct}
        operatingCashFlow={dashboardData.operatingCashFlow}
        freeCashFlow={dashboardData.freeCashFlow}
        monthlyCash={(engineResult?.rawIntegrationResults ?? []).map(m => m?.bs?.cash ?? 0)}
        monthlyNetIncome={(engineResult?.rawIntegrationResults ?? []).map(m => m?.pl?.netIncome ?? 0)}
      />

      {/* Cash runway chart */}
      {forecastMonths.length > 0 && (
        <CashRunwayChart
          monthlyBalances={(engineResult?.rawIntegrationResults ?? []).map(m => m?.bs?.cash ?? 0)}
          monthLabels={forecastMonths}
          dangerThreshold={5_00_000_00}
        />
      )}

      {/* Cash flow waterfall chart */}
      {forecastMonths.length > 0 && (
        <CashFlowWaterfall
          engineResult={engineResult}
          forecastMonths={forecastMonths}
        />
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
        {/* Monthly forecast table */}
        <SurfaceCard noPad>
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Monthly forecast</p>
              <p className="text-xs text-[#94A3B8]">
                Revenue, costs, profit, and cash — next 6 months
              </p>
            </div>
            <Link href="/forecast" className="text-xs font-semibold text-[#2563EB] hover:underline">
              Full forecast →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="fin-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Month</th>
                  <th title="Total income from sales and services">Revenue</th>
                  <th title="COGS + Operating expenses">Total Costs</th>
                  <th title="Revenue minus all costs">Net Income</th>
                  <th title="Projected cash in bank">Cash Balance</th>
                </tr>
              </thead>
              <tbody>
                {(engineResult?.rawIntegrationResults ?? []).slice(0, 6).map((month, idx) => {
                  const rev = month?.pl?.revenue ?? 0
                  const exp = (month?.pl?.cogs ?? 0) + (month?.pl?.expense ?? 0)
                  const net = month?.pl?.netIncome ?? 0
                  const cash = month?.bs?.cash ?? 0
                  const margin = rev > 0 ? (net / rev) * 100 : 0

                  return (
                    <tr key={forecastMonths[idx] ?? idx}>
                      <td className="!font-sans font-semibold !text-[#0F172A]">{forecastMonths[idx]}</td>
                      <td className="text-[#2563EB]">{formatAuto(rev)}</td>
                      <td className="text-[#DC2626]">{formatAuto(exp)}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={net < 0 ? 'font-semibold text-[#DC2626]' : 'font-semibold text-[#059669]'}>
                            {formatAuto(net)}
                          </span>
                          {rev > 0 && (
                            <span className={`text-[10px] font-medium ${margin < 0 ? 'text-[#DC2626]' : 'text-[#94A3B8]'}`}>
                              {margin.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`font-semibold ${cash < 0 ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>
                        {formatAuto(cash)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#F1F5F9] px-4 py-2">
            <p className="text-[10px] text-[#94A3B8]">
              Net Income % = profit margin for that month · Cash Balance = projected bank balance
            </p>
          </div>
        </SurfaceCard>

        {/* Compliance due dates */}
        <SurfaceCard noPad>
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Upcoming compliance</p>
              <p className="text-xs text-[#94A3B8]">Statutory payments — GST, TDS, PF/ESI</p>
            </div>
            <Link href="/compliance" className="text-xs font-semibold text-[#2563EB] hover:underline">
              Full calendar →
            </Link>
          </div>
          {complianceItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-[#94A3B8]">No compliance obligations calculated.</p>
              <p className="mt-1 text-xs text-[#CBD5E1]">Configure GST rate and TDS in Settings.</p>
              <Link href="/settings" className="mt-3 text-xs font-semibold text-[#2563EB] hover:underline">
                Go to Settings →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {complianceItems.map((item) => {
                const cashAfter = dashboardData.cashPosition - item.amount
                const isShortfall = cashAfter < 0
                return (
                  <div key={item.label} className="flex items-center justify-between px-4 py-3 hover:bg-[#F8FAFC] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'health-dot',
                        isShortfall ? 'health-dot-red' : 'health-dot-amber'
                      )} />
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">{item.label}</p>
                        <p className="text-xs text-[#94A3B8]">Due {item.due}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-num text-sm font-semibold text-[#334155]">{formatAuto(item.amount)}</p>
                      {isShortfall && (
                        <p className="text-[10px] font-semibold text-[#DC2626]">Cash shortfall</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  )
}
