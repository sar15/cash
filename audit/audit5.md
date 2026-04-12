Now I have a thorough understanding of the entire frontend-engine-backend wiring. Here is the comprehensive report.

---

# CashFlowIQ: Frontend-Engine-Backend Wiring Analysis

## Executive Summary

The project has a **client-side engine architecture** where the forecast engine runs entirely in the browser. The data flow between frontend, engine, and backend has significant architectural issues centered around a fragile mutation-based bridge pattern, incomplete backend persistence, and a dual data-source problem that creates multiple failure modes.

---

## 1. STORE ANALYSIS (`src/stores/`)

### 1.1 `workspace-store.ts` -- The Central State Store

**Purpose:** Holds accounts, historical/forecast months, value rules, timing profiles, compliance config, company profile, and setup state. Persisted to `localStorage` via `zustand/persist`.

**Critical Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| **No backend persistence** | HIGH | Only `zustand/persist` to localStorage. There is no API route for saving/loading workspace data to the database. The DB schema has `accounts`, `value_rules`, `timing_profiles`, `compliance_config` tables, but none are used. |
| **Accounts stored as flat demo-structure** | HIGH | The `accounts` array always mirrors the `AccountData[]` shape from `demo-data.ts` with 8 hardcoded IDs (`rev-1`, `rev-2`, `cogs-1`, `cogs-2`, `exp-1`, `exp-2`, `exp-3`, `ast-1`). Imported data is overlaid onto this same structure. No dynamic account creation is possible. |
| **`setupMode` state is write-only** | MEDIUM | `setupMode` is stored and persisted but never read by any consumer. The `ready` boolean is what determines if the forecast shows. |
| **`completeDemoSetup` re-generates on every call** | LOW | `generateDemoData()` is called again each time, creating a new array. This is correct but wasteful. |

### 1.2 `micro-forecast-store.ts` -- The Only API-Connected Store

**Purpose:** Manages business events (new hires, revenue, assets, loans). The ONLY store that communicates with the backend API (`/api/micro-forecasts`).

**Critical Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| **Imports `forecastMonths` from `demo-data` directly** | HIGH | Line 5: `import { forecastMonths } from '@/lib/demo-data'`. This is the module-level mutable array. While `applyWorkspaceStateToRuntime` mutates it, there is a race window: if `buildMicroForecast()` is called before the bootstrapper runs, it uses stale demo months. |
| **`wizardInputs` sent as raw object, parsed as `JSON.parse`** | MEDIUM | In `serializeItem`, `wizardConfig: item.wizardInputs` is sent. The API route then does `JSON.stringify(wizardConfig)` if it's not already a string. On read, `parseWizardConfig` does `JSON.parse(raw)`. This double-serialization is fragile -- if `wizardInputs` contains non-serializable values, it silently breaks. |
| **`normalizeWizardType` defaults unknown to `revenue`** | MEDIUM | Line 120: If the API returns an unexpected category, it silently becomes a revenue forecast. Should throw or flag an error. |
| **Optimistic updates without rollback on failure** | MEDIUM | `toggleActive` and `removeItem` optimistically update the store, then call the API. If the API fails, the store is reverted. But the `throw error` after reversion means callers must handle it. The `RevenueWizard` has a `try/finally` but no catch, so errors are silently swallowed. |
| **`getActiveMicroForecasts` is not memoized** | LOW | It filters and maps on every call. Minor performance concern. |

### 1.3 `forecast-store.ts` -- UI State Only

**Purpose:** Holds `activeView`, `selectedScenarioId`, `isSidebarOpen`, `isEngineRunning`, and `engineVersion`. Not persisted.

**Issues:**
- `isEngineRunning` is defined but **never set to `true`** anywhere in the codebase. The `useCurrentForecast` hook uses `useDeferredValue` comparison for `isEngineComputing` instead. This is dead state.
- `engineVersion` + `bumpEngineVersion` acts as a manual invalidation trigger -- a code smell that exists because the engine doesn't have proper dependency tracking.

### 1.4 `scenario-store.ts` -- localStorage-Only Scenarios

**Purpose:** CRUD for scenario definitions. Persisted to localStorage only.

**Issues:**
- The DB has `scenarios` and `scenario_overrides` tables but they are **completely unused**. Scenario data never reaches the backend.
- No validation on `ScenarioDefinition` shape -- malformed scenarios can be stored.

### 1.5 `auth-store.ts` -- Minimal Auth

**Issues:**
- `currentCompanyId` is set by micro-forecast API responses (`useAuthStore.getState().setCurrentCompanyId(result.companyId)`). But it is never used for auth decisions, API calls, or routing guards.
- No auth guard on any page. Unauthenticated users could see the forecast page (though the engine would have no data).

### 1.6 `ui-store.ts` -- Pure UI State

No issues. Clean, simple sidebar/modal/toast state.

---

## 2. HOOK ANALYSIS (`src/hooks/`)

### 2.1 `use-current-forecast.ts` -- The Critical Bridge Hook

**This is the most important file in the frontend-engine wiring.**

**Data Flow:**
```
WorkspaceStore (accounts, valueRules, timingProfiles, complianceConfig)
    +
ScenarioStore (scenarios)
    +
MicroForecastStore (items loaded from API)
    |
    v
useCurrentForecast()
    |
    v  (calls directly in useMemo)
runScenarioForecastEngine() --> runForecastEngine() --> [engine runs in browser]
    |
    v
EngineResult (accountForecasts, integrationResults, compliance, salaryForecast)
```

**Critical Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| **Engine runs synchronously in `useMemo`** | HIGH | `runScenarioForecastEngine` is called inside `useMemo`. For large datasets, this could block the main thread. The `useDeferredValue` pattern mitigates this slightly but does not prevent the actual computation from blocking. |
| **`baselineResult` is computed even when no scenario is selected** | MEDIUM | The engine runs twice: once for baseline, once for the scenario. If no scenario is selected, `engineResult === baselineResult` (same reference). This means 2 engine runs when a scenario IS active, which is correct, but the baseline is always computed even if never displayed alone. |
| **`void deferredEngineVersion` is a hack** | MEDIUM | Line 57: `void deferredEngineVersion;` exists solely to include `deferredEngineVersion` in the dependency array of the `useMemo` that computes `baselineResult`. Without it, changing `engineVersion` wouldn't invalidate the cache. This is the manual invalidation smell. |
| **No error boundary around engine computation** | HIGH | If `runScenarioForecastEngine` throws (e.g., malformed value rule), the entire component tree crashes. There is no try/catch. |
| **`loadItems` is called on every mount** | LOW | `useEffect(() => { void loadItems(); }, [loadItems]);` -- but `loadItems` has an internal guard (`if get().isLoading || (get().hasLoaded && !force) return`). This works but the dependency on `loadItems` is unstable (Zustand selectors can return new references). |
| **API errors from micro-forecast store are not surfaced** | MEDIUM | The hook reads `items` but not `error` from the micro-forecast store. If loading fails, the UI silently shows an empty event list. |

---

## 3. TYPE ANALYSIS (`src/types/` + engine types)

There is no `src/types/` directory. Types are co-located with their modules in `src/lib/engine/*/types.ts`.

### 3.1 Type Mismatch: `ThreeWayMonth.bs` vs. `ComplianceAdjustedMonth.bs`

The raw three-way builder's `ThreeWayMonth.bs` has:
```typescript
bs: { cash, ar, fixedAssets, accDepreciation, totalAssets, ap, debt, totalLiabilities, equity, retainedEarnings, totalEquity }
```

The compliance-adjusted `ComplianceAdjustedMonth.bs` adds:
```typescript
+ { gstPayable, gstReceivable, tdsPayable, advanceTaxPaid, pfPayable, esiPayable }
```

`EngineResult.integrationResults` is typed as `ComplianceResult['integrationResults']` which is `ComplianceAdjustedMonth[]`. This is correct, but the type chain is deep and fragile. If someone accesses `engineResult.rawIntegrationResults[].bs.gstPayable`, TypeScript would correctly flag it, but there is no runtime guard.

### 3.2 Type Mismatch: `MicroForecastLine.category`

The `category` field includes `'Debt'` as a separate value from `'Liabilities'`, but the overlay function (`overlay.ts`) handles them together in the same `else if` branch:
```typescript
} else if (line.category === 'Liabilities' || line.category === 'Debt') {
```

This works, but the loan wizard creates `category: 'Debt'` lines while the asset wizard creates `category: 'Assets'` lines. The `mapFutureAccountType` function in the micro-forecast store maps these to `'liability'` and `'asset'` respectively for the API. No mismatch, but the terminology split between `'Debt'`/`'Liabilities'` and `'Assets'` in the engine vs. `'asset'`/`'liability'` in the API is confusing.

### 3.3 Type Issue: `ForecastEngineOptions.activeMicroForecasts` vs `microForecastItems`

The engine supports two ways to pass micro-forecasts:
1. `activeMicroForecasts?: MicroForecast[]` -- the raw micro-forecast objects
2. `microForecastItems?: ForecastMicroForecastItem[]` -- wrapped items with `id`, `type`, `isActive`

The resolution logic:
```typescript
const resolvedMicroForecasts =
  activeMicroForecasts ??
  microForecastItems?.filter(...).map(...) ??
  [];
```

**The frontend always uses `microForecastItems`** (from `useCurrentForecast`). `activeMicroForecasts` is only used by the deprecated `runFullForecastEngine` function. This is dead code in practice.

---

## 4. FORECAST PAGE WIRING (`src/app/(app)/forecast/`)

### Data Flow Diagram

```
forecast/page.tsx
  └─> ForecastContainer
        ├─> useCurrentForecast()  [HOOK - reads 4 stores, runs engine]
        │     ├─> useMicroForecastStore.loadItems()  [API CALL]
        │     ├─> runScenarioForecastEngine()         [CLIENT ENGINE]
        │     └─> returns { engineResult, baselineResult, ... }
        │
        ├─> ForecastGrid
        │     ├─> Imports demoData DIRECTLY from @/lib/demo-data  [MUTABLE MODULE STATE]
        │     ├─> Uses engineResult.accountForecasts for PL forecast values
        │     ├─> Uses engineResult.integrationResults for BS/CF values
        │     └─> Uses demoData for PL row structure & historical values
        │
        └─> MicroForecastSidebar
              ├─> useMicroForecastStore (items, isLoading, error)
              └─> Wizard components (call store.addRevenue/addHire/etc.)
                    └─> Store calls API, then rebuilds micro-forecast via engine wizards
```

### Critical Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **ForecastGrid imports `demoData` directly** | CRITICAL | Line 11: `import { demoData, forecastMonths, historicalMonths } from '@/lib/demo-data'`. The PL view iterates `demoData` to build rows (line 436). The BS view reads `cashHistory` from `demoData.find(a => a.id === 'ast-1')` (line 49). This works ONLY because `WorkspaceBootstrapper` mutates `demoData` in-place via `applyWorkspaceStateToRuntime()`. If the bootstrapper hasn't run yet, or if a render happens before it, stale demo data is shown. |
| **`engineResult` comes from the engine but row structure comes from `demoData`** | HIGH | The engine uses `demoData` internally (mutated by runtime.ts), but `ForecastGrid` ALSO imports `demoData` for row structure. If the store and the mutated module get out of sync (which is possible during React concurrent mode), the grid will show wrong rows vs. values. |
| **BS cash history hardcoded to `ast-1`** | MEDIUM | Line 49: `const cashHistory = demoData.find(a => a.id === 'ast-1')?.historicalValues`. This only works because the account structure is hardcoded. If a user has no `ast-1` account (e.g., manual setup with zeroed accounts), BS cash history shows nulls. |
| **No error boundary** | HIGH | If the engine throws (bad rule config, missing data), the entire page crashes. |
| **`handleCellEdit` creates `direct_entry` rules with 12 entries** | LOW | Line 77: `let newEntries: Array<number | null> = Array(12).fill(null)`. This hardcodes 12 months. If `forecastMonths` length changes, this breaks. |

---

## 5. ONBOARDING FLOW (`/data` page)

### Flow

```
/data page.tsx
  └─> OnboardingWorkspace
        Step 1: Company profile form
          ├─> "Skip, use demo data" → completeDemoSetup() → redirect to /forecast
          └─> "Continue" → Step 2
        Step 2: File upload
          ├─> Excel/CSV parse via parseExcelBuffer() + detectStructure()
          ├─> Account mapping via mapAccountDetailed()
          └─> "I'll enter manually later" → completeManualSetup() → redirect to /forecast
        Step 3: Account mapping review
          └─> User confirms/reassigns mappings
        Step 4: Generate (fake animation with setTimeout)
          └─> completeImportedSetup() → buildImportedAccounts() → redirect to /forecast
```

### Critical Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **Imported data goes ONLY to localStorage** | CRITICAL | `completeImportedSetup` writes to the Zustand store, which persists to localStorage. There is no API call to save imported accounts to the database. If the user clears their browser data, all imported data is lost. |
| **`buildImportedAccounts` is a hack** | HIGH | It calls `generateDemoData()` to get the 8-account template, zeroes all historical values, then overlays imported rows by `mappedAccountId`. This means: (1) only the 8 hardcoded accounts can receive data; (2) any imported rows that don't map to these 8 are silently dropped; (3) the "zeroed template" approach means unmapped accounts show as zeros, not as absent. |
| **Import maps to paise incorrectly** | HIGH | Line 189: `return parsed === null ? 0 : Math.round(parsed * 100)`. The `parseIndianNumberString` parses a number in lakhs (e.g., "5.5" = 5.5 lakhs). Multiplying by 100 gives 550 paise, not 5.5 lakh paise (which should be 55,000,000 paise). The correct conversion would be `Math.round(parsed * LAKH)` where `LAKH = 10_000_000`. This means **all imported values are off by a factor of 100,000x**. |
| **Step 4 "Generate" is pure theater** | MEDIUM | The generation step uses `setTimeout` delays (700ms, 850ms, 650ms, 500ms) to fake processing. The actual work (`buildImportedAccounts` + `completeImportedSetup`) is instantaneous. This is misleading UX. |
| **No validation of detected months** | MEDIUM | `detectedMonths` from the structure detector is used directly, but there's no validation that months are sequential, in the right format, or cover the expected period. |
| **`buildFallbackRules` condition is wrong** | LOW | Line 237: `if (detectedMonths.length < 12)` -- this applies `rolling_avg` rules only if less than 12 months are detected. But the `lookbackMonths` is `Math.min(3, Math.max(account.historicalValues.length, 1))`, which can exceed the actual number of non-zero historical values. |

---

## 6. DATA IMPORT FLOW (Frontend Perspective)

### Import Pipeline

```
User uploads file
  → parseExcelBuffer()       [XLSX/CSV parsing]
  → detectStructure()         [Find header row, data columns, months]
  → mapAccountDetailed()      [Match rows to 8 standard accounts]
  → User reviews mapping
  → buildImportedAccounts()   [Overlay onto zeroed demo template]
  → completeImportedSetup()   [Save to Zustand/localStorage]
  → applyWorkspaceStateToRuntime()  [Mutate demo-data module]
  → bumpEngineVersion()       [Invalidate engine cache]
```

### Issues (beyond those listed above)

| Issue | Severity | Detail |
|-------|----------|--------|
| **No backend persistence at all** | CRITICAL | The DB has an `accounts` table, a `monthly_actuals` table, a `value_rules` table, and a `timing_profiles` table. None of them are written to during import. The import data exists only in localStorage. |
| **The `accounts` table in DB is never used** | HIGH | The schema defines a full accounts table with `companyId`, `accountType`, `standardMapping`, etc. But the frontend uses `AccountData[]` from `demo-data.ts` instead. |
| **`forecastResults` table is never used** | MEDIUM | The schema has a `forecast_results` table for caching engine output. It is never written to or read from. |

---

## 7. THE MUTATION-BASED BRIDGE (Core Architecture Issue)

### The Problem

The engine (`src/lib/engine/index.ts`) directly imports module-level mutable arrays from `demo-data.ts`:

```typescript
import { demoData, forecastMonths, demoValueRules, demoTimingProfiles } from '../demo-data';
```

These are used throughout `runForecastEngine`:
- `demoData.forEach((account) => { ... })` -- iterates accounts
- `forecastMonths.length` -- determines forecast period
- `demoValueRules` / `demoTimingProfiles` -- fallback defaults

The `WorkspaceBootstrapper` synchronizes the Zustand store to these module-level exports by **mutating them in place**:

```typescript
// runtime.ts
demoData.length = 0;
demoData.push(...clone(state.accounts));
forecastMonths.length = 0;
forecastMonths.push(...state.forecastMonths);
```

### Why This Is Fragile

1. **Race condition**: `demoData` is imported at module load time. If any component renders before `applyWorkspaceStateToRuntime` runs (which requires `hasHydrated === true`), it sees the original demo data.

2. **React concurrent mode**: With `useDeferredValue` and `startTransition`, React may render with stale snapshots. The mutable module state can change between render phases.

3. **No single source of truth**: Both the Zustand store AND the module-level exports hold "current" data. The store is the source of truth for the UI, but the engine reads from the module exports. If they diverge, the forecast shows wrong results.

4. **`useCurrentForecast` passes some data explicitly but the engine also reads `demoData`**: The hook passes `microForecastItems`, `valueRules`, `timingProfiles`, and `complianceConfig` explicitly to `runScenarioForecastEngine`. But inside `runForecastEngine`, it still iterates `demoData` to build `accountForecasts` and `monthlyInputs`. So the engine receives rules/config from the hook but account structure from the mutated global. This split data path is the root cause of potential inconsistencies.

---

## 8. LOADING/ERROR STATE ANALYSIS

| Component | Loading State | Error State | Verdict |
|-----------|--------------|-------------|---------|
| `ForecastContainer` | Skeleton during hydration, skeleton during engine compute | EmptyState if `!ready` or `!engineResult` | **Partial** -- no error display for engine failures |
| `ForecastGrid` | Skeleton rows during compute | "No rows available" | **OK** for empty state |
| `MicroForecastSidebar` | "Loading saved events..." spinner | Error banner when items are empty | **OK** |
| `DashboardWorkspace` | Skeleton during hydration | EmptyState if `!ready` or `!engineResult` | **Partial** -- same as ForecastContainer |
| `OnboardingWorkspace` | Skeleton during hydration | Error banner for file upload failures | **OK** |
| Wizard dialogs | `isSaving` state | No error handling in `finally` block | **MISSING** -- save errors are silently swallowed |
| `useCurrentForecast` | `isEngineComputing` flag | No error surface | **MISSING** |

---

## 9. DEAD CODE / UNUSED EXPORTS

| Item | Location | Detail |
|------|----------|--------|
| `runFullForecastEngine` | `engine/index.ts:261` | Exported but never called. Superseded by `runScenarioForecastEngine`. |
| `ForecastEngineOptions.activeMicroForecasts` | `engine/index.ts:28` | Supported in engine but never used by frontend (frontend uses `microForecastItems`). |
| `ForecastState.isEngineRunning` | `forecast-store.ts:15` | State field defined but never set to `true` anywhere. |
| `WorkspaceState.setupMode` | `workspace-store.ts:49` | Written but never read by any consumer. |
| `AuthState.currentCompanyId` | `auth-store.ts:4` | Set by micro-forecast API, but never read for any decision. |
| DB tables: `accounts`, `monthly_actuals`, `value_rules`, `timing_profiles`, `scenarios`, `scenario_overrides`, `forecast_results`, `quick_metrics_config` | `db/schema.ts` | All defined but none are read or written by the frontend. Only `companies`, `microForecasts`, and `microForecastLines` are used. |
| `mapAccount` (simple version) | `import/account-mapper.ts:101` | Exported but never used. Only `mapAccountDetailed` is used. |
| `allMonths` | `demo-data.ts:103` | Exported and mutated in `runtime.ts`, but never read by any UI component. |

---

## 10. SUMMARY OF CRITICAL ISSUES (Ranked by Severity)

### CRITICAL (Will cause incorrect behavior or data loss)

1. **Import paise conversion is wrong** (`OnboardingWorkspace.tsx:189`): `Math.round(parsed * 100)` should be `Math.round(parsed * 10_000_000)`. Imported values are 100,000x too small.

2. **No backend persistence for workspace data**: Accounts, value rules, timing profiles, compliance config, and scenarios exist only in localStorage. Clearing browser data = total data loss.

3. **Mutation-based bridge between store and engine**: `demoData`/`forecastMonths`/etc. are module-level mutable state, synchronized by `applyWorkspaceStateToRuntime`. Race conditions and concurrent rendering can cause stale data in the forecast.

4. **ForecastGrid directly imports `demoData`**: PL row structure and BS cash history depend on the mutable global. If `applyWorkspaceStateToRuntime` hasn't run, the grid shows the hardcoded demo accounts, not the user's data.

### HIGH (Will cause problems in real usage)

5. **No error boundary around engine computation**: A malformed value rule or missing account crashes the entire page tree.

6. **Import limited to 8 hardcoded accounts**: `buildImportedAccounts` uses `generateDemoData()` as a template. Any data that doesn't map to `rev-1`, `rev-2`, `cogs-1`, `cogs-2`, `exp-1`, `exp-2`, `exp-3`, or `ast-1` is silently dropped.

7. **Micro-forecast store imports `forecastMonths` from mutable global**: If the bootstrapper hasn't run, micro-forecasts are built with wrong month labels.

8. **DB schema is 80% unused**: 8 of 10 tables are never touched by the frontend. This means the database layer is essentially decorative for most features.

9. **Wizard save errors are swallowed**: The `try/finally` pattern without `catch` in `RevenueWizard` (and likely other wizards) means API errors are silently ignored while `isSaving` resets.

### MEDIUM (Quality/reliability concerns)

10. **`isEngineRunning` is dead state** -- the forecast store tracks it but nobody sets it.
11. **Engine runs synchronously in `useMemo`** -- could freeze the UI for large datasets.
12. **Scenario store is localStorage-only** despite DB schema existing.
13. **`normalizeWizardType` silently defaults to `revenue`** for unknown categories.
14. **Step 4 "Generate" animation is pure theater** with no real computation happening.
15. **`handleCellEdit` hardcodes 12 months** in the `direct_entry` rule creation.

---

## 11. RECOMMENDED ARCHITECTURE FIXES

1. **Replace the mutation bridge with explicit parameter passing**: `useCurrentForecast` should pass `accounts` (from the store) directly to the engine. The engine should accept `accounts` as a parameter instead of importing `demoData`.

2. **Add API routes for workspace persistence**: Create `/api/workspace` endpoints that sync accounts, value rules, timing profiles, and compliance config to the database. Load on app start.

3. **Fix the import paise conversion**: Change `Math.round(parsed * 100)` to `Math.round(parsed * 10_000_000)` in `OnboardingWorkspace.tsx`.

4. **Remove the `demoData` mutable global pattern**: Replace with a proper data layer that reads from the store or API.

5. **Add an error boundary** around the forecast page and engine computation.

6. **Surface micro-forecast store errors** in the `useCurrentForecast` hook and the forecast page UI.