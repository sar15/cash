'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STANDARD_INDIAN_COA, type StandardIndianAccount } from '@/lib/standards/indian-coa'

// ─── Pure helper — exported for testing ──────────────────────────────────────

/**
 * Filter COA options by query string, matching against name and aliases.
 * Feature: account-mapping-ui, Property 10: COA filter completeness
 */
export function filterCoaOptions(
  query: string,
  accounts: StandardIndianAccount[]
): StandardIndianAccount[] {
  if (!query.trim()) return accounts
  const q = query.toLowerCase()
  return accounts.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.aliases.some((alias) => alias.toLowerCase().includes(q))
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

interface CoaComboboxProps {
  value: string | null        // standardAccountId or null
  skipped: boolean
  onChange: (value: string | null, skipped: boolean) => void
  highlightNeeded: boolean    // amber ring when true
  disabled?: boolean
}

const CATEGORIES = ['Revenue', 'COGS', 'Operating Expenses', 'Assets', 'Liabilities', 'Equity'] as const

export function CoaCombobox({ value, skipped, onChange, highlightNeeded, disabled }: CoaComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const ref = React.useRef<HTMLDivElement>(null)

  const selectedAccount = value ? STANDARD_INDIAN_COA.find((a) => a.id === value) : null
  const filtered = filterCoaOptions(query, STANDARD_INDIAN_COA)

  // Group filtered results by category
  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    accounts: filtered.filter((a) => a.category === cat),
  })).filter((g) => g.accounts.length > 0)

  // Close on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const displayLabel = skipped
    ? 'Skip (exclude from forecast)'
    : selectedAccount
    ? `${selectedAccount.name}`
    : 'Select category...'

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between rounded-md border bg-white px-3 py-1.5 text-sm transition-colors',
          'hover:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20',
          highlightNeeded && !value && !skipped
            ? 'border-[#F59E0B] ring-2 ring-[#F59E0B]/20'
            : 'border-[#E2E8F0]',
          skipped && 'text-[#94A3B8] line-through',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-[#E2E8F0] bg-white shadow-lg">
          {/* Search */}
          <div className="border-b border-[#E2E8F0] p-2">
            <input
              autoFocus
              type="text"
              placeholder="Search accounts..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded border border-[#E2E8F0] px-2 py-1 text-sm focus:border-[#2563EB] focus:outline-none"
            />
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {/* Skip option — always first */}
            <button
              type="button"
              onClick={() => { onChange(null, true); setOpen(false); setQuery('') }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[#94A3B8] hover:bg-[#F8FAFC]',
                skipped && 'bg-[#F8FAFC] font-medium text-[#475569]'
              )}
            >
              <Ban className="h-3.5 w-3.5 shrink-0" />
              <span>Skip (exclude from forecast)</span>
              {skipped && <Check className="ml-auto h-3.5 w-3.5 text-[#059669]" />}
            </button>

            <div className="my-1 border-t border-[#E2E8F0]" />

            {/* Grouped COA options */}
            {grouped.length === 0 && (
              <p className="px-3 py-2 text-xs text-[#94A3B8]">No accounts match.</p>
            )}
            {grouped.map((group) => (
              <div key={group.category}>
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">
                  {group.category}
                </p>
                {group.accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => { onChange(account.id, false); setOpen(false); setQuery('') }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-[#F8FAFC]',
                      value === account.id && !skipped
                        ? 'bg-[#EFF6FF] text-[#2563EB]'
                        : 'text-[#334155]'
                    )}
                  >
                    <span className="flex-1 truncate text-left">{account.name}</span>
                    {value === account.id && !skipped && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
