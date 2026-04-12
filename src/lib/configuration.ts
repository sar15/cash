import { z } from 'zod';

import type { AnyTimingProfileConfig } from '@/lib/engine/timing-profiles/types';
import type { AnyValueRuleConfig } from '@/lib/engine/value-rules/types';
import type { WorkspaceConfigurationFile } from '@/stores/workspace-store';

const microForecastSnapshotSchema = z.object({
  type: z.enum(['revenue', 'hire', 'asset', 'loan']),
  wizardInputs: z.record(z.string(), z.unknown()),
  isActive: z.boolean(),
});

const workspaceConfigurationSchema = z.object({
  valueRules: z.record(z.string(), z.unknown()),
  timingProfiles: z.record(z.string(), z.unknown()),
  complianceConfig: z.object({
    gstRatePct: z.number(),
    inputTaxCreditPct: z.number(),
    tdsRegime: z.enum(['new']),
    advanceTaxRatePct: z.number(),
  }),
  quickMetricThresholds: z.object({
    minimumCashThreshold: z.number(),
    receivablesAlertThreshold: z.number(),
  }),
  microForecasts: z.array(microForecastSnapshotSchema),
});

const exportConfigurationSchema = workspaceConfigurationSchema.extend({
  app: z.literal('CashFlowIQ'),
  version: z.literal(1),
  exportedAt: z.string(),
  companyName: z.string().optional(),
});

type ConfigurationAliases = {
  value_rules?: unknown;
  timing_profiles?: unknown;
  compliance_config?: unknown;
  quick_metric_thresholds?: unknown;
  micro_forecasts?: unknown;
};

export type ExportConfigurationFile = z.infer<typeof exportConfigurationSchema> & ConfigurationAliases;

function normalizeConfigurationAliases(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }

  const record = raw as Record<string, unknown> & ConfigurationAliases;

  return {
    ...record,
    valueRules: record.valueRules ?? record.value_rules,
    timingProfiles: record.timingProfiles ?? record.timing_profiles,
    complianceConfig: record.complianceConfig ?? record.compliance_config,
    quickMetricThresholds: record.quickMetricThresholds ?? record.quick_metric_thresholds,
    microForecasts: record.microForecasts ?? record.micro_forecasts,
  };
}

export function buildConfigurationFile(
  companyName: string,
  config: WorkspaceConfigurationFile
): ExportConfigurationFile {
  return {
    app: 'CashFlowIQ',
    version: 1,
    exportedAt: new Date().toISOString(),
    companyName,
    ...config,
    value_rules: config.valueRules,
    timing_profiles: config.timingProfiles,
    compliance_config: config.complianceConfig,
    quick_metric_thresholds: config.quickMetricThresholds,
    micro_forecasts: config.microForecasts,
  };
}

export function parseConfigurationFile(raw: string): WorkspaceConfigurationFile {
  const parsed = exportConfigurationSchema.safeParse(
    normalizeConfigurationAliases(JSON.parse(raw))
  );

  if (!parsed.success) {
    // FIX audit1: Include specific field errors instead of generic message
    const fieldErrors = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration file: ${fieldErrors}`);
  }

  const {
    complianceConfig,
    microForecasts,
    quickMetricThresholds,
    timingProfiles,
    valueRules,
  } = parsed.data;

  return {
    valueRules: valueRules as Record<string, AnyValueRuleConfig>,
    timingProfiles: timingProfiles as Record<string, AnyTimingProfileConfig>,
    complianceConfig,
    quickMetricThresholds,
    microForecasts,
  };
}

export function getConfigurationFilename(companyName: string): string {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return `${slug || 'cashflowiq'}-configuration.json`;
}
