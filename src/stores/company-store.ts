/**
 * Company Store — API-Backed
 *
 * Manages the active company context. All other stores depend on this.
 * NO localStorage — always fetches from /api/companies.
 */
import { create } from 'zustand'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client'

export interface Company {
  id: string
  clerkUserId: string
  name: string
  pan?: string | null
  gstin?: string | null
  industry: string
  fyStartMonth: number
  currency: string
  numberFormat: string
  logoUrl?: string | null
  createdAt?: string
  updatedAt?: string
}

interface CompanyListResponse {
  companies?: Company[]
}

interface CompanyItemResponse {
  company?: Company
}

interface CompanyState {
  // Data
  companies: Company[]
  activeCompanyId: string | null
  isLoading: boolean
  error: string | null

  // Computed
  activeCompany: () => Company | null
  isCA: () => boolean // CA = manages multiple companies

  // Actions
  loadCompanies: () => Promise<void>
  setActiveCompany: (id: string) => void
  createCompany: (input: Partial<Company>) => Promise<Company>
  updateCompany: (id: string, input: Partial<Company>) => Promise<void>
  deleteCompany: (id: string) => Promise<void>
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: [],
  activeCompanyId: null,
  isLoading: false,
  error: null,

  activeCompany: () => {
    const { companies, activeCompanyId } = get()
    return companies.find((c) => c.id === activeCompanyId) ?? null
  },

  isCA: () => get().companies.length > 1,

  loadCompanies: async () => {
    if (get().isLoading) return
    set({ isLoading: true, error: null })
    try {
      const response = await apiGet<Company[] | CompanyListResponse>('/api/companies')
      const companies = Array.isArray(response) ? response : (response.companies ?? [])
      const currentActive = get().activeCompanyId
      const activeId =
        companies.find((c) => c.id === currentActive)?.id ??
        companies[0]?.id ??
        null
      set({ companies, activeCompanyId: activeId, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load companies',
        isLoading: false,
      })
    }
  },

  setActiveCompany: (id) => set({ activeCompanyId: id }),

  createCompany: async (input) => {
    const response = await apiPost<Company | CompanyItemResponse>('/api/companies', input)
    const company = 'company' in (response as CompanyItemResponse)
      ? (response as CompanyItemResponse).company
      : (response as Company)

    if (!company) {
      throw new Error('Company creation returned no company payload')
    }

    set((s) => ({
      companies: [...s.companies, company],
      activeCompanyId: s.activeCompanyId ?? company.id,
    }))
    return company
  },

  updateCompany: async (id, input) => {
    const response = await apiPatch<Company | CompanyItemResponse>(`/api/companies/${id}`, input)
    const updated = 'company' in (response as CompanyItemResponse)
      ? (response as CompanyItemResponse).company
      : (response as Company)

    if (!updated) {
      throw new Error('Company update returned no company payload')
    }

    set((s) => ({
      companies: s.companies.map((c) => (c.id === id ? { ...c, ...updated } : c)),
    }))
  },

  deleteCompany: async (id) => {
    await apiDelete(`/api/companies/${id}`)
    set((s) => {
      const remaining = s.companies.filter((c) => c.id !== id)
      return {
        companies: remaining,
        activeCompanyId:
          s.activeCompanyId === id
            ? remaining[0]?.id ?? null
            : s.activeCompanyId,
      }
    })
  },
}))
