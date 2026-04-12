'use client'

import { useMemo } from 'react'
import { FileSpreadsheet, Layers, TrendingUp, BookOpen, Loader2 } from 'lucide-react'
import { useCompanyContext } from '@/hooks/use-company-context'
import { useAccountsStore } from '@/stores/accounts-store'
import { cn } from '@/lib/utils'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'

const typeConfig: Record<string, { color: string; bg: string; border: string; icon: typeof TrendingUp }> = {
  revenue: { color: 'text-emerald-300', bg: 'bg-emerald-400/10', border: 'border-emerald-400/15', icon: TrendingUp },
  expense: { color: 'text-rose-300', bg: 'bg-rose-400/10', border: 'border-rose-400/15', icon: BookOpen },
  asset: { color: 'text-sky-300', bg: 'bg-sky-400/10', border: 'border-sky-400/15', icon: Layers },
  liability: { color: 'text-amber-300', bg: 'bg-amber-400/10', border: 'border-amber-400/15', icon: FileSpreadsheet },
  equity: { color: 'text-teal-300', bg: 'bg-teal-400/10', border: 'border-teal-400/15', icon: Layers },
}

export default function AccountsPage() {
  const { isLoading } = useCompanyContext()
  const accounts = useAccountsStore((state) => state.accounts)

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
  const typeLabels: Record<string, string> = {
    revenue: 'Revenue',
    expense: 'Operating Expenses',
    asset: 'Assets',
    liability: 'Liabilities',
    equity: 'Equity',
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm text-slate-400">Loading chart of accounts...</p>
        </div>
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Chart of accounts"
          title="Chart of Accounts"
          description="Your account structure will appear here once you import financial data through the Import Pipeline."
          badges={<HeaderBadge label="No accounts yet" tone="warning" />}
        />
        <SurfaceCard className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <FileSpreadsheet className="h-10 w-10 text-slate-500" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-white">No accounts imported yet</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
            Upload your P&L or Balance Sheet in the Import Pipeline. CashFlowIQ will auto-detect your chart of accounts and map them to the Indian Schedule III structure.
          </p>
          <a
            href="/data"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Go to Import Pipeline
          </a>
        </SurfaceCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Chart of accounts"
        title="Chart of Accounts"
        description="Indian Schedule III mapped account structure. Every account flows into forecast P&L, balance sheet, and cash flow statements."
        badges={
          <>
            <HeaderBadge label={`${accounts.length} mapped accounts`} tone="success" />
            <HeaderBadge label={`${Object.keys(grouped).length} categories`} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        {groupOrder.map((type) => {
          const count = grouped[type]?.length ?? 0
          const config = typeConfig[type] ?? typeConfig.expense
          return (
            <div key={type} className={cn('stagger-enter rounded-[20px] border p-4', config.border, 'bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.72))] backdrop-blur')}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{typeLabels[type] ?? type}</p>
              <p className={cn('mt-2 text-2xl font-semibold tabular-nums', config.color)}>{count}</p>
            </div>
          )
        })}
      </div>

      {groupOrder.map((type) => {
        const group = grouped[type]
        if (!group || group.length === 0) return null
        const config = typeConfig[type] ?? typeConfig.expense
        const TypeIcon = config.icon

        return (
          <SurfaceCard key={type}>
            <div className="flex items-center gap-3">
              <div className={cn('rounded-xl p-2.5', config.bg)}>
                <TypeIcon className={cn('h-5 w-5', config.color)} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{typeLabels[type] ?? type}</p>
                <p className="text-xs text-slate-400">{group.length} accounts</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((account) => (
                <div
                  key={account.id}
                  className="rounded-2xl border border-white/6 bg-white/5 px-4 py-3 transition hover:bg-white/8"
                >
                  <p className="text-sm font-medium text-white">{account.name}</p>
                  {account.standardMapping && (
                    <p className="mt-1 text-[11px] text-slate-500">{account.standardMapping}</p>
                  )}
                </div>
              ))}
            </div>
          </SurfaceCard>
        )
      })}
    </div>
  )
}
