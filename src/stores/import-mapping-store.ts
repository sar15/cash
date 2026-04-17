import { create } from 'zustand'

export interface RowOverride {
  standardAccountId: string | null
  skipped: boolean
}

interface ImportMappingState {
  // keyed by rawLedgerName
  overrides: Record<string, RowOverride>
  selectedRows: Set<string>

  setOverride: (rawLedgerName: string, override: RowOverride) => void
  setBulkOverride: (rawLedgerNames: string[], override: RowOverride) => void
  toggleRowSelection: (rawLedgerName: string) => void
  selectAll: (rawLedgerNames: string[]) => void
  clearSelection: () => void
  reset: () => void
}

export const useImportMappingStore = create<ImportMappingState>((set) => ({
  overrides: {},
  selectedRows: new Set(),

  setOverride: (rawLedgerName, override) =>
    set((state) => ({
      overrides: { ...state.overrides, [rawLedgerName]: override },
    })),

  setBulkOverride: (rawLedgerNames, override) =>
    set((state) => {
      const next = { ...state.overrides }
      for (const name of rawLedgerNames) {
        next[name] = override
      }
      return { overrides: next, selectedRows: new Set() }
    }),

  toggleRowSelection: (rawLedgerName) =>
    set((state) => {
      const next = new Set(state.selectedRows)
      if (next.has(rawLedgerName)) {
        next.delete(rawLedgerName)
      } else {
        next.add(rawLedgerName)
      }
      return { selectedRows: next }
    }),

  selectAll: (rawLedgerNames) =>
    set(() => ({ selectedRows: new Set(rawLedgerNames) })),

  clearSelection: () => set(() => ({ selectedRows: new Set() })),

  reset: () => set(() => ({ overrides: {}, selectedRows: new Set() })),
}))
