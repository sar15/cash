'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { formatAuto } from '@/lib/utils/indian-format'

interface RunwayChartProps {
  monthlyBalances: number[]   // in paise
  monthLabels: string[]
  dangerThreshold?: number    // in paise
}

function fmt(paise: number) {
  const r = paise / 100
  const abs = Math.abs(r)
  if (abs >= 10_000_000) return `₹${(r / 10_000_000).toFixed(1)}Cr`
  if (abs >= 100_000)    return `₹${(r / 100_000).toFixed(1)}L`
  if (abs >= 1_000)      return `₹${(r / 1_000).toFixed(0)}K`
  return `₹${Math.round(r)}`
}

export function CashRunwayChart({
  monthlyBalances,
  monthLabels,
  dangerThreshold = 5_00_000_00,
}: RunwayChartProps) {
  const data = monthLabels.map((label, i) => ({
    month: label,
    cashPaise: monthlyBalances[i] ?? 0,
    cash: (monthlyBalances[i] ?? 0) / 100,  // rupees for chart scale
  }))

  const thresholdRupees = dangerThreshold / 100
  const minCash = Math.min(...data.map(d => d.cash))
  const belowThreshold = minCash < thresholdRupees
  const trend = data.length >= 2
    ? data[data.length - 1].cash - data[0].cash
    : 0

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Cash Balance Trajectory</p>
          <p className="mt-0.5 text-xs text-[#94A3B8]">
            Projected month-by-month cash position over the forecast period
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {belowThreshold && (
            <span className="inline-flex items-center rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#DC2626]">
              ⚠ Below minimum
            </span>
          )}
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">
              {trend >= 0 ? 'Growing' : 'Declining'}
            </p>
            <p className={`text-sm font-bold ${trend >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
              {trend >= 0 ? '+' : ''}{fmt(trend * 100)}
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-3 flex items-center gap-4 text-[11px] text-[#94A3B8]">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
          <span>Cash balance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-px w-5 border-t-2 border-dashed border-[#DC2626]" />
          <span>Minimum threshold ({fmt(dangerThreshold)})</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#F1F5F9" vertical={false} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'Inter' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'Inter' }}
            tickFormatter={v => {
              const abs = Math.abs(v)
              if (abs >= 10_000_000) return `₹${(v / 10_000_000).toFixed(0)}Cr`
              if (abs >= 100_000)    return `₹${(v / 100_000).toFixed(0)}L`
              if (abs >= 1_000)      return `₹${(v / 1_000).toFixed(0)}K`
              return `₹${v}`
            }}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
              fontSize: '12px',
              fontFamily: 'Inter',
            }}
            formatter={(value: unknown) => {
              const paise = Math.round(Number(value) * 100)
              return [formatAuto(paise), 'Cash Balance']
            }}
            labelStyle={{ fontWeight: 600, color: '#0F172A', marginBottom: 4 }}
          />
          <ReferenceLine
            y={thresholdRupees}
            stroke="#DC2626"
            strokeDasharray="5 3"
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="cash"
            stroke="#2563EB"
            strokeWidth={2}
            fill="url(#cashGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Summary row */}
      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-[#F1F5F9] pt-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">Opening</p>
          <p className="mt-0.5 text-sm font-semibold text-[#0F172A]">{fmt(data[0]?.cashPaise ?? 0)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">Lowest</p>
          <p className={`mt-0.5 text-sm font-semibold ${belowThreshold ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>
            {fmt(minCash * 100)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">Closing</p>
          <p className="mt-0.5 text-sm font-semibold text-[#0F172A]">{fmt(data[data.length - 1]?.cashPaise ?? 0)}</p>
        </div>
      </div>
    </div>
  )
}
