import { create } from 'zustand'

import { apiGet, apiPut } from '@/lib/api/client'
import type { UserType } from '@/lib/db/queries/user-profiles'

interface Profile {
  clerkUserId: string
  userType: UserType
  onboardingCompleted?: boolean
}

interface ProfileResponse {
  profile?: Profile | null
}

interface ProfileState {
  profile: Profile | null
  isLoading: boolean
  error: string | null

  load: () => Promise<void>
  setUserType: (userType: UserType) => Promise<void>
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  load: async () => {
    if (get().isLoading) return
    set({ isLoading: true, error: null })
    try {
      const response = await apiGet<ProfileResponse>('/api/profile')
      set({
        profile: (response?.profile as Profile) ?? null,
        isLoading: false,
      })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load profile',
        isLoading: false,
      })
    }
  },

  setUserType: async (userType) => {
    set({ isLoading: true, error: null })
    try {
      const response = await apiPut<ProfileResponse>('/api/profile', { userType })
      set({
        profile: (response?.profile as Profile) ?? null,
        isLoading: false,
      })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to update profile',
        isLoading: false,
      })
      throw err
    }
  },
}))
