import type { AnyTimingProfileConfig } from '../timing-profiles/types';

export interface BaselineAdjustmentOverride {
  accountId: string;
  adjustmentPct: number;
}

export interface TimingProfileOverride {
  accountId: string;
  profile: AnyTimingProfileConfig;
}

export interface MicroForecastToggleOverride {
  microForecastId: string;
  isActive: boolean;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description?: string;
  baselineAdjustments: BaselineAdjustmentOverride[];
  timingProfileOverrides: TimingProfileOverride[];
  microForecastToggles: MicroForecastToggleOverride[];
}
