'use client'

import { useCompanyContext } from '@/hooks/use-company-context'
import { cn } from '@/lib/utils'
import {
  Briefcase,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { HeaderBadge, PageHeader, SurfaceCard } from '@/components/shared/page-header'

type HealthStatus = 'healthy' | 'warning' | 'critical'

function getHealthStatus(company: { industry: string }): HealthStatus {
  // Placeholder — will compute from actual cash data later
  const hash = company.industry.length % 3
  return hash === 0 ? 'healthy' : hash === 1 ? 'warning' : 'critical'
}

const healthConfig: Record<HealthStatus, { color: string; bg: string; border: string; accent: string; label: string; icon: typeof CheckCircle2 }> = {
  healthy: { color: 'text-emerald-300', bg: 'bg-emerald-400/10', border: 'border-emerald-400/15', accent: 'border-t-emerald-400', label: 'Healthy', icon: CheckCircle2 },
  warning: { color: 'text-amber-300', bg: 'bg-amber-400/10', border: 'border-amber-400/15', accent: 'border-t-amber-400', label: 'Monitor', icon: AlertTriangle },
  critical: { color: 'text-rose-300', bg: 'bg-rose-400/10', border: 'border-rose-400/15', accent: 'border-t-rose-400', label: 'At Risk', icon: AlertTriangle },
}

export default function ClientsPage() {
  const { companies, isLoading, isCA, switchCompany } = useCompanyContext()

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm text-slate-400">Loading client portfolio...</p>
        </div>
      </div>
    )
  }

  if (!isCA) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <SurfaceCard className="max-w-md p-8 text-center">
          <div className="mx-auto rounded-2xl border border-white/10 bg-white/5 p-5 w-fit">
            <Briefcase className="h-10 w-10 text-slate-500" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-white">CA Portfolio</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Add multiple companies to unlock the CA portfolio view. This feature is designed for
            Chartered Accountants managing multiple clients.
          </p>
          <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
            <Plus className="h-4 w-4" />
            Add Client Company
          </button>
        </SurfaceCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CA portfolio"
        title="Client Portfolio"
        description="Review cash health, open the right client instantly, and give every company the same premium forecasting workflow."
        badges={
          <>
            <HeaderBadge label={`${companies.length} active clients`} tone="success" />
            <HeaderBadge label="Multi-client mode" />
          </>
        }
        actions={
          <button className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
            <Plus className="h-4 w-4" />
            Add Client
          </button>
        }
      />

      {/* Client Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((company) => {
          const health = getHealthStatus(company)
          const config = healthConfig[health]
          const HealthIcon = config.icon

          return (
            <Link
              key={company.id}
              href={`/clients/${company.id}`}
              onClick={() => switchCompany(company.id)}
              className={cn(
                'stagger-enter hover-lift group relative overflow-hidden rounded-[20px] border-t-2 border bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.72))] p-5 backdrop-blur transition-all',
                config.border,
                config.accent
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white transition-colors group-hover:text-emerald-300">
                    {company.name}
                  </h3>
                  <span className="mt-1.5 inline-block rounded-full border border-white/8 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                    {company.industry}
                  </span>
                </div>
                <div className={cn('rounded-xl p-1.5', config.bg)}>
                  <HealthIcon className={cn('h-4 w-4', config.color)} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Cash</p>
                  <p className="text-sm font-semibold text-white">—</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Runway</p>
                  <p className="text-sm font-semibold text-white">—</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3">
                <span className={cn('text-[10px] font-semibold uppercase tracking-[0.16em]', config.color)}>
                  {config.label}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-600 transition-colors group-hover:text-emerald-300" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
