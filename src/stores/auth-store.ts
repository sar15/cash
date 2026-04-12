import { create } from 'zustand'

interface AuthState {
  currentCompanyId: string | null
  setCurrentCompanyId: (id: string | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  currentCompanyId: null,
  setCurrentCompanyId: (id) => set({ currentCompanyId: id }),
}))
