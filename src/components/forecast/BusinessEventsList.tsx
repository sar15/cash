'use client'

import { useEffect } from 'react'
import { useMicroForecastStore, type MicroForecastItem } from '@/stores/micro-forecast-store'
import { cn } from '@/lib/utils'
import {
  UserPlus, TrendingUp, Package, Landmark,
  ToggleLeft, ToggleRight, Trash2, Loader2,
  Receipt, TrendingDown, Plus,
} from 'lucide-react'
import { formatAuto } from '@/lib/utils/indian-format'

const typeConfig: Record<string, {
  icon: typeof UserPlus
  color: string
  bg: string
  border: string
  label: string
}> = {
  hire:         { icon: UserPlus,     color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]', border: 'border-[#BFDBFE]', label: 'Hire' },
  revenue:      { icon: TrendingUp,   color: 'text-[#059669]', bg: 'bg-[#ECFDF5]', border: 'border-[#A7F3D0]', label: 'Revenue' },
  asset:        { icon: Package,      color: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]', label: 'Asset' },
  loan:         { icon: Landmark,     color: 'text-[#0D9488]', bg: 'bg-[#F0FDFA]', border: 'border-[#CCFBF1]', label: 'Loan' },
  expense:      { icon: Receipt,      color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]', label: 'Expense' },
  price_change: { icon: TrendingDown, color: 'text-[#0891B2]', bg: 'bg-[#ECFEFF]', border: 'border-[#A5F3FC]', label: 'Price' },
}

// Inline chip for the forecast bottom bar
function EventChip({ item }: { item: MicroForecastItem }) {
  const toggleActive = useMicroForecastStore((s) => s.toggleActive)
  const removeItem = useMicroForecastStore((s) => s.removeItem)
  const cfg = typeConfig[item.type] ?? typeConfig.revenue
  const Icon = cfg.icon

  return (
    <div className={cn(
      'group flex items-center gap-1.5 rounded-md border pl-2 pr-1 py-1 text-[11px] font-medium transition-colors',
      item.isActive
        ? `${cfg.bg} ${cfg.border} ${cfg.color}`
        : 'border-[#E2E8F0] bg-white text-[#94A3B8]'
    )}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="max-w-[100px] truncate">{item.name}</span>
      <span className="text-[9px] opacity-60">· {item.startMonth}</span>

      {/* Controls — always visible */}
      <div className="ml-1 flex items-center gap-0.5">
        <button
          onClick={() => toggleActive(item.id)}
          title={item.isActive ? 'Deactivate' : 'Activate'}
          className="rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
        >
          {item.isActive
            ? <ToggleRight className="h-3.5 w-3.5" />
            : <ToggleLeft className="h-3.5 w-3.5" />
          }
        </button>
        <button
          onClick={() => removeItem(item.id)}
          title="Delete event"
          className="rounded p-0.5 opacity-40 hover:opacity-100 hover:text-[#DC2626] transition-all"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// Full card for sidebar/panel view
function EventCard({ item }: { item: MicroForecastItem }) {
  const toggleActive = useMicroForecastStore((s) => s.toggleActive)
  const removeItem = useMicroForecastStore((s) => s.removeItem)
  const cfg = typeConfig[item.type] ?? typeConfig.revenue
  const Icon = cfg.icon

  const totalPlImpact = item.microForecast.lines.reduce(
    (sum, line) => sum + line.plImpacts.reduce((s, v) => s + v, 0), 0
  )
  const totalCashImpact = item.microForecast.lines.reduce(
    (sum, line) => sum + line.cashImpacts.reduce((s, v) => s + v, 0), 0
  )

  return (
    <div className={cn(
      'rounded-lg border p-3 transition-all',
      item.isActive ? 'border-[#E2E8F0] bg-white' : 'border-[#E2E8F0] bg-[#F8FAFC] opacity-60'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border', cfg.bg, cfg.border)}>
            <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#0F172A]">{item.name}</p>
            <p className="text-[10px] text-[#94A3B8]">{cfg.label} · from {item.startMonth}</p>
          </div>
        </div>

        {/* Action buttons — always visible */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => toggleActive(item.id)}
            title={item.isActive ? 'Deactivate' : 'Activate'}
            className="rounded-md border border-[#E2E8F0] p-1 text-[#94A3B8] hover:border-[#CBD5E1] hover:text-[#0F172A] transition-colors"
          >
            {item.isActive
              ? <ToggleRight className="h-3.5 w-3.5 text-[#059669]" />
              : <ToggleLeft className="h-3.5 w-3.5" />
            }
          </button>
          <button
            onClick={() => removeItem(item.id)}
            title="Delete event"
            className="rounded-md border border-[#E2E8F0] p-1 text-[#94A3B8] hover:border-[#FECACA] hover:text-[#DC2626] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {item.isActive && (totalCashImpact !== 0 || totalPlImpact !== 0) && (
        <div className="mt-2 flex items-center gap-3 border-t border-[#F1F5F9] pt-2">
          {totalPlImpact !== 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#94A3B8]">P&L</span>
              <span className={cn('font-num text-[11px] font-semibold', totalPlImpact > 0 ? 'text-[#059669]' : 'text-[#DC2626]')}>
                {totalPlImpact > 0 ? '+' : ''}{formatAuto(totalPlImpact)}
              </span>
            </div>
          )}
          {totalCashImpact !== 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#94A3B8]">Cash</span>
              <span className={cn('font-num text-[11px] font-semibold', totalCashImpact > 0 ? 'text-[#059669]' : 'text-[#DC2626]')}>
                {totalCashImpact > 0 ? '+' : ''}{formatAuto(totalCashImpact)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function BusinessEventsList({ companyId, inline }: { companyId: string; inline?: boolean }) {
  const items = useMicroForecastStore((s) => s.items)
  const isLoading = useMicroForecastStore((s) => s.isLoading)
  const loadItems = useMicroForecastStore((s) => s.loadItems)

  useEffect(() => {
    void loadItems(companyId)
  }, [companyId, loadItems])

  if (isLoading) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-[#94A3B8]" />
  }

  // Inline mode — horizontal chip strip for forecast bottom bar
  if (inline) {
    if (items.length === 0) {
      return (
        <span className="text-[11px] text-[#94A3B8]">
          No events — click <strong>Add Event</strong> to model hires, loans, new clients
        </span>
      )
    }
    return (
      <div className="flex items-center gap-1.5">
        {items.map(item => <EventChip key={item.id} item={item} />)}
      </div>
    )
  }

  // Full card list
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-5 text-center">
        <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F5F9]">
          <Plus className="h-4 w-4 text-[#94A3B8]" />
        </div>
        <p className="text-xs font-medium text-[#475569]">No business events yet</p>
        <p className="mt-0.5 text-[11px] text-[#94A3B8]">
          Click &ldquo;Add Event&rdquo; to model hires, loans, new clients.
        </p>
      </div>
    )
  }

  const activeCount = items.filter(i => i.isActive).length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
          Events ({items.length})
        </p>
        {activeCount < items.length && (
          <p className="text-[11px] text-[#94A3B8]">{activeCount} active</p>
        )}
      </div>
      {items.map(item => <EventCard key={item.id} item={item} />)}
    </div>
  )
}
