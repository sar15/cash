/**
 * Accounts Store — API-Backed
 *
 * Fetches Chart of Accounts from /api/coa.
 * Replaces the old workspace-store accounts array.
 */
import { create } from 'zustand'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client'

export interface Account {
  id: string
  companyId: string
  code?: string | null
  name: string
  parentId?: string | null
  level: number
  accountType: 'revenue' | 'expense' | 'asset' | 'liability' | 'equity'
  standardMapping?: string | null
  isGroup: boolean
  sortOrder: number
}

interface AccountsResponse {
  accounts?: Account[]
}

interface AccountResponse {
  account?: Account
}

interface AccountsState {
  accounts: Account[]
  isLoading: boolean
  error: string | null

  // Filtered views
  revenueAccounts: () => Account[]
  cogsAccounts: () => Account[]
  expenseAccounts: () => Account[]
  assetAccounts: () => Account[]
  liabilityAccounts: () => Account[]
  equityAccounts: () => Account[]

  // Actions
  load: (companyId: string) => Promise<void>
  create: (companyId: string, data: Partial<Account>) => Promise<Account>
  update: (companyId: string, accountId: string, data: Partial<Account>) => Promise<void>
  remove: (companyId: string, accountId: string) => Promise<void>
}

const filterByType = (accounts: Account[], type: Account['accountType']) =>
  accounts.filter((a) => a.accountType === type).sort((a, b) => a.sortOrder - b.sortOrder)

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,

  revenueAccounts: () => filterByType(get().accounts, 'revenue'),
  cogsAccounts: () =>
    get().accounts.filter(
      (a) => a.accountType === 'expense' && (a.standardMapping?.startsWith('cogs') ?? false)
    ),
  expenseAccounts: () =>
    get().accounts.filter(
      (a) =>
        a.accountType === 'expense' &&
        !(a.standardMapping?.startsWith('cogs') ?? false)
    ),
  assetAccounts: () => filterByType(get().accounts, 'asset'),
  liabilityAccounts: () => filterByType(get().accounts, 'liability'),
  equityAccounts: () => filterByType(get().accounts, 'equity'),

  load: async (companyId) => {
    set({ isLoading: true, error: null })
    try {
      const response = await apiGet<Account[] | AccountsResponse>(`/api/coa?companyId=${companyId}`)
      const accounts = Array.isArray(response) ? response : (response.accounts ?? [])
      set({
        accounts: [...accounts].sort((a, b) => a.sortOrder - b.sortOrder),
        isLoading: false,
      })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load accounts',
        isLoading: false,
      })
    }
  },

  create: async (companyId, data) => {
    const response = await apiPost<Account | AccountResponse>(`/api/coa/${companyId}`, data)
    const account = 'account' in (response as AccountResponse)
      ? (response as AccountResponse).account
      : (response as Account)

    if (!account) {
      throw new Error('Account creation returned no account payload')
    }

    set((s) => ({ accounts: [...s.accounts, account] }))
    return account
  },

  update: async (companyId, accountId, data) => {
    // Optimistic update — apply immediately, roll back on failure
    const previous = get().accounts
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, ...data } : a)),
    }))

    try {
      const response = await apiPatch<Account | AccountResponse>(
        `/api/coa/${companyId}/${accountId}`,
        data
      )
      const updated = 'account' in (response as AccountResponse)
        ? (response as AccountResponse).account
        : (response as Account)

      if (!updated) {
        throw new Error('Account update returned no account payload')
      }

      set((s) => ({
        accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, ...updated } : a)),
      }))
    } catch (err) {
      // Roll back to previous state
      set({ accounts: previous })
      throw err
    }
  },

  remove: async (companyId, accountId) => {
    // Optimistic remove — apply immediately, roll back on failure
    const previous = get().accounts
    set((s) => ({
      accounts: s.accounts.filter((a) => a.id !== accountId),
    }))

    try {
      await apiDelete(`/api/coa/${companyId}/${accountId}`)
    } catch (err) {
      set({ accounts: previous })
      throw err
    }
  },
}))
