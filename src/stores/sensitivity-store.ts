/**
 * Sensitivity Store — global what-if modifiers applied to the live forecast.
 *
 * These are client-side only — no API calls, instant recalculation.
 * The engine applies them as multipliers on top of the baseline forecast.
 */
import { create } from 'zustand'

export interface SensitivityModifiers {
  /** Revenue multiplier offset: -50 to +50 (percent). 0 = no change. */
  revenueAdjPct: number
  /** Expense multiplier offset: -50 to +50 (percent). 0 = no change. */
  expenseAdjPct: number
  /** Extra days added to AR collection cycle: -30 to +30. 0 = no change. */
  arDelayDays: number
}

const DEFAULT: SensitivityModifiers = {
  revenueAdjPct: 0,
  expenseAdjPct: 0,
  arDelayDays: 0,
}

interface SensitivityState extends SensitivityModifiers {
  isActive: boolean
  set: (modifiers: Partial<SensitivityModifiers>) => void
  reset: () => void
}

export const useSensitivityStore = create<SensitivityState>((set) => ({
  ...DEFAULT,
  isActive: false,

  set: (modifiers) =>
    set((state) => {
      const next = { ...state, ...modifiers }
      const isActive =
        next.revenueAdjPct !== 0 || next.expenseAdjPct !== 0 || next.arDelayDays !== 0
      return { ...next, isActive }
    }),

  reset: () => set({ ...DEFAULT, isActive: false }),
}))
