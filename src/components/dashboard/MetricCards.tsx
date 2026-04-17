'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatAuto } from '@/lib/utils/indian-format'
import { cn } from '@/lib/utils'

// Inline sparkline — pure SVG, no recharts
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 64
  const h = 24
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  })
  return (
    <svg width={w} height={h} className="overflow-visible opacity-50">
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
  explanation: string   // plain-English "what this means"
  tone: 'green' | 'amber' | 'red' | 'neutral'
  trend?: { direction: 'up' | 'down'; label: string; positive: boolean }
  sparklineValues?: number[]
  hero?: boolean
}

function MetricCard({ label, value, explanation, tone, trend, sparklineValues, hero }: MetricCardProps) {
  const colors = {
    green:   { value: 'text-[#059669]', dot: 'bg-[#059669]', spark: '#059669', border: 'border-[#E2E8F0]', accent: 'border-l-[#059669]' },
    amber:   { value: 'text-[#D97706]', dot: 'bg-[#D97706]', spark: '#D97706', border: 'border-[#E2E8F0]', accent: 'border-l-[#D97706]' },
    red:     { value: 'text-[#DC2626]', dot: 'bg-[#DC2626]', spark: '#DC2626', border: 'border-[#E2E8F0]', accent: 'border-l-[#DC2626]' },
    neutral: { value: 'text-[#0F172A]', dot: 'bg-[#94A3B8]', spark: '#94A3B8', border: 'border-[#E2E8F0]', accent: 'border-l-[#94A3B8]' },
  }
  const c = colors[tone]

  return (
    <div className={cn(
      'rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm',
      c.border,
      hero && `border-l-4 ${c.accent}`
    )}>
      {/* Label + status dot */}
      <div className="flex items-center gap-2">
        <div className={cn('h-2 w-2 rounded-full', c.dot)} />
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748B]">{label}</span>
      </div>

      {/* Value + sparkline */}
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <p className={cn(
          'font-num font-bold leading-none tracking-tight',
          hero ? 'text-[30px]' : 'text-[22px]',
          c.value
        )}>
          {value}
        </p>
        {sparklineValues && sparklineValues.length >= 3 && (
          <Sparkline values={sparklineValues} color={c.spark} />
        )}
      </div>

      {/* Trend */}
      {trend && (
        <div className={cn(
          'mt-1.5 flex items-center gap-1 text-[11px] font-medium',
          trend.positive ? 'text-[#059669]' : 'text-[#DC2626]'
        )}>
          {trend.direction === 'up'
            ? <TrendingUp className="h-3 w-3" />
            : <TrendingDown className="h-3 w-3" />
          }
          <span>{trend.label}</span>
        </div>
      )}

      {/* Plain-English explanation */}
      <p className="mt-2 text-[11px] leading-4 text-[#94A3B8]">{explanation}</p>
    </div>
  )
}

interface QuickMetricsGridProps {
  cashPosition: number
  runway: number
  netIncome: number
  workingCapitalDays: number
  grossMarginPct: number
  operatingCashFlow: number
  freeCashFlow: number
  monthlyCash?: number[]
  monthlyNetIncome?: number[]
}

export function QuickMetricsGrid({
  cashPosition, runway, netIncome, workingCapitalDays,
  grossMarginPct, operatingCashFlow, freeCashFlow,
  monthlyCash, monthlyNetIncome
}: QuickMetricsGridProps) {

  const runwayTone = runway >= 6 ? 'green' as const : runway >= 3 ? 'amber' as const : 'red' as const
  const runwayDisplay = runway >= 36 ? '36m+' : `${runway.toFixed(1)}m`
  const runwayExplanation = runway >= 36
    ? 'At current burn rate, cash will last beyond the forecast horizon.'
    : runway >= 6
    ? `How long cash will last at current spending. ${runway.toFixed(1)} months is healthy.`
    : runway >= 3
    ? 'Cash is running low. Consider reducing costs or raising capital.'
    : 'Critical. Cash will run out soon without immediate action.'

  const cashTone = cashPosition > 0 ? 'green' as const : 'red' as const

  const incomeTone = netIncome >= 0 ? 'green' as const : 'red' as const
  const incomeExplanation = netIncome >= 0
    ? 'Revenue minus all costs over the forecast period. Positive means profitable.'
    : 'Costs exceed revenue over the forecast period. Review expenses.'

  const marginTone = grossMarginPct >= 40 ? 'green' as const : grossMarginPct >= 20 ? 'amber' as const : 'red' as const
  const marginExplanation = grossMarginPct >= 40
    ? 'Strong margin. For every ₹100 of revenue, ₹' + grossMarginPct.toFixed(0) + ' remains after direct costs.'
    : grossMarginPct >= 20
    ? 'Moderate margin. Consider reducing direct costs to improve profitability.'
    : 'Low margin. Direct costs are consuming most of revenue.'

  const ocfTone = operatingCashFlow >= 0 ? 'green' as const : 'red' as const
  const ocfExplanation = operatingCashFlow >= 0
    ? 'Business operations are generating cash. This is the most important cash metric.'
    : 'Operations are consuming cash. This needs attention even if P&L shows profit.'

  const fcfTone = freeCashFlow >= 0 ? 'green' as const : 'red' as const
  const fcfExplanation = freeCashFlow >= 0
    ? 'Cash left after operations and capital spending. Available for debt repayment or growth.'
    : 'Capital spending exceeds operating cash. Normal during growth phases.'

  const wcExplanation = workingCapitalDays > 0
    ? `You collect from customers ${workingCapitalDays}d before paying suppliers. Lower is better.`
    : workingCapitalDays < 0
    ? `Suppliers are paid ${Math.abs(workingCapitalDays)}d before customers pay you. Watch cash carefully.`
    : 'Collections and payments are balanced.'

  return (
    <div className="space-y-3">
      {/* Row 1: The two most critical metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Cash Runway"
          value={runwayDisplay}
          explanation={runwayExplanation}
          tone={runwayTone}
          hero
          sparklineValues={monthlyCash}
        />
        <MetricCard
          label="Cash Position"
          value={formatAuto(cashPosition)}
          explanation="Projected closing cash balance at end of forecast period."
          tone={cashTone}
          sparklineValues={monthlyCash}
        />
        <MetricCard
          label="Operating Cash Flow"
          value={formatAuto(operatingCashFlow)}
          explanation={ocfExplanation}
          tone={ocfTone}
        />
        <MetricCard
          label="Free Cash Flow"
          value={formatAuto(freeCashFlow)}
          explanation={fcfExplanation}
          tone={fcfTone}
        />
      </div>

      {/* Row 2: Profitability metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Net Income"
          value={formatAuto(netIncome)}
          explanation={incomeExplanation}
          tone={incomeTone}
          sparklineValues={monthlyNetIncome}
        />
        <MetricCard
          label="Gross Margin"
          value={`${grossMarginPct.toFixed(1)}%`}
          explanation={marginExplanation}
          tone={marginTone}
        />
        <MetricCard
          label="Working Capital Days"
          value={`${workingCapitalDays}d`}
          explanation={wcExplanation}
          tone={workingCapitalDays <= 45 ? 'green' : workingCapitalDays <= 90 ? 'amber' : 'red'}
        />
        <MetricCard
          label="Burn Rate"
          value={operatingCashFlow < 0 ? formatAuto(Math.abs(operatingCashFlow / 12)) : 'Positive'}
          explanation={operatingCashFlow < 0
            ? 'Average monthly cash consumed by operations. Reduce to extend runway.'
            : 'Operations are generating cash, not consuming it.'}
          tone={operatingCashFlow < 0 ? 'red' : 'green'}
        />
      </div>
    </div>
  )
}
