/**
 * Formula Store — localStorage-backed
 *
 * Custom KPI formulas are stored per company in localStorage.
 * No DB migration needed — formulas reference account IDs from the engine.
 */
import { create } from 'zustand'
import type { CustomFormula } from '@/lib/engine/formula-evaluator'

interface FormulaState {
  formulas: CustomFormula[]
  load: (companyId: string) => void
  add: (formula: Omit<CustomFormula, 'id'>) => CustomFormula
  update: (id: string, updates: Partial<CustomFormula>) => void
  remove: (id: string) => void
}

function storageKey(companyId: string) {
  return `cashflowiq_formulas_${companyId}`
}

function loadFromStorage(companyId: string): CustomFormula[] {
  try {
    const raw = localStorage.getItem(storageKey(companyId))
    return raw ? (JSON.parse(raw) as CustomFormula[]) : []
  } catch {
    return []
  }
}

function saveToStorage(companyId: string, formulas: CustomFormula[]) {
  try {
    localStorage.setItem(storageKey(companyId), JSON.stringify(formulas))
  } catch { /* ignore */ }
}

export const useFormulaStore = create<FormulaState>((set, get) => ({
  formulas: [],

  load: (companyId) => {
    set({ formulas: loadFromStorage(companyId) })
  },

  add: (formula) => {
    const newFormula: CustomFormula = { ...formula, id: crypto.randomUUID() }
    const formulas = [...get().formulas, newFormula]
    set({ formulas })
    saveToStorage(formula.companyId, formulas)
    return newFormula
  },

  update: (id, updates) => {
    const formulas = get().formulas.map(f => f.id === id ? { ...f, ...updates } : f)
    set({ formulas })
    const companyId = get().formulas.find(f => f.id === id)?.companyId
    if (companyId) saveToStorage(companyId, formulas)
  },

  remove: (id) => {
    const companyId = get().formulas.find(f => f.id === id)?.companyId
    const formulas = get().formulas.filter(f => f.id !== id)
    set({ formulas })
    if (companyId) saveToStorage(companyId, formulas)
  },
}))
