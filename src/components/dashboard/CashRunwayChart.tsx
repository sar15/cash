'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatCompact, paise2rupees } from '@/hooks/use-format-currency'

interface RunwayChartProps {
  /** Array of monthly cash balances in paise */
  monthlyBalances: number[]
  /** Month labels like ['Apr-25', 'May-25', ...] */
  monthLabels: string[]
  /** Minimum cash threshold in paise (danger zone) */
  dangerThreshold?: number
}

export function CashRunwayChart({
  monthlyBalances,
  monthLabels,
  dangerThreshold = 5_00_000_00, // ₹5L default
}: RunwayChartProps) {
  const data = monthLabels.map((label, i) => ({
    month: label,
    cash: paise2rupees(monthlyBalances[i] ?? 0),
  }))

  const thresholdRupees = paise2rupees(dangerThreshold)

  const minCash = Math.min(...data.map((d) => d.cash))
  const belowThreshold = minCash < thresholdRupees

  return (
    <div className="rounded-md border border-[#E5E7EB] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Cash Runway Projection</p>
          <p className="text-xs text-[#94A3B8]">Monthly cash balance trajectory · danger threshold at {formatCompact(dangerThreshold)}</p>
        </div>
        {belowThreshold && (
          <span className="inline-flex items-center rounded border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#DC2626]">
            ⚠ Below Threshold
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="cashGradientLight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            tickFormatter={(v) => {
              const abs = Math.abs(v)
              if (abs >= 10000000) return `₹${(v / 10000000).toFixed(0)}Cr`
              if (abs >= 100000) return `₹${(v / 100000).toFixed(0)}L`
              if (abs >= 1000) return `₹${(v / 1000).toFixed(0)}K`
              return `₹${v}`
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              color: '#0F172A',
              fontSize: '12px',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => {
              const paise = Math.round(Number(value) * 100)
              return [formatCompact(paise), 'Cash Balance']
            }}
          />
          <ReferenceLine
            y={thresholdRupees}
            stroke="#DC2626"
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{
              value: `Min: ${formatCompact(dangerThreshold)}`,
              position: 'right',
              fill: '#DC2626',
              fontSize: 10,
            }}
          />
          <Area
            type="monotone"
            dataKey="cash"
            stroke="#059669"
            strokeWidth={2}
            fill="url(#cashGradientLight)"
            dot={false}
            activeDot={{ r: 4, fill: '#059669', stroke: '#FFFFFF', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
