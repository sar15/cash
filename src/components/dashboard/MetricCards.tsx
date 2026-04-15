'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatAuto } from '@/lib/utils/indian-format'
import { cn } from '@/lib/utils'

// Inline sparkline — no recharts dependency, pure SVG
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 80
  const h = 28
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  })
  return (
    <svg width={w} height={h} className="overflow-visible opacity-60">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface MetricCardProps {
  label: string
  value: string
  sublabel?: string
  tone?: 'green' | 'amber' | 'red' | 'default'
  hero?: boolean
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  sparklineValues?: number[]
}

function MetricCard({ label, value, sublabel, tone, hero, trend, trendLabel, sparklineValues }: MetricCardProps) {
  const toneColors = {
    green:   { dot: 'health-dot health-dot-green', value: 'text-[#059669]', bg: 'bg-[#ECFDF5]', border: 'border-[#A7F3D0]', spark: '#059669' },
    amber:   { dot: 'health-dot health-dot-amber', value: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]', spark: '#D97706' },
    red:     { dot: 'health-dot health-dot-red',   value: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]', spark: '#DC2626' },
    default: { dot: '',                             value: 'text-[#0F172A]', bg: 'bg-white',     border: 'border-[#E2E8F0]', spark: '#94A3B8' },
  }

  const tc = toneColors[tone ?? 'default']

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-[#059669]' : trend === 'down' ? 'text-[#DC2626]' : 'text-[#94A3B8]'

  return (
    <div className={cn(
      'metric-card relative overflow-hidden',
      hero && `border-l-4 ${tc.border.replace('border-', 'border-l-')}`
    )}>
      {/* Background tint for hero */}
      {hero && tone && tone !== 'default' && (
        <div className={cn('absolute inset-0 opacity-[0.04]', tc.bg)} />
      )}

      <div className="relative">
        {/* Label row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {tone && tone !== 'default' && <span className={tc.dot} />}
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
              {label}
            </span>
          </div>
          {trend && trendLabel && (
            <div className={cn('flex items-center gap-1 text-[11px] font-medium', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              <span>{trendLabel}</span>
            </div>
          )}
        </div>

        {/* Value + sparkline row */}
        <div className="mt-2 flex items-end justify-between">
          <p className={cn(
            'font-num font-semibold tracking-tight',
            hero ? 'text-[28px] leading-none' : 'text-[22px] leading-none',
            tone && tone !== 'default' ? tc.value : 'text-[#0F172A]'
          )}>
            {value}
          </p>
          {sparklineValues && sparklineValues.length >= 2 && (
            <Sparkline values={sparklineValues} color={tc.spark} />
          )}
        </div>

        {/* Sublabel */}
        {sublabel && (
          <p className="mt-1.5 text-xs text-[#94A3B8]">{sublabel}</p>
        )}
      </div>
    </div>
  )
}

interface QuickMetricsGridProps {
  cashPosition: number
  runway: number
  netIncome: number
  workingCapitalDays: number
  monthlyCash?: number[]
  monthlyNetIncome?: number[]
}

export function QuickMetricsGrid({ cashPosition, runway, netIncome, workingCapitalDays, monthlyCash, monthlyNetIncome }: QuickMetricsGridProps) {
  const runwayTone = runway >= 6 ? 'green' as const : runway >= 3 ? 'amber' as const : 'red' as const
  const cashTone = cashPosition > 0 ? 'green' as const : 'red' as const
  const incomeTone = netIncome >= 0 ? 'green' as const : 'red' as const

  const runwayDisplay = runway >= 36 ? '36m+' : `${runway.toFixed(1)}m`
  const runwaySublabel = runway >= 36
    ? 'Strong cash position'
    : runway >= 6
    ? 'At current burn rate'
    : runway >= 3
    ? 'Monitor closely'
    : 'Critical — take action now'

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
      <MetricCard
        label="Cash Runway"
        value={runwayDisplay}
        sublabel={runwaySublabel}
        tone={runwayTone}
        hero
        sparklineValues={monthlyCash?.map((_, i, arr) => {
          // Derive runway from each month's cash
          const avgBurn = monthlyCash.reduce((s, v) => s + Math.max(0, -v), 0) / Math.max(monthlyCash.length, 1)
          return avgBurn > 0 ? arr[i] / avgBurn : 36
        })}
      />
      <MetricCard
        label="Cash Position"
        value={formatAuto(cashPosition)}
        sublabel="Current modeled cash"
        tone={cashTone}
        sparklineValues={monthlyCash}
      />
      <MetricCard
        label="Net Income"
        value={formatAuto(netIncome)}
        sublabel="Cumulative 12-month"
        tone={incomeTone}
        sparklineValues={monthlyNetIncome}
      />
      <MetricCard
        label="Working Capital"
        value={`${workingCapitalDays}d`}
        sublabel="AR minus AP gap"
        tone="default"
      />
    </div>
  )
}
