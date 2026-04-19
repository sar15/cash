'use client'

import { cn } from '@/lib/utils'

export type ViewType = 'pl' | 'bs' | 'cf' | 'drivers' | 'variance' | 'annual'

interface ViewSwitcherProps {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
}

const views: { id: ViewType; label: string; description: string }[] = [
  { id: 'pl',       label: 'P&L',           description: 'Profit & Loss Statement' },
  { id: 'bs',       label: 'Balance Sheet',  description: 'Assets, Liabilities & Equity' },
  { id: 'cf',       label: 'Cash Flow',      description: 'Cash Flow Statement (Indirect)' },
  { id: 'drivers',  label: 'KPI Drivers',    description: 'Margins, ratios & efficiency metrics' },
  { id: 'variance', label: 'Variance',       description: 'Actuals vs Forecast' },
  { id: 'annual',   label: 'Annual',         description: 'Full-year Schedule III statements' },
]

export function ViewSwitcher({ activeView, onViewChange }: ViewSwitcherProps) {
  return (
    <div className="flex items-center">
      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => onViewChange(view.id)}
          title={view.description}
          className={cn(
            'relative px-3.5 py-2 text-sm font-medium transition-colors duration-100',
            'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:transition-all',
            activeView === view.id
              ? 'text-[#0F172A] after:bg-[#0F172A]'
              : 'text-[#94A3B8] hover:text-[#475569] after:bg-transparent'
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  )
}
