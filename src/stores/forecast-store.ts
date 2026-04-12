import { create } from 'zustand'

type StatementView = 'pl' | 'bs' | 'cf'

interface ForecastState {
  activeView: StatementView
  setActiveView: (view: StatementView) => void

  selectedScenarioId: string | null
  setSelectedScenarioId: (id: string | null) => void

  isSidebarOpen: boolean
  toggleSidebar: () => void

  isEngineRunning: boolean
  setIsEngineRunning: (running: boolean) => void

  engineVersion: number
  bumpEngineVersion: () => void
}

export const useForecastStore = create<ForecastState>((set) => ({
  activeView: 'pl',
  setActiveView: (view) => set({ activeView: view }),

  selectedScenarioId: null,
  setSelectedScenarioId: (id) => set({ selectedScenarioId: id }),

  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  isEngineRunning: false,
  setIsEngineRunning: (running) => set({ isEngineRunning: running }),

  engineVersion: 0,
  bumpEngineVersion: () => set((state) => ({ engineVersion: state.engineVersion + 1 })),
}))
