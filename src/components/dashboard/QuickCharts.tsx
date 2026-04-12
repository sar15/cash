'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatLakhs } from '@/lib/utils/indian-format';

export interface CashWaterfallDatum {
  month: string;
  openingCash: number;
  netCashFlow: number;
  closingCash: number;
  threshold: number;
  belowThreshold: boolean;
  barBase: number;
  barHeight: number;
}

function CashTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CashWaterfallDatum }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="rounded-xl border border-border bg-background p-3 shadow-lg">
      <div className="text-sm font-semibold">{point.month}</div>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div>Opening Cash: {formatLakhs(point.openingCash, 1)}</div>
        <div>Net Cash Flow: {formatLakhs(point.netCashFlow, 1)}</div>
        <div className="font-medium text-foreground">Closing Cash: {formatLakhs(point.closingCash, 1)}</div>
      </div>
    </div>
  );
}

export function CashWaterfallChart({
  data,
  minimumCashThreshold,
}: {
  data: CashWaterfallDatum[];
  minimumCashThreshold: number;
}) {
  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => formatLakhs(value, 0)}
          />
          <Tooltip content={<CashTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.4)' }} />
          <ReferenceLine
            y={minimumCashThreshold}
            stroke="#dc2626"
            strokeDasharray="6 6"
            label={{ value: 'Min cash threshold', position: 'top', fill: '#dc2626', fontSize: 11 }}
          />
          <Bar dataKey="barBase" stackId="cash" fill="transparent" />
          <Bar dataKey="barHeight" stackId="cash" radius={[12, 12, 12, 12]}>
            {data.map((entry) => (
              <Cell
                key={entry.month}
                fill={entry.belowThreshold ? '#dc2626' : entry.netCashFlow >= 0 ? '#0f766e' : '#c2410c'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
