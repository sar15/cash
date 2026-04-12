Now I have the complete picture. Here is the detailed analysis for each file.

---

## 1. `src/lib/workspace/runtime.ts` (40 lines)

### Exact Imports
```ts
import { allMonths, demoData, forecastMonths, historicalMonths,
         demoTimingProfiles, demoValueRules, type AccountData } from '@/lib/demo-data';
import { useWorkspaceStore } from '@/stores/workspace-store';
```

### Exact Exports
```ts
export function applyWorkspaceStateToRuntime(state = useWorkspaceStore.getState()): void
```

### Data Flow
- **IN**: Reads the entire workspace store state (accounts, historicalMonths, forecastMonths, valueRules, timingProfiles) via `useWorkspaceStore.getState()`.
- **OUT**: Mutates 5 module-level mutable globals from `demo-data.ts` in-place:
  - `demoData` -- cleared then filled with cloned `state.accounts`
  - `historicalMonths` -- cleared then filled with `state.historicalMonths`
  - `forecastMonths` -- cleared then filled with `state.forecastMonths`
  - `allMonths` -- rebuilt as `historicalMonths + forecastMonths`
  - `demoValueRules` -- replaced via `replaceRecord` (delete all keys, assign cloned source)
  - `demoTimingProfiles` -- replaced via `replaceRecord`

### Dependency on demo-data.ts mutable globals
**CRITICAL**: This is the single bridge that synchronizes the persisted Zustand store into the mutable module-level globals. It directly mutates `demoData`, `historicalMonths`, `forecastMonths`, `allMonths`, `demoValueRules`, `demoTimingProfiles` -- all exported from `demo-data.ts`.

### API vs localStorage
- **Zero API calls**. It reads from the Zustand store (persisted to localStorage under key `cashflowiq-workspace`) and writes to mutable globals.

---

## 2. `src/stores/workspace-store.ts` (229 lines)

### Exact Imports
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { demoTimingProfiles as defaultTimingProfiles,
         demoValueRules as defaultValueRules,
         forecastMonths as defaultForecastMonths,
         generateDemoData,
         historicalMonths as defaultHistoricalMonths,
         type AccountData } from '@/lib/demo-data';
import type { AnyTimingProfileConfig } from '@/lib/engine/timing-profiles/types';
import type { AnyValueRuleConfig } from '@/lib/engine/value-rules/types';
```

### Exact Exports
```ts
export interface CompanyProfile { ... }
export interface WorkspaceQuickMetricThresholds { ... }
export interface WorkspaceComplianceConfig { ... }
export interface WorkspaceConfigurationFile { ... }
export const useWorkspaceStore: UseBoundStore<StoreApi<WorkspaceState>>
```

### Key State Shape
```
WorkspaceState {
  hasHydrated: boolean;
  setupMode: 'none' | 'demo' | 'imported' | 'manual';
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
  // Actions:
  setHasHydrated, setCompanyProfile, setReportNotes, setLogoDataUrl,
  setValueRule, replaceTimingProfiles, replaceValueRules,
  setQuickMetricThresholds, setComplianceConfig,
  completeDemoSetup, completeManualSetup, completeImportedSetup
}
```

### Data Flow
- **IN**: On first load, defaults come from `demo-data.ts` (via `generateDemoData()`, `defaultHistoricalMonths`, `defaultForecastMonths`, `getDefaultValueRules()`, `getDefaultTimingProfiles()`). After hydration, state comes from localStorage.
- **OUT**: The `partialize` config persists 12 fields to localStorage key `cashflowiq-workspace`. The `onRehydrateStorage` callback calls `setHasHydrated(true)` after rehydration completes.

### Dependency on demo-data.ts mutable globals
**MODERATE**: Imports `demoTimingProfiles`, `demoValueRules`, `forecastMonths`, `historicalMonths`, and `generateDemoData` from demo-data, but only uses them as **default/seed values**. These are cloned (via `clone()`) or spread (`[...defaultForecastMonths]`) before storing, so the store does NOT hold references to the mutable globals. However, `completeDemoSetup` and `completeManualSetup` re-seed from these same defaults each time.

### API vs localStorage
- **Pure localStorage** via `zustand/persist`. No API calls.

---

## 3. `src/stores/micro-forecast-store.ts` (345 lines)

### Exact Imports
```ts
import { create } from 'zustand';
import { forecastMonths } from '@/lib/demo-data';
import { MicroForecast, type MicroForecastLine } from '@/lib/engine/micro-forecasts/overlay';
import { generateAssetMicroForecast, type AssetWizardInputs } from '@/lib/engine/micro-forecasts/wizards/asset';
import { generateLoanMicroForecast, type LoanWizardInputs } from '@/lib/engine/micro-forecasts/wizards/loan';
import { generateNewHireMicroForecast, type NewHireWizardInputs } from '@/lib/engine/micro-forecasts/wizards/new-hire';
import { generateRevenueMicroForecast, type RevenueWizardInputs } from '@/lib/engine/micro-forecasts/wizards/revenue';
import { useAuthStore } from '@/stores/auth-store';
```

### Exact Exports
```ts
export type WizardType = 'revenue' | 'hire' | 'asset' | 'loan';
export interface MicroForecastItem { ... }
export const useMicroForecastStore: UseBoundStore<StoreApi<MicroForecastState>>
```

### Key State Shape
```
MicroForecastState {
  items: MicroForecastItem[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  // Actions:
  loadItems(force?: boolean): Promise<void>;
  addRevenue(inputs: RevenueWizardInputs): Promise<void>;
  addHire(inputs: NewHireWizardInputs): Promise<void>;
  addAsset(inputs: AssetWizardInputs): Promise<void>;
  addLoan(inputs: LoanWizardInputs): Promise<void>;
  toggleActive(id: string): Promise<void>;
  removeItem(id: string): Promise<void>;
  getActiveMicroForecasts(): MicroForecast[];
}
```

### Data Flow
- **IN (API)**:
  - `loadItems()` -- GET `/api/micro-forecasts` -- fetches `ApiMicroForecastListResponse`, maps each `ApiMicroForecastRecord` through `buildItemFromRecord()` which calls `buildMicroForecast()` which calls the appropriate wizard generator.
  - `addRevenue/addHire/addAsset/addLoan` -- creates a draft item via `createDraftItem()`, then POSTs via `persistItem()` to `/api/micro-forecasts`, then re-builds from the server response.
  - `toggleActive(id)` -- optimistic update, then PATCH `/api/micro-forecasts/${id}`.
  - `removeItem(id)` -- optimistic delete from local, then DELETE `/api/micro-forecasts/${id}`.
- **OUT**: `getActiveMicroForecasts()` returns `MicroForecast[]` for active items (used by `useCurrentForecast`).
- **Side effect**: `useAuthStore.getState().setCurrentCompanyId(result.companyId)` is called after both `loadItems` and `persistItem` to sync the company ID.

### Dependency on demo-data.ts mutable globals
**HIGH**: `forecastMonths` (the mutable global) is imported and used directly in `buildMicroForecast()` (lines 131-139), which passes it to each wizard generator. It is also used in `createDraftItem()` (line 213) as a fallback `startMonth`. If `applyWorkspaceStateToRuntime()` has not yet run, `forecastMonths` still contains the hardcoded demo values.

### API vs localStorage
- **Primarily API**. All CRUD operations go through `/api/micro-forecasts` (GET, POST, PATCH, DELETE). The store itself is NOT persisted to localStorage (no `persist` middleware). Data is lost on page reload unless `loadItems()` re-fetches from the API.

---

## 4. `src/stores/scenario-store.ts` (45 lines)

### Exact Imports
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScenarioDefinition } from '@/lib/engine/scenarios/types';
```

### Exact Exports
```ts
export const useScenarioStore: UseBoundStore<StoreApi<ScenarioStore>>
```

### Key State Shape
```
ScenarioStore {
  scenarios: ScenarioDefinition[];
  addScenario(scenario: Omit<ScenarioDefinition, 'id'>): string;
  updateScenario(id: string, scenario: Omit<ScenarioDefinition, 'id'>): void;
  deleteScenario(id: string): void;
}
```

### Data Flow
- **IN**: Defaults to empty array. After hydration, comes from localStorage.
- **OUT**: Persisted to localStorage key `cashflowiq-scenarios`. Each action (add/update/delete) writes to localStorage via the persist middleware.

### Dependency on demo-data.ts mutable globals
**NONE**. This store is completely independent of demo-data.

### API vs localStorage
- **Pure localStorage** via `zustand/persist`. No API calls.

---

## 5. `src/hooks/use-current-forecast.ts` (116 lines)

### Exact Imports
```ts
import { useDeferredValue, useEffect, useMemo } from 'react';
import { runScenarioForecastEngine } from '@/lib/engine/scenarios/engine';
import { useForecastStore } from '@/stores/forecast-store';
import { useMicroForecastStore } from '@/stores/micro-forecast-store';
import { useScenarioStore } from '@/stores/scenario-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
```

### Exact Exports
```ts
export function useCurrentForecast(): { ... }
```

### Return Shape
```ts
{
  baselineResult: EngineResult | null;
  accounts: AccountData[];
  companyProfile: CompanyProfile;
  complianceConfig: WorkspaceComplianceConfig;
  engineResult: EngineResult | null;
  hasHydrated: boolean;
  isEngineComputing: boolean;
  items: MicroForecastItem[];
  quickMetricThresholds: WorkspaceQuickMetricThresholds;
  ready: boolean;
  scenarios: ScenarioDefinition[];
  selectedScenario: ScenarioDefinition | null;
  setupMode: SetupMode;
  valueRules: Record<string, AnyValueRuleConfig>;
}
```

### Data Flow
1. Reads from 4 stores: `useMicroForecastStore`, `useForecastStore`, `useScenarioStore`, `useWorkspaceStore`.
2. On mount, calls `loadItems()` to fetch micro-forecasts from API.
3. Uses `useDeferredValue` on 7 inputs to track "is engine computing" state.
4. Computes `baselineResult` via `runScenarioForecastEngine({...})` with `microForecastItems`, `valueRules`, `timingProfiles`, `complianceConfig` (no scenario).
5. If a scenario is selected, computes `engineResult` by calling `runScenarioForecastEngine` again with the scenario applied.
6. The `engineVersion` from `useForecastStore` is a dependency that forces re-computation; it is bumped by `WorkspaceBootstrapper` whenever workspace data changes.

### Dependency on demo-data.ts mutable globals
**INDIRECT**: The hook itself does not import `demo-data`, but it calls `runScenarioForecastEngine` which calls `runForecastEngine` which directly reads `demoData` and `forecastMonths` from the mutable globals. The hook passes `valueRules`, `timingProfiles`, and `complianceConfig` explicitly, but NOT `accounts` or `forecastMonths` -- those are read from the mutable globals inside the engine.

### API vs localStorage
- **No direct API calls** from the hook itself. It delegates to `useMicroForecastStore.loadItems()` (API) and reads from persisted stores (localStorage).

---

## 6. `src/lib/engine/index.ts` (263 lines)

### Exact Imports
```ts
import { demoData, forecastMonths, demoValueRules, demoTimingProfiles } from '../demo-data';
import { buildComplianceForecast, type ComplianceResult } from './compliance';
import { overlayMicroForecast, type MicroForecast } from './micro-forecasts/overlay';
import { applyTimingProfile } from './timing-profiles/calculator';
import type { AnyTimingProfileConfig } from './timing-profiles/types';
import { type MonthlyInput, type OpeningBalances,
         runThreeWayIntegration, type ThreeWayMonth } from './three-way/builder';
import { evaluateDirectEntry } from './value-rules/direct-entry';
import { evaluateGrowth } from './value-rules/growth';
import { evaluateRollingAvg } from './value-rules/rolling-avg';
import { evaluateSameLastYear } from './value-rules/same-last-year';
import type { AnyValueRuleConfig } from './value-rules/types';
```

### Exact Exports
```ts
export interface ForecastMicroForecastItem { ... }
export interface ForecastEngineOptions { ... }
export interface EngineResult { ... }
export function runForecastEngine(options?: ForecastEngineOptions): EngineResult
export function runFullForecastEngine(activeMicroForecasts?: MicroForecast[]): EngineResult
```

### Key Function Signatures
```ts
runForecastEngine({
  valueRules?,           // defaults to cloneRecord(demoValueRules)
  timingProfiles?,       // defaults to cloneRecord(demoTimingProfiles)
  activeMicroForecasts?, // resolved from microForecastItems if not provided
  microForecastItems?,   // filtered by isActive
  baselineAdjustments?,  // defaulted to {}
  complianceConfig?,
} = {}): EngineResult
```

### Data Flow
1. Iterates `demoData` (the mutable global) to build `accountForecasts` for PL accounts (Revenue, COGS, OpEx) using the value rule engine.
2. Iterates `demoData` again to build `cashInflows` / `cashOutflows` by applying timing profiles.
3. Iterates `demoData` a third time to aggregate monthly totals into `MonthlyInput[]`.
4. Overlays micro-forecasts onto monthly inputs.
5. Reads opening cash from `demoData.find(a => a.id === 'ast-1')?.historicalValues.at(-1)`.
6. Runs `runThreeWayIntegration`, `deriveSalaryForecast`, `buildComplianceForecast`.
7. Returns `EngineResult` with `forecastMonths` (the mutable global) embedded directly.

### Dependency on demo-data.ts mutable globals
**CRITICAL**: This is the heaviest consumer:
- `demoData` is read directly in 3 separate `forEach` loops (lines 119, 161, 192) and once for opening cash (line 227).
- `forecastMonths` is read for array length and iteration (lines 127, 133, 149, 184, 241) and returned as-is in the result.
- `demoValueRules` and `demoTimingProfiles` are used as **default fallbacks** (lines 110-111) when callers do not pass explicit values.

### API vs localStorage
- **None**. Pure computation. No API or localStorage access.

---

## 7. `src/lib/engine/scenarios/engine.ts` (83 lines)

### Exact Imports
```ts
import { demoTimingProfiles } from '../../demo-data';
import { runForecastEngine, type ForecastEngineOptions, type ForecastMicroForecastItem } from '..';
import type { AnyTimingProfileConfig } from '../timing-profiles/types';
import type { ScenarioDefinition } from './types';
```

### Exact Exports
```ts
export function runScenarioForecastEngine({
  scenario?,            // defaulted to null
  microForecastItems?,  // defaulted to []
  valueRules?,          // passed through to runForecastEngine
  timingProfiles?,      // defaults to demoTimingProfiles if not provided
  complianceConfig?,    // passed through
}: ScenarioEngineOptions = {}): EngineResult
```

### Data Flow
1. `buildBaselineAdjustments(scenario)` -- extracts `{accountId, adjustmentPct}` map from scenario.
2. `applyTimingOverrides(source, scenario)` -- clones timing profiles and applies scenario-specific overrides.
3. `applyMicroForecastToggles(items, scenario)` -- toggles `isActive` per scenario's microForecastToggles.
4. Delegates to `runForecastEngine(options)` with the computed overrides.

### Dependency on demo-data.ts mutable globals
**HIGH**: `demoTimingProfiles` is imported and used as the fallback default on line 77:
```ts
timingProfiles: applyTimingOverrides(timingProfiles ?? demoTimingProfiles, scenario),
```
If the caller does not pass `timingProfiles`, the mutable global `demoTimingProfiles` is used. When `useCurrentForecast` calls this function, it DOES pass `timingProfiles` from the workspace store, so the fallback is typically not hit in the primary flow. But any other caller that omits `timingProfiles` will read the mutable global.

### API vs localStorage
- **None**. Pure computation.

---

## Complete Data Flow Diagram

```
                        localStorage
                       "cashflowiq-workspace"
                              |
                     [zustand persist rehydrate]
                              |
                              v
                  useWorkspaceStore.getState()
                   { accounts, historicalMonths,
                     forecastMonths, valueRules,
                     timingProfiles, ... }
                              |
                              |  (WorkspaceBootstrapper useEffect,
                              |   triggered when hasHydrated or any
                              |   workspace slice changes)
                              v
              applyWorkspaceStateToRuntime()
              ┌─────────────────────────────────────┐
              │ demoData      ← clone(state.accounts)│
              │ historicalMonths ← state.historical..│
              │ forecastMonths  ← state.forecastMon..│
              │ allMonths      ← hist + forecast      │
              │ demoValueRules ← state.valueRules     │
              │ demoTimingProfiles ← state.timingPr.. │
              └─────────────┬───────────────────────┘
                            |
          ┌─────────────────┼────────────────────────┐
          |                 |                        |
          v                 v                        v
   micro-forecast-    engine/index.ts         ScenarioWorkspace.tsx
   store.ts           ForecastGrid.tsx        (reads demoData,
   (reads             (reads demoData,         demoTimingProfiles,
    forecastMonths)    forecastMonths,          forecastMonths directly)
                       historicalMonths)

          API /api/micro-forecasts
                 |
                 v
       useMicroForecastStore.items
                 |
                 |  (passed as microForecastItems)
                 v
        useCurrentForecast() ──────────────────────┐
          reads:                                    |
            useMicroForecastStore (items)           |
            useForecastStore (selectedScenarioId,   |
              engineVersion)                        |
            useScenarioStore (scenarios)            |
            useWorkspaceStore (companyProfile,      |
              complianceConfig, accounts,           |
              valueRules, timingProfiles, ...)      |
                                                   |
                 |                                 |
                 v                                 |
      runScenarioForecastEngine({                  |
        microForecastItems,   ←─ explicit ────────┘
        valueRules,           ←─ explicit
        timingProfiles,       ←─ explicit
        complianceConfig,     ←─ explicit
        scenario              ←─ explicit
      })
                 |
                 v
      runForecastEngine({
        valueRules,           ←─ or fallback: demoValueRules
        timingProfiles,       ←─ or fallback: demoTimingProfiles
        microForecastItems,
        baselineAdjustments,
        complianceConfig,
      })
                 |
                 |  Reads demoData directly (3x forEach + 1 find)
                 |  Reads forecastMonths directly (length + iteration)
                 v
           EngineResult
```

---

## Summary: Mutable Global Dependencies

| File | Mutable Globals Read | Severity |
|---|---|---|
| `runtime.ts` | `demoData`, `historicalMonths`, `forecastMonths`, `allMonths`, `demoValueRules`, `demoTimingProfiles` (WRITES to all) | **CRITICAL** -- the bridge |
| `engine/index.ts` | `demoData` (3x forEach + 1 find), `forecastMonths` (length/iteration + returned), `demoValueRules` (default), `demoTimingProfiles` (default) | **CRITICAL** -- main engine consumer |
| `engine/scenarios/engine.ts` | `demoTimingProfiles` (fallback default) | **HIGH** -- fallback only |
| `micro-forecast-store.ts` | `forecastMonths` (passed to wizard generators) | **HIGH** -- used in buildMicroForecast |
| `workspace-store.ts` | None at runtime (imports only used as initial seeds, cloned) | **LOW** |
| `scenario-store.ts` | None | **NONE** |
| `use-current-forecast.ts` | None directly | **NONE** (indirect via engine) |

## Summary: API vs localStorage

| File | API Calls | localStorage |
|---|---|---|
| `runtime.ts` | None | Reads Zustand (persisted) |
| `workspace-store.ts` | None | Read/Write via `zustand/persist` key `cashflowiq-workspace` |
| `micro-forecast-store.ts` | GET/POST/PATCH/DELETE `/api/micro-forecasts` | None (not persisted) |
| `scenario-store.ts` | None | Read/Write via `zustand/persist` key `cashflowiq-scenarios` |
| `use-current-forecast.ts` | None directly (triggers `loadItems`) | Reads from 4 stores |
| `engine/index.ts` | None | None |
| `engine/scenarios/engine.ts` | None | None |

## Key Refactoring Concern

The fundamental architectural issue is that `runForecastEngine` in `engine/index.ts` reads `demoData` and `forecastMonths` as mutable globals rather than receiving them as explicit parameters. The entire `applyWorkspaceStateToRuntime` mechanism exists solely to bridge the persisted Zustand store into these globals so the engine can see the data. Any refactoring that makes the engine accept `accounts` and `forecastMonths` as explicit parameters would eliminate the need for the mutable-global bridge and the `WorkspaceBootstrapper` race condition.