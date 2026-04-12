'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import { formatCompact, paise2rupees } from '@/hooks/use-format-currency'

interface WaterfallProps {
  operatingCF: number // paise
  investingCF: number // paise
  financingCF: number // paise
}

interface WaterfallItem {
  name: string
  value: number
  fill: string
  displayValue: string
}

export function CashFlowWaterfall({ operatingCF, investingCF, financingCF }: WaterfallProps) {
  const netCF = operatingCF + investingCF + financingCF

  const data: WaterfallItem[] = [
    {
      name: 'Operating',
      value: paise2rupees(operatingCF),
      fill: operatingCF >= 0 ? '#34d399' : '#fb7185',
      displayValue: formatCompact(operatingCF),
    },
    {
      name: 'Investing',
      value: paise2rupees(investingCF),
      fill: investingCF >= 0 ? '#34d399' : '#fb7185',
      displayValue: formatCompact(investingCF),
    },
    {
      name: 'Financing',
      value: paise2rupees(financingCF),
      fill: financingCF >= 0 ? '#34d399' : '#fb7185',
      displayValue: formatCompact(financingCF),
    },
    {
      name: 'Net Cash Flow',
      value: paise2rupees(netCF),
      fill: netCF >= 0 ? '#10b981' : '#f43f5e',
      displayValue: formatCompact(netCF),
    },
  ]

  return (
    <div className="stagger-enter rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.72))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.2)] backdrop-blur">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Cash Flow Breakdown</p>
          <p className="text-xs text-slate-400">Operating, investing, and financing activities.</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
          <XAxis
            dataKey="name"
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
              return [formatCompact(paise), 'Amount']
            }}
          />
          <ReferenceLine y={0} stroke="rgba(148,163,184,0.2)" strokeWidth={1} />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={72}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
