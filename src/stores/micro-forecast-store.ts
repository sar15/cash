'use client';

import { create } from 'zustand';

import { useCompanyStore } from '@/stores/company-store';
import { MicroForecast, type MicroForecastLine } from '@/lib/engine/micro-forecasts/overlay';
import { generateAssetMicroForecast, type AssetWizardInputs } from '@/lib/engine/micro-forecasts/wizards/asset';
import { generateLoanMicroForecast, type LoanWizardInputs } from '@/lib/engine/micro-forecasts/wizards/loan';
import { generateNewHireMicroForecast, type NewHireWizardInputs } from '@/lib/engine/micro-forecasts/wizards/new-hire';
import { generateRevenueMicroForecast, type RevenueWizardInputs } from '@/lib/engine/micro-forecasts/wizards/revenue';
import { generateOneTimeExpenseMicroForecast, type OneTimeExpenseWizardInputs } from '@/lib/engine/micro-forecasts/wizards/one-time-expense';
import { generatePriceChangeMicroForecast, type PriceChangeWizardInputs } from '@/lib/engine/micro-forecasts/wizards/price-change';
import { buildForecastMonthLabels } from '@/lib/forecast-periods';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client';

export type WizardType = 'revenue' | 'hire' | 'asset' | 'loan' | 'expense' | 'price_change';

/** Build FY-aware forecast month labels (same as use-current-forecast.ts) */
function getForecastMonths(): string[] {
  const company = useCompanyStore.getState().activeCompany();
  return buildForecastMonthLabels({ fyStartMonth: company?.fyStartMonth ?? 4 });
}

type WizardInputs =
  | RevenueWizardInputs
  | NewHireWizardInputs
  | AssetWizardInputs
  | LoanWizardInputs
  | OneTimeExpenseWizardInputs
  | PriceChangeWizardInputs;

interface ApiMicroForecastLine {
  accountId?: string | null;
  futureAccountName?: string | null;
  futureAccountType?: string | null;
  ruleType?: string | null;
  config?: string | Record<string, unknown> | null;
  timingProfileId?: string | null;
}

interface ApiMicroForecastRecord {
  id: string;
  companyId: string;
  name: string;
  category: string;
  isActive: boolean | null;
  startMonth: string;
  endMonth: string | null;
  wizardConfig: string;
  sortOrder: number | null;
  lines: ApiMicroForecastLine[];
}

interface ApiMicroForecastListResponse {
  companyId: string;
  forecasts: ApiMicroForecastRecord[];
}

interface ApiMicroForecastCreateResponse {
  companyId: string;
  forecast: ApiMicroForecastRecord;
}

export interface MicroForecastItem {
  id: string;
  name: string;
  type: WizardType;
  isActive: boolean;
  startMonth: string;
  microForecast: MicroForecast;
  wizardInputs: WizardInputs;
}

interface MicroForecastState {
  items: MicroForecastItem[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  revision: number;

  loadItems: (companyId: string, force?: boolean) => Promise<void>;
  addRevenue: (inputs: RevenueWizardInputs) => Promise<void>;
  addHire: (inputs: NewHireWizardInputs) => Promise<void>;
  addAsset: (inputs: AssetWizardInputs) => Promise<void>;
  addLoan: (inputs: LoanWizardInputs) => Promise<void>;
  addExpense: (inputs: OneTimeExpenseWizardInputs) => Promise<void>;
  addPriceChange: (inputs: PriceChangeWizardInputs) => Promise<void>;

  toggleActive: (id: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;

  getActiveMicroForecasts: () => MicroForecast[];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong while syncing business events.';
}

function normalizeWizardType(category: string): WizardType {
  switch (category) {
    case 'hire':
    case 'asset':
    case 'loan':
    case 'revenue':
    case 'expense':
    case 'price_change':
      return category;
    default:
      return 'revenue';
  }
}

function parseWizardConfig<T extends WizardInputs>(raw: string): T {
  return JSON.parse(raw) as T;
}

function buildMicroForecast(type: WizardType, id: string, wizardInputs: WizardInputs): MicroForecast {
  switch (type) {
    case 'hire':
      return generateNewHireMicroForecast(id, wizardInputs as NewHireWizardInputs, getForecastMonths());
    case 'asset':
      return generateAssetMicroForecast(id, wizardInputs as AssetWizardInputs, getForecastMonths());
    case 'loan':
      return generateLoanMicroForecast(id, wizardInputs as LoanWizardInputs, getForecastMonths());
    case 'expense':
      return generateOneTimeExpenseMicroForecast(id, wizardInputs as OneTimeExpenseWizardInputs, getForecastMonths());
    case 'price_change':
      return generatePriceChangeMicroForecast(id, wizardInputs as PriceChangeWizardInputs, getForecastMonths());
    case 'revenue':
    default:
      return generateRevenueMicroForecast(id, wizardInputs as RevenueWizardInputs, getForecastMonths());
  }
}

function buildItemFromRecord(record: ApiMicroForecastRecord): MicroForecastItem {
  // Guard against missing category field
  if (!record.category) {
    console.error('Missing category in micro-forecast record:', record);
    throw new Error(`Micro-forecast record ${record.id} is missing required category field`);
  }

  const type = normalizeWizardType(record.category);
  const wizardInputs = parseWizardConfig<WizardInputs>(record.wizardConfig);
  const microForecast = buildMicroForecast(type, record.id, wizardInputs);
  microForecast.name = record.name;

  return {
    id: record.id,
    name: record.name,
    type,
    isActive: record.isActive ?? true,
    startMonth: record.startMonth,
    microForecast,
    wizardInputs,
  };
}

function mapFutureAccountType(category: MicroForecastLine['category']) {
  switch (category) {
    case 'Revenue':
      return 'revenue';
    case 'Assets':
      return 'asset';
    case 'Liabilities':
    case 'Debt':
      return 'liability';
    case 'Equity':
      return 'equity';
    case 'COGS':
    case 'Operating Expenses':
    default:
      return 'expense';
  }
}

function serializeItem(item: MicroForecastItem, sortOrder: number) {
  return {
    name: item.name,
    category: item.type,
    isActive: item.isActive,
    startMonth: item.startMonth,
    endMonth: null,
    wizardConfig: item.wizardInputs,
    sortOrder,
    lines: item.microForecast.lines.map((line, index) => ({
      futureAccountName: `${item.name} ${index + 1}`,
      futureAccountType: mapFutureAccountType(line.category),
      ruleType: 'direct_entry',
      config: {
        category: line.category,
        plImpacts: line.plImpacts,
        cashImpacts: line.cashImpacts,
      },
    })),
  };
}

function createDraftItem<T extends WizardInputs>(type: WizardType, inputs: T): MicroForecastItem {
  const id = crypto.randomUUID();
  const microForecast = buildMicroForecast(type, id, inputs);

  const startMonth =
    'startMonth' in inputs && typeof inputs.startMonth === 'string'
      ? inputs.startMonth
      : 'purchaseMonth' in inputs && typeof (inputs as AssetWizardInputs).purchaseMonth === 'string'
        ? (inputs as AssetWizardInputs).purchaseMonth
        : 'month' in inputs && typeof (inputs as OneTimeExpenseWizardInputs).month === 'string'
          ? (inputs as OneTimeExpenseWizardInputs).month
          : getForecastMonths()[0]

  return {
    id,
    name: microForecast.name,
    type,
    isActive: true,
    startMonth,
    microForecast,
    wizardInputs: inputs,
  };
}

async function persistItem(item: MicroForecastItem, sortOrder: number) {
  const companyId = useCompanyStore.getState().activeCompanyId
  const payload = {
    companyId,
    ...serializeItem(item, sortOrder),
  };
  
  console.log('[persistItem] Sending payload:', payload);
  
  const result = await apiPost<ApiMicroForecastCreateResponse>('/api/micro-forecasts', payload);
  
  console.log('[persistItem] Received result:', result);
  
  if (!result.forecast) {
    throw new Error('API response missing forecast object');
  }
  
  if (!result.forecast.category) {
    console.error('[persistItem] Missing category in response:', result.forecast);
    throw new Error('API response missing required category field');
  }

  return result.forecast;
}

export const useMicroForecastStore = create<MicroForecastState>((set, get) => ({
  items: [],
  isLoading: false,
  hasLoaded: false,
  error: null,
  revision: 0,

  loadItems: async (companyId, force = false) => {
    if (get().isLoading || (get().hasLoaded && !force)) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const result = await apiGet<ApiMicroForecastListResponse>(`/api/micro-forecasts?companyId=${companyId}`);

      set({
        items: result.forecasts.map(buildItemFromRecord),
        isLoading: false,
        hasLoaded: true,
        error: null,
        revision: get().revision + 1,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error),
      });
      throw error;
    }
  },

  addRevenue: async (inputs) => {
    set({ error: null });
    const saved = await persistItem(createDraftItem('revenue', inputs), get().items.length);
    set((state) => ({
      items: [...state.items, buildItemFromRecord(saved)],
      hasLoaded: true,
      revision: state.revision + 1,
    }));
  },

  addHire: async (inputs) => {
    set({ error: null });
    const saved = await persistItem(createDraftItem('hire', inputs), get().items.length);
    set((state) => ({
      items: [...state.items, buildItemFromRecord(saved)],
      hasLoaded: true,
      revision: state.revision + 1,
    }));
  },

  addAsset: async (inputs) => {
    set({ error: null });
    const saved = await persistItem(createDraftItem('asset', inputs), get().items.length);
    set((state) => ({
      items: [...state.items, buildItemFromRecord(saved)],
      hasLoaded: true,
      revision: state.revision + 1,
    }));
  },

  addLoan: async (inputs) => {
    set({ error: null });
    const saved = await persistItem(createDraftItem('loan', inputs), get().items.length);
    set((state) => ({
      items: [...state.items, buildItemFromRecord(saved)],
      hasLoaded: true,
      revision: state.revision + 1,
    }));
  },

  addExpense: async (inputs) => {
    set({ error: null });
    const saved = await persistItem(createDraftItem('expense', inputs), get().items.length);
    set((state) => ({
      items: [...state.items, buildItemFromRecord(saved)],
      hasLoaded: true,
      revision: state.revision + 1,
    }));
  },

  addPriceChange: async (inputs) => {
    set({ error: null });
    const saved = await persistItem(createDraftItem('price_change', inputs), get().items.length);
    set((state) => ({
      items: [...state.items, buildItemFromRecord(saved)],
      hasLoaded: true,
      revision: state.revision + 1,
    }));
  },

  toggleActive: async (id) => {
    const items = get().items;
    const targetIndex = items.findIndex((item) => item.id === id);
    if (targetIndex === -1) {
      return;
    }

    const targetItem = items[targetIndex];
    const nextItem = { ...targetItem, isActive: !targetItem.isActive };

    set((state) => ({
      items: state.items.map((item) => (item.id === id ? nextItem : item)),
      error: null,
      revision: state.revision + 1,
    }));

    try {
      await apiPatch(`/api/micro-forecasts/${id}`, serializeItem(nextItem, targetIndex));
    } catch (error) {
      set({ items, error: getErrorMessage(error) });
      throw error;
    }
  },

  removeItem: async (id) => {
    const items = get().items;

    set({
      items: items.filter((item) => item.id !== id),
      error: null,
      revision: get().revision + 1,
    });

    try {
      await apiDelete(`/api/micro-forecasts/${id}`);
    } catch (error) {
      set({ items, error: getErrorMessage(error) });
      throw error;
    }
  },

  getActiveMicroForecasts: () => get().items.filter((item) => item.isActive).map((item) => item.microForecast),
}));
