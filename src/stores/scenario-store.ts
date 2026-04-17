/**
 * Scenario Store — API-Backed (replaces localStorage persist)
 *
 * Full CRUD via /api/scenarios. Supports baseline + named scenarios
 * with per-account % overrides.
 */
import { create } from 'zustand'
import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from '@/lib/api/client'

export interface ScenarioAdjustment {
  accountId: string
  adjustmentPct: number
}

export interface ScenarioOverride {
  id?: string
  targetType: 'value_rule' | 'timing_profile' | 'micro_toggle'
  targetId?: string | null
  config: Record<string, unknown>
}

export interface Scenario {
  id: string
  companyId: string
  name: string
  description?: string | null
  isActive?: boolean | null
  overrides: ScenarioOverride[]
  createdAt?: string
}

interface ScenarioState {
  scenarios: Scenario[]
  selectedScenarioId: string | null
  isLoading: boolean
  error: string | null
  revision: number

  // Computed
  selectedScenario: () => Scenario | null

  // Actions
  load: (companyId: string) => Promise<void>
  create: (companyId: string, data: { name: string; description?: string }) => Promise<Scenario>
  update: (id: string, data: Partial<Scenario>) => Promise<void>
  remove: (id: string) => Promise<void>
  select: (id: string | null) => void
  saveOverrides: (scenarioId: string, overrides: ScenarioAdjustment[]) => Promise<void>
}

function parseOverrideConfig(value: unknown) {
  if (!value) return {}
  if (typeof value !== 'string') return value as Record<string, unknown>

  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return {}
  }
}

function normalizeScenario(raw: Partial<Scenario> & {
  overrides?: Array<ScenarioOverride & { config?: unknown }>
}) {
  return {
    id: raw.id ?? crypto.randomUUID(),
    companyId: raw.companyId ?? '',
    name: raw.name ?? 'Scenario',
    description: raw.description ?? null,
    isActive: raw.isActive ?? true,
    createdAt: raw.createdAt,
    overrides: (raw.overrides ?? []).map((override) => ({
      id: override.id,
      targetType: override.targetType,
      targetId: override.targetId ?? null,
      config: parseOverrideConfig(override.config),
    })),
  } satisfies Scenario
}

export function getScenarioAdjustments(scenario: Scenario | null) {
  if (!scenario) return []

  return scenario.overrides
    .filter((override) => override.targetType === 'value_rule' && typeof override.targetId === 'string')
    .map((override) => ({
      accountId: override.targetId as string,
      adjustmentPct:
        typeof override.config.adjustmentPct === 'number'
          ? override.config.adjustmentPct
          : 0,
    }))
    .filter((override) => override.adjustmentPct !== 0)
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  scenarios: [],
  selectedScenarioId: null,
  isLoading: false,
  error: null,
  revision: 0,

  selectedScenario: () => {
    const { scenarios, selectedScenarioId } = get()
    return scenarios.find((s) => s.id === selectedScenarioId) ?? null
  },

  load: async (companyId) => {
    if (get().isLoading) return
    set({ isLoading: true, error: null })
    try {
      const res = await apiGet<Scenario[] | { scenarios: Scenario[] }>(`/api/scenarios?companyId=${companyId}`)
      const rawScenarios = Array.isArray(res) ? res : (res.scenarios ?? [])
      const scenarios = rawScenarios.map((scenario) => normalizeScenario(scenario))
      const selectedScenarioId = scenarios.some((scenario) => scenario.id === get().selectedScenarioId)
        ? get().selectedScenarioId
        : null

      set((s) => ({ scenarios, selectedScenarioId, isLoading: false, revision: s.revision + 1 }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load scenarios', isLoading: false })
    }
  },

  create: async (companyId, data) => {
    const response = await apiPost<Scenario | { scenario?: Scenario }>('/api/scenarios', { companyId, ...data })
    const scenario = normalizeScenario(
      'scenario' in (response as { scenario?: Scenario })
        ? (response as { scenario?: Scenario }).scenario ?? {}
        : (response as Scenario)
    )

    set((s) => ({ scenarios: [...s.scenarios, scenario], revision: s.revision + 1 }))
    return scenario
  },

  update: async (id, data) => {
    const response = await apiPatch<Scenario | { scenario?: Scenario }>(`/api/scenarios/${id}`, data)
    const updated = normalizeScenario(
      'scenario' in (response as { scenario?: Scenario })
        ? (response as { scenario?: Scenario }).scenario ?? {}
        : (response as Scenario)
    )

    set((s) => ({
      scenarios: s.scenarios.map((sc) => (sc.id === id ? { ...sc, ...updated } : sc)),
      revision: s.revision + 1,
    }))
  },

  remove: async (id) => {
    await apiDelete(`/api/scenarios/${id}`)
    set((s) => ({
      scenarios: s.scenarios.filter((sc) => sc.id !== id),
      selectedScenarioId: s.selectedScenarioId === id ? null : s.selectedScenarioId,
      revision: s.revision + 1,
    }))
  },

  select: (id) => set({ selectedScenarioId: id }),

  saveOverrides: async (scenarioId, overrides) => {
    const payload = overrides.map((override) => ({
      targetType: 'value_rule' as const,
      targetId: override.accountId,
      config: { adjustmentPct: override.adjustmentPct },
    }))

    const response = await apiPut<{ overrides?: ScenarioOverride[] }>(
      `/api/scenarios/${scenarioId}`,
      { overrides: payload }
    )
    const savedOverrides = (response.overrides ?? payload).map((override) => ({
      ...override,
      config: parseOverrideConfig(override.config),
    }))

    set((s) => ({
      scenarios: s.scenarios.map((sc) =>
        sc.id === scenarioId ? { ...sc, overrides: savedOverrides } : sc
      ),
      revision: s.revision + 1,
    }))
  },
}))
