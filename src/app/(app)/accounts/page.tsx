'use client'

import { useMemo } from 'react'
import { FileSpreadsheet, Layers, TrendingUp, BookOpen, Settings2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useCompanyContext } from '@/hooks/use-company-context'
import { useAccountsStore } from '@/stores/accounts-store'
import { useForecastConfigStore } from '@/stores/forecast-config-store'
import { cn } from '@/lib/utils'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'
import { formatAuto } from '@/lib/utils/indian-format'
import { useActualsStore } from '@/stores/actuals-store'

const typeConfig: Record<string, { color: string; bg: string; border: string; icon: typeof TrendingUp; label: string }> = {
  revenue:   { color: 'text-[#059669]', bg: 'bg-[#ECFDF5]',  border: 'border-[#A7F3D0]',  icon: TrendingUp,    label: 'Revenue' },
  expense:   { color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]',  border: 'border-[#FECACA]',  icon: BookOpen,      label: 'Expenses' },
  asset:     { color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]',  border: 'border-[#BFDBFE]',  icon: Layers,        label: 'Assets' },
  liability: { color: 'text-[#D97706]', bg: 'bg-[#FFFBEB]',  border: 'border-[#FDE68A]',  icon: FileSpreadsheet, label: 'Liabilities' },
  equity:    { color: 'text-[#475569]', bg: 'bg-[#F8FAFC]',  border: 'border-[#E5E7EB]',  icon: Layers,        label: 'Equity' },
}

const ruleLabels: Record<string, { label: string; color: string; bg: string; border: string }> = {
  growth:         { label: 'Growth',   color: 'text-[#059669]', bg: 'bg-[#ECFDF5]', border: 'border-[#A7F3D0]' },
  rolling_avg:    { label: 'Avg',      color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]', border: 'border-[#BFDBFE]' },
  same_last_year: { label: 'Last Year',color: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
  direct_entry:   { label: 'Manual',   color: 'text-[#475569]', bg: 'bg-[#F8FAFC]', border: 'border-[#E5E7EB]' },
}

export default function AccountsPage() {
  const { isLoading } = useCompanyContext()
  const accounts = useAccountsStore((state) => state.accounts)
  const valueRules = useForecastConfigStore((s) => s.valueRules)
  const timingProfiles = useForecastConfigStore((s) => s.timingProfiles)
  const getHistoricalValues = useActualsStore((s) => s.getHistoricalValues)

  const grouped = useMemo(() => {
    const groups: Record<string, typeof accounts> = {}
    for (const account of accounts) {
      const type = account.accountType ?? 'other'
      if (!groups[type]) groups[type] = []
      groups[type].push(account)
    }
    return groups
  }, [accounts])

  const groupOrder = ['revenue', 'expense', 'asset', 'liability', 'equity']

  const totalWithRules = useMemo(() =>
    accounts.filter(a => valueRules[a.id]).length,
    [accounts, valueRules]
  )

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#059669]" />
          <p className="text-sm text-[#94A3B8]">Loading chart of accounts...</p>
        </div>
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Chart of accounts"
          title="Chart of Accounts"
          description="Your account structure will appear here once you import financial data."
          badges={<HeaderBadge label="No accounts yet" tone="warning" />}
        />
        <SurfaceCard className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <FileSpreadsheet className="h-8 w-8 text-[#94A3B8]" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-[#0F172A]">No accounts imported yet</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
            Upload your P&L or Balance Sheet. CashFlowIQ will auto-detect your chart of accounts 
            and map them to the Indian Schedule III structure.
          </p>
          <Link href="/data"
            className="btn-press mt-5 inline-flex items-center gap-1.5 rounded bg-[#0F172A] px-4 py-2 text-sm font-medium text-white transition-colors duration-[80ms] hover:bg-[#1E293B]">
            Go to Import Pipeline
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </SurfaceCard>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Chart of accounts"
        title="Chart of Accounts"
        description="Indian Schedule III mapped account structure. Click any account to configure its forecast method."
        badges={
          <>
            <HeaderBadge label={`${accounts.length} accounts`} tone="success" />
            <HeaderBadge label={`${totalWithRules} with rules`} tone={totalWithRules > 0 ? 'success' : 'default'} />
            <HeaderBadge label={`${Object.keys(timingProfiles).length} payment terms set`} />
          </>
        }
        actions={
          <Link href="/forecast"
            className="btn-press inline-flex items-center gap-1.5 rounded border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#475569] transition-colors duration-[80ms] hover:border-[#D1D5DB]">
            <Settings2 className="h-3.5 w-3.5" /> Configure in Forecast
          </Link>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {groupOrder.map((type) => {
          const count = grouped[type]?.length ?? 0
          const config = typeConfig[type] ?? typeConfig.expense
          const TypeIcon = config.icon
          return (
            <div key={type} className={cn('rounded-md border px-4 py-3', config.border, config.bg)}>
              <div className="flex items-center gap-2">
                <TypeIcon className={cn('h-3.5 w-3.5', config.color)} />
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">{config.label}</p>
              </div>
              <p className={cn('mt-1.5 font-num text-2xl font-semibold', config.color)}>{count}</p>
            </div>
          )
        })}
      </div>

      {/* Account tables per type */}
      {groupOrder.map((type) => {
        const group = grouped[type]
        if (!group || group.length === 0) return null
        const config = typeConfig[type] ?? typeConfig.expense
        const TypeIcon = config.icon
        const isIncomeStatement = type === 'revenue' || type === 'expense'

        return (
          <SurfaceCard key={type} className="overflow-hidden p-0">
            {/* Section header */}
            <div className={cn('flex items-center gap-3 border-b border-[#E5E7EB] px-4 py-3', config.bg)}>
              <div className={cn('rounded-md p-1.5', config.bg)}>
                <TypeIcon className={cn('h-4 w-4', config.color)} />
              </div>
              <div>
                <p className={cn('text-sm font-semibold', config.color)}>{config.label}</p>
                <p className="text-xs text-[#94A3B8]">{group.length} accounts</p>
              </div>
              {isIncomeStatement && (
                <p className="ml-auto text-[10px] text-[#94A3B8]">
                  Click account name in Forecast → P&L to configure rules
                </p>
              )}
            </div>

            {/* Account rows */}
            <table className="fin-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Account</th>
                  <th className="text-left">Mapping</th>
                  {isIncomeStatement && <th className="text-left">Forecast Method</th>}
                  {isIncomeStatement && <th className="text-left">Payment Terms</th>}
                  <th>Latest Actual</th>
                </tr>
              </thead>
              <tbody>
                {group.sort((a, b) => a.sortOrder - b.sortOrder).map((account) => {
                  const rule = valueRules[account.id]
                  const profile = timingProfiles[account.id]
                  const history = getHistoricalValues(account.id)
                  const latestValue = history[history.length - 1] ?? 0
                  const ruleMeta = rule ? ruleLabels[rule.type] : null

                  return (
                    <tr key={account.id} className="hover-row">
                      <td className="!font-sans">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#0F172A]">{account.name}</span>
                          {account.isGroup && (
                            <span className="rounded border border-[#E5E7EB] bg-[#F8FAFC] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#94A3B8]">
                              Group
                            </span>
                          )}
                        </div>
                        {account.code && (
                          <p className="text-[10px] text-[#94A3B8]">{account.code}</p>
                        )}
                      </td>
                      <td className="!font-sans">
                        {account.standardMapping ? (
                          <span className="text-xs text-[#64748B]">{account.standardMapping}</span>
                        ) : (
                          <span className="text-xs text-[#CBD5E1]">—</span>
                        )}
                      </td>
                      {isIncomeStatement && (
                        <td className="!font-sans">
                          {ruleMeta ? (
                            <span className={cn('inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold', ruleMeta.color, ruleMeta.bg, ruleMeta.border)}>
                              {ruleMeta.label}
                              {rule?.type === 'growth' && ` +${Math.round((rule as { monthlyGrowthRate: number }).monthlyGrowthRate * 100)}%/mo`}
                              {rule?.type === 'rolling_avg' && ` ${(rule as { lookbackMonths: number }).lookbackMonths}mo avg`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#CBD5E1]">Auto (no rule)</span>
                          )}
                        </td>
                      )}
                      {isIncomeStatement && (
                        <td className="!font-sans">
                          {profile ? (
                            <span className="inline-flex items-center rounded border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold text-[#2563EB]">
                              {profile.month_0 === 1 ? 'Immediate' :
                               profile.month_1 === 1 ? '30 days' :
                               profile.month_2 === 1 ? '60 days' :
                               `${Math.round((profile.month_0 ?? 0) * 100)}% same mo`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#CBD5E1]">Not set</span>
                          )}
                        </td>
                      )}
                      <td>
                        {latestValue > 0 ? (
                          <span className={cn('font-num', latestValue < 0 ? 'text-[#DC2626]' : '')}>
                            {formatAuto(latestValue)}
                          </span>
                        ) : (
                          <span className="text-[#CBD5E1]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </SurfaceCard>
        )
      })}

      {/* Help text */}
      <SurfaceCard className="border-[#EFF6FF] bg-[#EFF6FF]">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
          <div>
            <p className="text-sm font-semibold text-[#1E3A5F]">Configure forecast methods from the Forecast page</p>
            <p className="mt-1 text-xs leading-5 text-[#2563EB]">
              In the Forecast → P&L view, hover over any account name and click the ⚙ icon to set its growth rate, 
              rolling average lookback, or payment terms. Changes take effect immediately in the engine.
            </p>
          </div>
        </div>
      </SurfaceCard>
    </div>
  )
}
