/**
 * Forecast Config Store — API-Backed
 *
 * Loads value rules, timing profiles, compliance config, and quick metrics
 * from /api/forecast/config. Replaces workspace-store's localStorage approach.
 */
import { create } from 'zustand'
import { apiGet, apiPatch } from '@/lib/api/client'
import type { AnyValueRuleConfig } from '@/lib/engine/value-rules/types'
import type { AnyTimingProfileConfig } from '@/lib/engine/timing-profiles/types'

export interface ComplianceConfig {
  gstType: 'regular' | 'qrmp'
  supplyType: 'intra-state' | 'inter-state'
  gstRate: number
  itcPct: number
  gstFrequency: 'monthly' | 'quarterly'
  tdsRegime: 'new' | 'old'
  tdsSections: Record<string, unknown>
  taxRate: number
  pfApplicable: boolean
  esiApplicable: boolean
}

export interface QuickMetricsConfig {
  metric1: string
  metric2: string
  metric3: string
  metric4: string
  metric5: string
  threshold: Record<string, unknown>
}

interface ForecastConfigState {
  valueRules: Record<string, AnyValueRuleConfig>
  timingProfiles: Record<string, AnyTimingProfileConfig>
  complianceConfig: ComplianceConfig | null
  quickMetrics: QuickMetricsConfig | null
  isLoading: boolean
  error: string | null
  revision: number

  // Actions
  load: (companyId: string) => Promise<void>
  updateValueRule: (companyId: string, accountId: string, rule: AnyValueRuleConfig) => Promise<void>
  updateTimingProfile: (companyId: string, profileId: string, config: AnyTimingProfileConfig) => Promise<void>
  updateCompliance: (companyId: string, config: Partial<ComplianceConfig>) => Promise<void>
  updateQuickMetrics: (companyId: string, config: Partial<QuickMetricsConfig>) => Promise<void>
}

interface RawValueRule {
  accountId: string
  ruleType: AnyValueRuleConfig['type']
  config?: string | Record<string, unknown> | null
}

interface RawTimingProfile {
  id: string
  profileType: AnyTimingProfileConfig['type']
  config?: string | Record<string, unknown> | null
}

function parseJsonRecord(value: string | Record<string, unknown> | null | undefined) {
  if (!value) return {}
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return {}
  }
}

function normalizeValueRules(valueRules: RawValueRule[] | Record<string, AnyValueRuleConfig> | null | undefined) {
  if (!valueRules) return {}
  if (!Array.isArray(valueRules)) return valueRules

  return valueRules.reduce<Record<string, AnyValueRuleConfig>>((acc, rule) => {
    acc[rule.accountId] = {
      accountId: rule.accountId,
      type: rule.ruleType,
      ...parseJsonRecord(rule.config),
    } as AnyValueRuleConfig
    return acc
  }, {})
}

function normalizeTimingProfiles(
  timingProfiles: RawTimingProfile[] | Record<string, AnyTimingProfileConfig> | null | undefined
) {
  if (!timingProfiles) return {}
  if (!Array.isArray(timingProfiles)) return timingProfiles

  return timingProfiles.reduce<Record<string, AnyTimingProfileConfig>>((acc, profile) => {
    const parsedConfig = parseJsonRecord(profile.config)
    const accountId =
      typeof parsedConfig.accountId === 'string' ? parsedConfig.accountId : profile.id

    acc[accountId] = {
      accountId,
      type: profile.profileType,
      ...parsedConfig,
    } as AnyTimingProfileConfig
    return acc
  }, {})
}

// Default compliance for new companies
const DEFAULT_COMPLIANCE: ComplianceConfig = {
  gstType: 'regular',
  supplyType: 'intra-state',
  gstRate: 18,
  itcPct: 85,
  gstFrequency: 'monthly',
  tdsRegime: 'new',
  tdsSections: {},
  taxRate: 25.17,
  pfApplicable: true,
  esiApplicable: true,
}

export const useForecastConfigStore = create<ForecastConfigState>((set, get) => ({
  valueRules: {},
  timingProfiles: {},
  complianceConfig: null,
  quickMetrics: null,
  isLoading: false,
  error: null,
  revision: 0,

  load: async (companyId) => {
    if (get().isLoading) return
    set({ isLoading: true, error: null })
    try {
      const config = await apiGet<{
        valueRules?: RawValueRule[] | Record<string, AnyValueRuleConfig>
        timingProfiles?: RawTimingProfile[] | Record<string, AnyTimingProfileConfig>
        complianceConfig: ComplianceConfig | null
        quickMetrics?: QuickMetricsConfig | null
        quickMetricsConfig?: QuickMetricsConfig | null
      }>(`/api/forecast/config?companyId=${companyId}`)

      set((s) => ({
        valueRules: normalizeValueRules(config.valueRules),
        timingProfiles: normalizeTimingProfiles(config.timingProfiles),
        complianceConfig: config.complianceConfig ?? DEFAULT_COMPLIANCE,
        quickMetrics: config.quickMetricsConfig ?? config.quickMetrics ?? null,
        isLoading: false,
        revision: s.revision + 1,
      }))
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load config',
        isLoading: false,
      })
    }
  },

  updateValueRule: async (companyId, accountId, rule) => {
    // Optimistic update
    const previousRules = get().valueRules
    set((s) => ({
      valueRules: { ...s.valueRules, [accountId]: rule },
      revision: s.revision + 1,
    }))

    try {
      const ruleConfig = Object.fromEntries(
        Object.entries(rule).filter(([key]) => key !== 'type' && key !== 'accountId')
      )
      await apiPatch('/api/forecast/config/value-rule', {
        companyId,
        accountId,
        ruleType: rule.type,
        config: ruleConfig,
      })
    } catch (err) {
      set({ valueRules: previousRules })
      throw err
    }
  },

  updateTimingProfile: async (companyId, profileId, config) => {
    // Optimistic update
    const previousProfiles = get().timingProfiles
    set((s) => ({
      timingProfiles: { ...s.timingProfiles, [profileId]: config },
      revision: s.revision + 1,
    }))

    try {
      await apiPatch('/api/forecast/config/timing-profile', {
        companyId,
        profileId,
        name: profileId,
        profileType: config.type,
        config,
        autoDerived: false,
        isDefault: false,
      })
    } catch (err) {
      set({ timingProfiles: previousProfiles })
      throw err
    }
  },

  updateCompliance: async (companyId, config) => {
    // Optimistic update
    const previousCompliance = get().complianceConfig
    set((s) => ({
      complianceConfig: s.complianceConfig
        ? { ...s.complianceConfig, ...config }
        : { ...DEFAULT_COMPLIANCE, ...config },
      revision: s.revision + 1,
    }))

    try {
      await apiPatch('/api/forecast/config/compliance', {
        companyId,
        ...config,
      })
    } catch (err) {
      set({ complianceConfig: previousCompliance })
      throw err
    }
  },

  updateQuickMetrics: async (companyId, config) => {
    // Optimistic update
    const previousMetrics = get().quickMetrics
    set((s) => ({
      quickMetrics: s.quickMetrics ? { ...s.quickMetrics, ...config } : { ...config } as QuickMetricsConfig,
      revision: s.revision + 1,
    }))

    try {
      await apiPatch('/api/forecast/config/metrics', {
        companyId,
        ...config,
      })
    } catch (err) {
      set({ quickMetrics: previousMetrics })
      throw err
    }
  },
}))
