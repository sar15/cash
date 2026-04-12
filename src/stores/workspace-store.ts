'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  demoTimingProfiles as defaultTimingProfiles,
  demoValueRules as defaultValueRules,
  forecastMonths as defaultForecastMonths,
  generateDemoData,
  historicalMonths as defaultHistoricalMonths,
  type AccountData,
} from '@/lib/demo-data';
import type { AnyTimingProfileConfig } from '@/lib/engine/timing-profiles/types';
import type { AnyValueRuleConfig } from '@/lib/engine/value-rules/types';

const LAKH_IN_PAISE = 10_000_000;

export interface CompanyProfile {
  name: string;
  industry: 'manufacturing' | 'trading' | 'services' | 'startup';
  fyStartMonth: number;
}

export interface WorkspaceQuickMetricThresholds {
  minimumCashThreshold: number;
  receivablesAlertThreshold: number;
}

export interface WorkspaceComplianceConfig {
  gstRatePct: number;
  inputTaxCreditPct: number;
  tdsRegime: 'new';
  advanceTaxRatePct: number;
}

export interface WorkspaceConfigurationFile {
  valueRules: Record<string, AnyValueRuleConfig>;
  timingProfiles: Record<string, AnyTimingProfileConfig>;
  complianceConfig: WorkspaceComplianceConfig;
  quickMetricThresholds: WorkspaceQuickMetricThresholds;
  microForecasts: Array<{
    type: 'revenue' | 'hire' | 'asset' | 'loan';
    wizardInputs: Record<string, unknown>;
    isActive: boolean;
  }>;
}

type SetupMode = 'none' | 'demo' | 'imported' | 'manual';

interface WorkspaceState {
  hasHydrated: boolean;
  setupMode: SetupMode;
  ready: boolean;
  companyProfile: CompanyProfile;
  reportNotes: string;
  logoDataUrl: string | null;
  accounts: AccountData[];
  historicalMonths: string[];
  forecastMonths: string[];
  valueRules: Record<string, AnyValueRuleConfig>;
  timingProfiles: Record<string, AnyTimingProfileConfig>;
  quickMetricThresholds: WorkspaceQuickMetricThresholds;
  complianceConfig: WorkspaceComplianceConfig;
  setHasHydrated: (value: boolean) => void;
  setCompanyProfile: (profile: Partial<CompanyProfile>) => void;
  setReportNotes: (notes: string) => void;
  setLogoDataUrl: (value: string | null) => void;
  setValueRule: (accountId: string, rule: AnyValueRuleConfig) => void;
  replaceTimingProfiles: (profiles: Record<string, AnyTimingProfileConfig>) => void;
  replaceValueRules: (rules: Record<string, AnyValueRuleConfig>) => void;
  setQuickMetricThresholds: (thresholds: Partial<WorkspaceQuickMetricThresholds>) => void;
  setComplianceConfig: (config: Partial<WorkspaceComplianceConfig>) => void;
  completeDemoSetup: (profile?: Partial<CompanyProfile>) => void;
  completeManualSetup: (profile?: Partial<CompanyProfile>) => void;
  completeImportedSetup: (input: {
    profile?: Partial<CompanyProfile>;
    accounts: AccountData[];
    historicalMonths: string[];
  }) => void;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildBlankAccounts(): AccountData[] {
  return generateDemoData().map((account) => ({
    ...account,
    historicalValues: account.historicalValues.map(() => 0),
  }));
}

function getDefaultCompanyProfile(): CompanyProfile {
  return {
    name: 'Patel Engineering Works',
    industry: 'manufacturing',
    fyStartMonth: 4,
  };
}

function getDefaultValueRules() {
  return clone(defaultValueRules);
}

function getDefaultTimingProfiles() {
  return clone(defaultTimingProfiles);
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      setupMode: 'none',
      ready: false,
      companyProfile: getDefaultCompanyProfile(),
      reportNotes: '',
      logoDataUrl: null,
      accounts: generateDemoData(),
      historicalMonths: [...defaultHistoricalMonths],
      forecastMonths: [...defaultForecastMonths],
      valueRules: getDefaultValueRules(),
      timingProfiles: getDefaultTimingProfiles(),
      quickMetricThresholds: {
        minimumCashThreshold: 5 * LAKH_IN_PAISE,
        receivablesAlertThreshold: 50 * LAKH_IN_PAISE,
      },
      complianceConfig: {
        gstRatePct: 18,
        inputTaxCreditPct: 85,
        tdsRegime: 'new',
        advanceTaxRatePct: 25,
      },
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setCompanyProfile: (profile) =>
        set((state) => ({
          companyProfile: {
            ...state.companyProfile,
            ...profile,
          },
        })),
      setReportNotes: (reportNotes) => set({ reportNotes }),
      setLogoDataUrl: (logoDataUrl) => set({ logoDataUrl }),
      setValueRule: (accountId, rule) =>
        set((state) => ({
          valueRules: {
            ...state.valueRules,
            [accountId]: clone(rule),
          },
        })),
      replaceTimingProfiles: (timingProfiles) => set({ timingProfiles: clone(timingProfiles) }),
      replaceValueRules: (valueRules) => set({ valueRules: clone(valueRules) }),
      setQuickMetricThresholds: (thresholds) =>
        set((state) => ({
          quickMetricThresholds: {
            ...state.quickMetricThresholds,
            ...thresholds,
          },
        })),
      setComplianceConfig: (config) =>
        set((state) => ({
          complianceConfig: {
            ...state.complianceConfig,
            ...config,
          },
        })),
      completeDemoSetup: (profile) =>
        set((state) => ({
          setupMode: 'demo',
          ready: true,
          companyProfile: {
            ...state.companyProfile,
            ...profile,
          },
          accounts: generateDemoData(),
          historicalMonths: [...defaultHistoricalMonths],
          forecastMonths: [...defaultForecastMonths],
        })),
      completeManualSetup: (profile) =>
        set((state) => ({
          setupMode: 'manual',
          ready: true,
          companyProfile: {
            ...state.companyProfile,
            ...profile,
          },
          accounts: buildBlankAccounts(),
          historicalMonths: [...defaultHistoricalMonths],
          forecastMonths: [...defaultForecastMonths],
          valueRules: getDefaultValueRules(),
          timingProfiles: getDefaultTimingProfiles(),
        })),
      completeImportedSetup: ({ profile, accounts, historicalMonths }) =>
        set((state) => ({
          setupMode: 'imported',
          ready: true,
          companyProfile: {
            ...state.companyProfile,
            ...profile,
          },
          accounts: clone(accounts),
          historicalMonths: [...historicalMonths],
          forecastMonths: [...defaultForecastMonths],
          valueRules: getDefaultValueRules(),
          timingProfiles: getDefaultTimingProfiles(),
        })),
    }),
    {
      name: 'cashflowiq-workspace',
      partialize: (state) => ({
        setupMode: state.setupMode,
        ready: state.ready,
        companyProfile: state.companyProfile,
        reportNotes: state.reportNotes,
        logoDataUrl: state.logoDataUrl,
        accounts: state.accounts,
        historicalMonths: state.historicalMonths,
        forecastMonths: state.forecastMonths,
        valueRules: state.valueRules,
        timingProfiles: state.timingProfiles,
        quickMetricThresholds: state.quickMetricThresholds,
        complianceConfig: state.complianceConfig,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
