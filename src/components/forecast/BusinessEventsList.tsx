'use client'

import { useEffect } from 'react'
import { useMicroForecastStore, type MicroForecastItem } from '@/stores/micro-forecast-store'
import { cn } from '@/lib/utils'
import {
  UserPlus,
  TrendingUp,
  Package,
  Landmark,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Loader2,
} from 'lucide-react'

const typeIcons = {
  hire: UserPlus,
  revenue: TrendingUp,
  asset: Package,
  loan: Landmark,
}

const typeColors = {
  hire: 'text-blue-400',
  revenue: 'text-emerald-400',
  asset: 'text-amber-400',
  loan: 'text-purple-400',
}

function EventCard({ item }: { item: MicroForecastItem }) {
  const toggleActive = useMicroForecastStore((s) => s.toggleActive)
  const removeItem = useMicroForecastStore((s) => s.removeItem)
  const Icon = typeIcons[item.type]

  return (
    <div
      className={cn(
        'group rounded-2xl border p-4 transition-all',
        item.isActive
          ? 'border-white/10 bg-white/5'
          : 'border-white/5 bg-slate-950/50 opacity-55'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5">
          <div className="rounded-xl border border-white/8 bg-slate-950/60 p-2">
            <Icon className={cn('h-4 w-4 shrink-0', typeColors[item.type])} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{item.name}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{item.type} • {item.startMonth}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => toggleActive(item.id)}
            className="rounded p-1 text-slate-400 hover:text-white"
            title={item.isActive ? 'Deactivate' : 'Activate'}
          >
            {item.isActive ? (
              <ToggleRight className="h-4 w-4 text-emerald-400" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => removeItem(item.id)}
            className="rounded p-1 text-slate-400 hover:text-red-400"
            title="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function BusinessEventsList({ companyId }: { companyId: string }) {
  const items = useMicroForecastStore((s) => s.items)
  const isLoading = useMicroForecastStore((s) => s.isLoading)
  const loadItems = useMicroForecastStore((s) => s.loadItems)

  useEffect(() => {
    void loadItems(companyId)
  }, [companyId, loadItems])

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center">
        <p className="text-xs text-slate-500">
          No business events yet. Click &quot;Add Event&quot; to model what-if scenarios.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
        Business Events ({items.length})
      </h3>
      {items.map((item) => (
        <EventCard key={item.id} item={item} />
      ))}
    </div>
  )
}
