'use client'

import { useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { formatAuto } from '@/lib/utils/indian-format'
import type { EngineResult } from '@/lib/engine'

interface Props {
  engineResult: EngineResult | null
  forecastMonths: string[]
}

export function CashFlowWaterfall({ engineResult, forecastMonths }: Props) {
  const data = useMemo(() => {
    if (!engineResult) return []
    return engineResult.rawIntegrationResults.map((m, i) => {
      const revenue = m?.pl?.revenue ?? 0
      const cogs = m?.pl?.cogs ?? 0
      const expense = m?.pl?.expense ?? 0
      const ocf = m?.cf?.operatingCashFlow ?? 0
      const cash = m?.bs?.cash ?? 0
      const netIncome = m?.pl?.netIncome ?? 0

      return {
        month: forecastMonths[i] ?? `M${i + 1}`,
        // Convert to rupees for chart scale
        revenue: revenue / 100,
        costs: (cogs + expense) / 100,
        netIncome: netIncome / 100,
        ocf: ocf / 100,
        cash: cash / 100,
        // Raw paise for tooltip
        revenuePaise: revenue,
        costsPaise: cogs + expense,
        netIncomePaise: netIncome,
        ocfPaise: ocf,
        cashPaise: cash,
      }
    })
  }, [engineResult, forecastMonths])

  if (!engineResult || data.length === 0) {
    return null
  }

  // Summary stats
  const totalRevenue = data.reduce((s, d) => s + d.revenuePaise, 0)
  const totalCosts = data.reduce((s, d) => s + d.costsPaise, 0)
  const totalNetIncome = data.reduce((s, d) => s + d.netIncomePaise, 0)
  const totalOCF = data.reduce((s, d) => s + d.ocfPaise, 0)
  const profitableMonths = data.filter(d => d.netIncomePaise > 0).length

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Monthly P&L vs Cash Flow</p>
          <p className="mt-0.5 text-xs text-[#94A3B8]">
            Revenue, costs, and net income per month — with operating cash flow overlay
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">Profitable months</p>
          <p className="mt-0.5 text-sm font-bold text-[#0F172A]">{profitableMonths} / {data.length}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
            formatter={(value: unknown, name: unknown) => {
              const paise = Math.round(Number(value) * 100)
              const labels: Record<string, string> = {
                revenue: 'Revenue',
                costs: 'Total Costs',
                netIncome: 'Net Income',
                ocf: 'Operating Cash Flow',
              }
              return [formatAuto(paise), labels[String(name)] ?? String(name)]
            }}
            labelStyle={{ fontWeight: 600, color: '#0F172A', marginBottom: 4 }}
          />
          <ReferenceLine y={0} stroke="#E2E8F0" strokeWidth={1} />
          <Bar dataKey="revenue" fill="#2563EB" fillOpacity={0.15} stroke="#2563EB" strokeWidth={1} radius={[3, 3, 0, 0]} name="revenue" />
          <Bar dataKey="costs" fill="#DC2626" fillOpacity={0.12} stroke="#DC2626" strokeWidth={1} radius={[3, 3, 0, 0]} name="costs" />
          <Line type="monotone" dataKey="netIncome" stroke="#059669" strokeWidth={2} dot={false} name="netIncome" />
          <Line type="monotone" dataKey="ocf" stroke="#D97706" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="ocf" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-[#F1F5F9] pt-3 text-[11px] text-[#64748B]">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm border border-[#2563EB] bg-[#2563EB]/15" />
          <span>Revenue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm border border-[#DC2626] bg-[#DC2626]/12" />
          <span>Total Costs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-5 bg-[#059669]" />
          <span>Net Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-5 border-t-2 border-dashed border-[#D97706]" />
          <span>Operating Cash Flow</span>
        </div>
      </div>

      {/* Summary row */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Revenue', value: totalRevenue, color: 'text-[#2563EB]' },
          { label: 'Total Costs', value: totalCosts, color: 'text-[#DC2626]' },
          { label: 'Net Income', value: totalNetIncome, color: totalNetIncome >= 0 ? 'text-[#059669]' : 'text-[#DC2626]' },
          { label: 'Operating CF', value: totalOCF, color: totalOCF >= 0 ? 'text-[#059669]' : 'text-[#DC2626]' },
        ].map(item => (
          <div key={item.label} className="rounded-lg bg-[#F8FAFC] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">{item.label}</p>
            <p className={`mt-0.5 text-sm font-bold tabular-nums ${item.color}`}>{formatAuto(item.value)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
