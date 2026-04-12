'use client'

import { cn } from '@/lib/utils'

export type ViewType = 'pl' | 'bs' | 'cf'

interface ViewSwitcherProps {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
}

const views: { id: ViewType; label: string; shortLabel: string }[] = [
  { id: 'pl', label: 'Profit & Loss', shortLabel: 'P&L' },
  { id: 'bs', label: 'Balance Sheet', shortLabel: 'BS' },
  { id: 'cf', label: 'Cash Flow', shortLabel: 'CF' },
]

export function ViewSwitcher({ activeView, onViewChange }: ViewSwitcherProps) {
  return (
    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1">
      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => onViewChange(view.id)}
          className={cn(
            'relative rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
            activeView === view.id
              ? 'bg-emerald-500 text-slate-950 shadow-[0_2px_8px_rgba(16,185,129,0.3)]'
              : 'text-slate-400 hover:bg-white/8 hover:text-white'
          )}
        >
          <span className="hidden sm:inline">{view.label}</span>
          <span className="sm:hidden">{view.shortLabel}</span>
        </button>
      ))}
    </div>
  )
}
