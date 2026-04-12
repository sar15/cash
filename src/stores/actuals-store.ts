/**
 * Historical Actuals Store — API-Backed
 *
 * Fetches and manages historical monthly actuals from /api/historical.
 * Replaces workspace-store's localStorage-based historicalValues arrays.
 */
import { create } from 'zustand'
import { apiGet, apiPatch } from '@/lib/api/client'

export interface MonthlyActual {
  id: string
  accountId: string
  period: string // YYYY-MM-01
  amount: number // paise
}

interface ActualsState {
  actuals: MonthlyActual[]
  historicalMonths: string[] // sorted unique periods
  isLoading: boolean
  error: string | null

  // Derived
  getActualsForAccount: (accountId: string) => MonthlyActual[]
  getHistoricalValues: (accountId: string) => number[] // paise array matching historicalMonths order

  // Actions
  load: (companyId: string) => Promise<void>
  bulkUpsert: (companyId: string, actuals: Array<{ accountId: string; period: string; amount: number }>) => Promise<void>
}

export const useActualsStore = create<ActualsState>((set, get) => ({
  actuals: [],
  historicalMonths: [],
  isLoading: false,
  error: null,

  getActualsForAccount: (accountId) =>
    get().actuals.filter((a) => a.accountId === accountId),

  getHistoricalValues: (accountId) => {
    const { actuals, historicalMonths } = get()
    const accountActuals = actuals.filter((a) => a.accountId === accountId)
    return historicalMonths.map((period) => {
      const match = accountActuals.find((a) => a.period === period)
      return match?.amount ?? 0
    })
  },

  load: async (companyId) => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiGet<{ actuals?: MonthlyActual[]; periods?: string[] }>(
        `/api/historical?companyId=${companyId}`
      )
      const actuals = data.actuals ?? []
      const periods = data.periods ?? Array.from(new Set(actuals.map((actual) => actual.period)))

      set({
        actuals,
        historicalMonths: periods.sort(),
        isLoading: false,
      })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load actuals',
        isLoading: false,
      })
    }
  },

  bulkUpsert: async (companyId, newActuals) => {
    await apiPatch('/api/historical', {
      companyId,
      actuals: newActuals,
    })
    // Reload to get DB-canonical data
    await get().load(companyId)
  },
}))
