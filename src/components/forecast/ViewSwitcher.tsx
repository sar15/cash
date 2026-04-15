'use client'

import { cn } from '@/lib/utils'

export type ViewType = 'pl' | 'bs' | 'cf' | 'drivers' | 'variance'

interface ViewSwitcherProps {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
}

const views: { id: ViewType; label: string; shortLabel: string }[] = [
  { id: 'pl',       label: 'Profit & Loss',  shortLabel: 'P&L' },
  { id: 'bs',       label: 'Balance Sheet',  shortLabel: 'BS' },
  { id: 'cf',       label: 'Cash Flow',      shortLabel: 'CF' },
  { id: 'drivers',  label: 'Drivers',        shortLabel: 'Dr' },
  { id: 'variance', label: 'Variance',       shortLabel: 'Var' },
]

export function ViewSwitcher({ activeView, onViewChange }: ViewSwitcherProps) {
  return (
    <div className="flex items-center gap-0 border-b border-transparent">
      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => onViewChange(view.id)}
          className={cn(
            'relative px-4 py-2 text-sm font-medium transition-colors duration-150',
            activeView === view.id
              ? 'text-[#0F172A] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#059669]'
              : 'text-[#64748B] hover:text-[#0F172A]'
          )}
        >
          <span className="hidden sm:inline">{view.label}</span>
          <span className="sm:hidden">{view.shortLabel}</span>
        </button>
      ))}
    </div>
  )
}
