/**
 * Shared workspace configuration types.
 * Extracted here to break the dependency on workspace-store in non-store modules.
 */

import type { AnyTimingProfileConfig } from '@/lib/engine/timing-profiles/types'
import type { AnyValueRuleConfig } from '@/lib/engine/value-rules/types'

export interface WorkspaceComplianceConfig {
  gstRatePct: number
  inputTaxCreditPct: number
  tdsRegime: 'new'
  advanceTaxRatePct: number
}

export interface WorkspaceQuickMetricThresholds {
  minimumCashThreshold: number
  receivablesAlertThreshold: number
}

export interface WorkspaceConfigurationFile {
  valueRules: Record<string, AnyValueRuleConfig>
  timingProfiles: Record<string, AnyTimingProfileConfig>
  complianceConfig: WorkspaceComplianceConfig
  quickMetricThresholds: WorkspaceQuickMetricThresholds
  microForecasts: Array<{
    type: 'revenue' | 'hire' | 'asset' | 'loan'
    wizardInputs: Record<string, unknown>
    isActive: boolean
  }>
}
