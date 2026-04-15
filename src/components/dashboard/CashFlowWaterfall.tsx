'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts'
import { formatCompact } from '@/hooks/use-format-currency'
import type { EngineResult } from '@/lib/engine'
import { AlertTriangle } from 'lucide-react'

interface WaterfallData {
  month: string
  opening: number
  inflows: number
  outflows: number
  closing: number
  isNegative: boolean
}

interface Props {
  engineResult: EngineResult | null
  forecastMonths: string[]
}

export function CashFlowWaterfall({ engineResult, forecastMonths }: Props) {
  const data = useMemo((): WaterfallData[] => {
    if (!engineResult) return []
    
    return engineResult.integrationResults.map((m, i) => {
      const prevCash = i === 0 ? 0 : engineResult.integrationResults[i - 1].bs.cash
      const ocf = m.cf.operatingCashFlow
      const closing = m.bs.cash
      
      return {
        month: forecastMonths[i],
        opening: prevCash,
        inflows: ocf > 0 ? ocf : 0,
        outflows: ocf < 0 ? Math.abs(ocf) : 0,
        closing,
        isNegative: closing < 0
      }
    })
  }, [engineResult, forecastMonths])

  const hasNegativeCash = data.some(d => d.isNegative)

  if (!engineResult || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
            <svg className="h-6 w-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#0F172A]">No forecast data</p>
          <p className="mt-1 text-xs text-[#94A3B8]">Import financial data to see your cash flow waterfall</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0F172A]">Cash Flow Waterfall</h3>
        {hasNegativeCash && (
          <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
            <AlertTriangle className="h-3 w-3" />
            Negative cash detected
          </div>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={{ stroke: '#E2E8F0' }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickFormatter={(v) => formatCompact(v)}
                axisLine={{ stroke: '#E2E8F0' }}
              />
              <Tooltip
                formatter={(value) => [formatCompact(value as number), '']}
                contentStyle={{ 
                  borderRadius: 8, 
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                }}
                labelStyle={{ fontWeight: 600, color: '#0F172A' }}
              />
              <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="3 3" />
              <Bar dataKey="inflows" stackId="a" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outflows" stackId="a" fill="#DC2626" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.isNegative ? '#DC2626' : '#DC2626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-[#059669]" />
          <span className="text-[#64748B]">Cash Inflows</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-[#DC2626]" />
          <span className="text-[#64748B]">Cash Outflows</span>
        </div>
      </div>
    </div>
  )
}
