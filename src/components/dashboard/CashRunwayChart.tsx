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
    <div className="stagger-enter rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.72))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.2)] backdrop-blur">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Cash Runway Projection</p>
          <p className="text-xs text-slate-400">Monthly cash balance trajectory with danger threshold.</p>
        </div>
        {belowThreshold && (
          <span className="inline-flex items-center rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200">
            ⚠ Below Threshold
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
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
              backgroundColor: '#0f172a',
              border: '1px solid rgba(148,163,184,0.15)',
              borderRadius: '16px',
              color: '#e2e8f0',
              fontSize: '12px',
              boxShadow: '0 8px 32px rgba(2,6,23,0.4)',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => {
              const paise = Math.round(Number(value) * 100)
              return [formatCompact(paise), 'Cash Balance']
            }}
          />
          <ReferenceLine
            y={thresholdRupees}
            stroke="#fb7185"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{
              value: `Min: ${formatCompact(dangerThreshold)}`,
              position: 'right',
              fill: '#fb7185',
              fontSize: 10,
            }}
          />
          <Area
            type="monotone"
            dataKey="cash"
            stroke="#34d399"
            strokeWidth={2.5}
            fill="url(#cashGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#34d399', stroke: '#0F172A', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
