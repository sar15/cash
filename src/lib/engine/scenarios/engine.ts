/**
 * Scenario Forecast Engine
 *
 * REFACTORED: No mutable global imports.
 * Receives all data through explicit parameters.
 */
import { runForecastEngine, type ForecastEngineOptions, type ForecastMicroForecastItem, type AccountInput } from '..'
import type { AnyTimingProfileConfig } from '../timing-profiles/types'
import type { ScenarioDefinition } from './types'

interface ScenarioEngineOptions {
  // REQUIRED: explicit data
  accounts: AccountInput[]
  forecastMonthLabels: string[]

  // Scenario
  scenario?: ScenarioDefinition | null

  // Config
  microForecastItems?: ForecastMicroForecastItem[]
  valueRules?: ForecastEngineOptions['valueRules']
  timingProfiles?: ForecastEngineOptions['timingProfiles']
  complianceConfig?: ForecastEngineOptions['complianceConfig']
  openingBalances?: ForecastEngineOptions['openingBalances']
}

function cloneTimingProfiles(
  source: Record<string, AnyTimingProfileConfig>
): Record<string, AnyTimingProfileConfig> {
  // FIX audit3 S3: structuredClone preserves undefined values, unlike JSON.parse/stringify
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, structuredClone(value)])
  ) as Record<string, AnyTimingProfileConfig>
}

function buildBaselineAdjustments(
  scenario: ScenarioDefinition | null | undefined
): Record<string, number> {
  if (!scenario) return {}
  return Object.fromEntries(
    scenario.baselineAdjustments.map((override) => [override.accountId, override.adjustmentPct])
  )
}

function applyTimingOverrides(
  source: Record<string, AnyTimingProfileConfig>,
  scenario: ScenarioDefinition | null | undefined
): Record<string, AnyTimingProfileConfig> {
  const timingProfiles = cloneTimingProfiles(source)

  scenario?.timingProfileOverrides.forEach((override) => {
    timingProfiles[override.accountId] = structuredClone(override.profile) as AnyTimingProfileConfig
  })

  return timingProfiles
}

function applyMicroForecastToggles(
  microForecastItems: ForecastMicroForecastItem[],
  scenario: ScenarioDefinition | null | undefined
): ForecastMicroForecastItem[] {
  if (!scenario) return microForecastItems

  const toggleById = new Map(
    scenario.microForecastToggles.map((toggle) => [toggle.microForecastId, toggle.isActive])
  )

  return microForecastItems.map((item) => ({
    ...item,
    isActive: toggleById.has(item.id) ? toggleById.get(item.id) ?? false : item.isActive,
  }))
}

export function runScenarioForecastEngine({
  accounts,
  forecastMonthLabels,
  scenario = null,
  microForecastItems = [],
  valueRules = {},
  timingProfiles = {},
  complianceConfig,
  openingBalances,
}: ScenarioEngineOptions) {
  const options: ForecastEngineOptions = {
    accounts,
    forecastMonthLabels,
    valueRules,
    baselineAdjustments: buildBaselineAdjustments(scenario),
    timingProfiles: applyTimingOverrides(timingProfiles, scenario),
    microForecastItems: applyMicroForecastToggles(microForecastItems, scenario),
    complianceConfig,
    openingBalances,
  }

  return runForecastEngine(options)
}
