'use client'

import { formatAuto } from '@/lib/utils/indian-format'

interface QuickMetricsGridProps {
  cashPosition: number
  runway: number
  netIncome: number
  workingCapitalDays: number
}

function MetricCard({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string
  value: string
  sublabel?: string
  tone?: 'green' | 'amber' | 'red' | 'default'
}) {
  const dotClass =
    tone === 'green' ? 'health-dot health-dot-green' :
    tone === 'amber' ? 'health-dot health-dot-amber' :
    tone === 'red' ? 'health-dot health-dot-red' : ''

  return (
    <div className="rounded-md border border-[#E5E7EB] bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        {tone ? <span className={dotClass} /> : null}
        <span className="label-xs">{label}</span>
      </div>
      <p className="mt-2 font-num text-xl font-semibold text-[#0F172A]">{value}</p>
      {sublabel ? (
        <p className="mt-1 text-xs text-[#94A3B8]">{sublabel}</p>
      ) : null}
    </div>
  )
}

export function QuickMetricsGrid({
  cashPosition,
  runway,
  netIncome,
  workingCapitalDays,
}: QuickMetricsGridProps) {
  const runwayTone = runway >= 6 ? 'green' as const : runway >= 3 ? 'amber' as const : 'red' as const
  const cashTone = cashPosition > 0 ? 'green' as const : 'red' as const
  const incomeTone = netIncome >= 0 ? 'green' as const : 'red' as const

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Cash Position"
        value={formatAuto(cashPosition)}
        sublabel="Current modeled cash"
        tone={cashTone}
      />
      <MetricCard
        label="Runway"
        value={`${runway.toFixed(1)}m`}
        sublabel="At current burn rate"
        tone={runwayTone}
      />
      <MetricCard
        label="Net Income"
        value={formatAuto(netIncome)}
        sublabel="Cumulative forecast"
        tone={incomeTone}
      />
      <MetricCard
        label="Working Capital"
        value={`${workingCapitalDays}d`}
        sublabel="Gap in days"
        tone="default"
      />
    </div>
  )
}
