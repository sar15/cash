'use client'

import React, { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CoaCombobox } from './CoaCombobox'
import { useImportMappingStore, type RowOverride } from '@/stores/import-mapping-store'
import type { ServerAccountMatchType } from '@/lib/import/server-account-mapper'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MappingPreviewRow {
  rowIndex: number
  accountName: string
  mappedAccountId: string | null
  mappedAccountName: string | null
  matchType: ServerAccountMatchType
  confidence: number
}

// ─── Pure helpers — exported for testing ─────────────────────────────────────

/**
 * Returns true if any row needs human review.
 * Feature: account-mapping-ui, Property 9: needsReview correctness
 */
export function needsReview(rows: MappingPreviewRow[]): boolean {
  return rows.some((r) => r.matchType === 'unmapped' || r.confidence < 0.6)
}

/**
 * Returns true when all flagged rows have been resolved.
 * Feature: account-mapping-ui, Property 8: canProceed correctness
 */
export function canProceed(
  rows: MappingPreviewRow[],
  overrides: Record<string, RowOverride>
): boolean {
  const flagged = rows.filter((r) => r.matchType === 'unmapped' || r.confidence < 0.6)
  return flagged.every((r) => {
    const override = overrides[r.accountName]
    return override !== undefined && (override.skipped || override.standardAccountId !== null)
  })
}

// ─── Match type badge ─────────────────────────────────────────────────────────

const MATCH_BADGE: Record<ServerAccountMatchType, { label: string; color: string }> = {
  exact:   { label: 'Exact',   color: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]' },
  alias:   { label: 'Alias',   color: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]' },
  keyword: { label: 'Keyword', color: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]' },
  fuzzy:   { label: 'Fuzzy',   color: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]' },
  saved:   { label: 'Saved',   color: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]' },
  unmapped:{ label: 'Unmapped',color: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]' },
  skipped: { label: 'Skipped', color: 'bg-[#F8FAFC] text-[#94A3B8] border-[#E2E8F0]' },
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AccountMappingReviewProps {
  rows: MappingPreviewRow[]
  companyId: string
  /** Called after mappings saved + import triggered */
  onSaveAndImport: (
    mappings: Array<{ rawLedgerName: string; standardAccountId: string | null; skipped: boolean }>
  ) => Promise<void>
  onCancel?: () => void
}

export function AccountMappingReview({
  rows,
  companyId,
  onSaveAndImport,
  onCancel,
}: AccountMappingReviewProps) {
  const { overrides, selectedRows, setOverride, setBulkOverride, toggleRowSelection, selectAll, clearSelection } =
    useImportMappingStore()

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const reviewNeeded = useMemo(() => needsReview(rows), [rows])
  const flaggedRows = useMemo(
    () => rows.filter((r) => r.matchType === 'unmapped' || r.confidence < 0.6),
    [rows]
  )
  const proceed = useMemo(() => canProceed(rows, overrides), [rows, overrides])

  const selectedArray = Array.from(selectedRows)

  // ── "Looks good" state ────────────────────────────────────────────────────
  if (!reviewNeeded) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-[#059669]" />
        <p className="text-sm font-semibold text-[#065F46]">Looks good — no review needed</p>
        <p className="text-xs text-[#059669]">
          All {rows.length} accounts were confidently mapped. You can proceed to import.
        </p>
        <button
          onClick={() => onSaveAndImport([])}
          className="mt-2 rounded-lg bg-[#059669] px-4 py-2 text-sm font-semibold text-white hover:bg-[#047857]"
        >
          Import Data
        </button>
      </div>
    )
  }

  // ── Review screen ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Summary banner */}
      <div className="flex items-center gap-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[#D97706]" />
        <p className="text-sm font-medium text-[#92400E]">
          {flaggedRows.length} row{flaggedRows.length !== 1 ? 's' : ''} need review before importing
        </p>
      </div>

      {/* Bulk action bar */}
      {selectedArray.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <span className="text-sm font-medium text-[#334155]">
            {selectedArray.length} selected
          </span>
          <div className="flex-1">
            <CoaCombobox
              value={null}
              skipped={false}
              highlightNeeded={false}
              onChange={(accountId, skipped) => {
                setBulkOverride(selectedArray, { standardAccountId: accountId, skipped })
              }}
            />
          </div>
          <button
            onClick={clearSelection}
            className="text-xs text-[#94A3B8] hover:text-[#475569]"
          >
            Clear
          </button>
        </div>
      )}

      {/* Mapping table */}
      <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedRows.size === rows.length && rows.length > 0}
                  onChange={(e) =>
                    e.target.checked
                      ? selectAll(rows.map((r) => r.accountName))
                      : clearSelection()
                  }
                  className="rounded border-[#E2E8F0]"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                Ledger Name (from file)
              </th>
              <th className="w-24 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                Match
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                Map to Standard Account
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const override = overrides[row.accountName]
              const currentAccountId = override?.standardAccountId ?? row.mappedAccountId
              const currentSkipped = override?.skipped ?? false
              const isFlagged = row.matchType === 'unmapped' || row.confidence < 0.6
              const isSelected = selectedRows.has(row.accountName)
              const badge = MATCH_BADGE[row.matchType] ?? MATCH_BADGE.unmapped

              return (
                <tr
                  key={row.accountName}
                  className={cn(
                    'border-b border-[#E2E8F0] last:border-0',
                    isFlagged && !override ? 'bg-[#FFFBEB]' : 'bg-white',
                    isSelected && 'bg-[#EFF6FF]'
                  )}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRowSelection(row.accountName)}
                      className="rounded border-[#E2E8F0]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'font-medium text-[#0F172A]',
                        currentSkipped && 'text-[#94A3B8] line-through'
                      )}
                    >
                      {row.accountName}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
                        badge.color
                      )}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <CoaCombobox
                      value={currentAccountId}
                      skipped={currentSkipped}
                      highlightNeeded={isFlagged && !override}
                      onChange={(accountId, skipped) =>
                        setOverride(row.accountName, { standardAccountId: accountId, skipped })
                      }
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#DC2626]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Action footer */}
      <div className="flex items-center justify-between">
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-sm text-[#94A3B8] hover:text-[#475569]"
          >
            Cancel
          </button>
        )}
        <button
          disabled={!proceed || saving}
          onClick={async () => {
            setSaving(true)
            setError(null)
            try {
              // Collect all user-assigned overrides
              const mappingsPayload = Object.entries(overrides).map(([rawLedgerName, o]) => ({
                rawLedgerName,
                standardAccountId: o.standardAccountId,
                skipped: o.skipped,
              }))

              // Save mappings first
              const res = await fetch('/api/import/mappings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId, mappings: mappingsPayload }),
              })

              if (!res.ok) {
                const data = await res.json().catch(() => ({})) as { error?: string }
                throw new Error(data.error ?? 'Failed to save mappings. Please try again.')
              }

              // Proceed to import
              await onSaveAndImport(mappingsPayload)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
            } finally {
              setSaving(false)
            }
          }}
          className={cn(
            'ml-auto flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors',
            proceed && !saving
              ? 'bg-[#059669] hover:bg-[#047857]'
              : 'cursor-not-allowed bg-[#94A3B8]'
          )}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save & Import'}
        </button>
      </div>

      {!proceed && (
        <p className="text-center text-xs text-[#94A3B8]">
          Assign or skip all highlighted rows to enable import.
        </p>
      )}
    </div>
  )
}
