# CashFlowIQ — Frontend Development Guide

> **Backend is production-locked.** This guide documents every contract, type, and rule your frontend must follow.

---

## ⚠️ 11 Critical Rules for Frontend

| # | Rule | Why |
|---|------|-----|
| 1 | **ALL monetary values are integer PAISE** | Engine, DB, and API all use paise. `₹1,00,000 = 10_000_000 paise`. NEVER use float rupees in state/API calls. |
| 2 | **Convert to rupees ONLY at display time** | Use `formatRupees()`, `formatLakhs()`, `formatAuto()` from `@/lib/utils/indian-format.ts` |
| 3 | **User input must convert to paise before storing** | Use `parseToPaise()` from `@/lib/utils/indian-format.ts` |
| 4 | **Every API call requires Clerk auth** | Clerk middleware guards all routes except `/api/health` and `/api/import/template` |
| 5 | **companyId is required for ALL data operations** | Every entity belongs to a company. Fetch companies first, then scope all calls. |
| 6 | **Engine runs client-side, NOT on server** | The engine is a pure function: `runForecastEngine(options) → EngineResult`. Frontend must fetch data from API, assemble `ForecastEngineOptions`, and run locally. |
| 7 | **No localStorage for business data** | Old stores used `zustand/persist` to localStorage. New frontend MUST use API endpoints for persistence. |
| 8 | **No mutable module-level globals** | Old `demo-data.ts` pattern is banned. All data comes from API → store → engine. |
| 9 | **JSON text columns need parsing** | DB stores `config`, `wizardConfig`, `tdsSections`, `threshold` as JSON strings. API returns them as strings — frontend must `JSON.parse()`. |
| 10 | **Period format is `YYYY-MM-01`** in the DB | But month labels in the engine are `MMM-YY` (e.g. `Apr-25`). The API `/import/save` auto-converts. |
| 11 | **Don't import from `@/lib/demo-data`** | This module is legacy. All data MUST come from API. |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (New)                       │
│                                                         │
│  Clerk Auth ──► API Client ──► Zustand Stores ──► UI    │
│                                     │                   │
│                                     ▼                   │
│                              Engine (client-side)       │
│                         runForecastEngine(options)       │
│                                     │                   │
│                                     ▼                   │
│                           EngineResult → Render         │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP (JSON)
┌────────────────────▼────────────────────────────────────┐
│                    BACKEND (Locked)                      │
│                                                         │
│  Middleware (Clerk) ──► API Routes ──► Query Modules     │
│                                           │             │
│                                     Turso/SQLite        │
│                                     (12 tables)         │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema (12 Tables)

| Table | Key Columns | Notes |
|-------|-------------|-------|
| **companies** | `id`, `clerkUserId`, `name`, `pan`, `gstin`, `industry`, `fyStartMonth`, `currency`, `numberFormat`, `logoUrl` | One user → many companies (CA model) |
| **accounts** | `id`, `companyId`, `code`, `name`, `accountType`, `standardMapping`, `parentId`, `isGroup`, `sortOrder` | accountType: `revenue\|expense\|asset\|liability\|equity` |
| **monthly_actuals** | `id`, `companyId`, `accountId`, `period`, `amount` | `amount` is INTEGER PAISE. `period` = `YYYY-MM-01` |
| **scenarios** | `id`, `companyId`, `name`, `parentId`, `description`, `isActive` | Supports inheritance via `parentId` |
| **scenario_overrides** | `id`, `scenarioId`, `targetType`, `targetId`, `config` | `targetType`: `value_rule\|timing_profile\|micro_toggle` |
| **value_rules** | `id`, `companyId`, `accountId`, `scenarioId`, `ruleType`, `config` | `ruleType`: `rolling_avg\|growth\|same_last_year\|direct_entry\|formula\|baseline_adjustment` |
| **timing_profiles** | `id`, `companyId`, `name`, `profileType`, `config`, `autoDerived`, `isDefault` | `profileType`: `receivables\|payables\|deferred\|prepaid` |
| **micro_forecasts** | `id`, `companyId`, `name`, `category`, `isActive`, `startMonth`, `endMonth`, `wizardConfig` | `category`: `hire\|asset\|loan\|revenue\|marketing\|equity\|custom` |
| **micro_forecast_lines** | `id`, `microForecastId`, `accountId`, `futureAccountName`, `futureAccountType`, `ruleType`, `config` | Lines map wizard output to account positions |
| **compliance_config** | `id`, `companyId`, `gstType`, `supplyType`, `gstRate`, `itcPct`, `tdsRegime`, `taxRate`, `pfApplicable`, `esiApplicable` | One per company (unique constraint) |
| **forecast_results** | `id`, `companyId`, `scenarioId`, `plData`, `bsData`, `cfData`, `compliance`, `metrics` | Cached engine output — JSON strings |
| **quick_metrics_config** | `id`, `companyId`, `metric1`-`metric5`, `threshold` | Configurable dashboard cards |

---

## 🔌 Complete API Reference

### Auth Header
All requests (except `/api/health`, `/api/import/template`) require Clerk's session cookie. Use `@clerk/nextjs` client-side hooks.

### Error Format
```
HTTP 4xx/5xx → Plain text body (e.g. "Unauthorized", "Validation failed.")
HTTP 422 → Zod validation error message
```

---

### 1. Companies

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `GET` | `/api/companies` | — | `{ companies: Company[] }` |
| `POST` | `/api/companies` | `{ name, pan?, gstin?, industry?, fyStartMonth?, currency?, numberFormat? }` | `{ company: Company }` (201) |
| `GET` | `/api/companies/:id` | — | `{ company: Company }` |
| `PATCH` | `/api/companies/:id` | Partial company fields | `{ company: Company }` |
| `DELETE` | `/api/companies/:id` | — | 204 No Content |

> **First GET auto-creates** a default company if user has none.

---

### 2. Chart of Accounts (CoA)

| Method | Endpoint | Body/QS | Response |
|--------|----------|---------|----------|
| `GET` | `/api/coa?companyId=X` | QS: `companyId` | `{ accounts: Account[] }` |
| `POST` | `/api/coa?companyId=X` | `{ code?, name, accountType, parentId?, level?, standardMapping?, isGroup?, sortOrder? }` | `{ account: Account }` (201) |
| `PATCH` | `/api/coa?accountId=X` | Partial account fields | `{ account: Account }` |
| `DELETE` | `/api/coa?accountId=X` | — | 204 |
| `GET` | `/api/coa/:companyId` | — | `{ accounts: Account[] }` (tree-ready) |
| `POST` | `/api/coa/:companyId` | Same as above | `{ account: Account }` (201) |
| `PATCH` | `/api/coa/:companyId/:accountId` | Partial fields | `{ account: Account }` |

---

### 3. Historical Actuals

| Method | Endpoint | Body/QS | Response |
|--------|----------|---------|----------|
| `GET` | `/api/historical?companyId=X` | QS: `companyId` | `{ actuals: Actual[] }` |
| `PATCH` | `/api/historical?companyId=X` | `{ actuals: [{ accountId, period, amount }] }` | `{ saved: number }` |
| `GET` | `/api/historical/:companyId` | — | `{ actuals: Actual[] }` |
| `PATCH` | `/api/historical/:companyId` | Same as above | `{ saved: number }` |

> `amount` is **integer paise**. `period` is `YYYY-MM-01`.

---

### 4. Import Pipeline (3-Step)

#### Step 1: Upload File
```
POST /api/import/upload
Content-Type: multipart/form-data
Fields: file (File), companyId (string)

→ { companyId, fileKey, filename, size, contentType, storage }  (201)
```
Max 10MB. Only `.xlsx`, `.xls`, `.csv`.

#### Step 2: Parse & Preview
```
POST /api/import/parse
Body: { companyId?, fileKey, sheetName? }

→ { companyId, fileKey, sheets, headers, accounts[], months[], data[][] }
```

#### Step 3: Save Mapped Data
```
POST /api/import/save
Body: {
  companyId,
  accounts: [{ name, code?, accountType, standardMapping?, parentId?, level?, isGroup?, sortOrder? }],
  actuals: [{ accountName, period, amount }],  // amount in PAISE
  replaceExisting?: boolean
}

→ { companyId, createdAccounts, updatedAccounts, savedActuals }
```

#### Download Template
```
GET /api/import/template  (PUBLIC — no auth)
→ CSV file download
```

---

### 5. Forecast Configuration

| Method | Endpoint | Body/QS | Response |
|--------|----------|---------|----------|
| `GET` | `/api/forecast/config?companyId=X` | — | Full config bundle |
| `GET` | `/api/forecast/config/:companyId` | — | Full config bundle |
| **Value Rules** | | | |
| `GET` | `/api/forecast/value-rules?companyId=X` | — | `{ valueRules: ValueRule[] }` |
| `POST` | `/api/forecast/value-rules?companyId=X` | `{ accountId, ruleType, config, scenarioId?, sortOrder? }` | `{ valueRule }` |
| `PATCH` | `/api/forecast/config/value-rule?companyId=X` | Same | `{ valueRule }` |
| **Timing Profiles** | | | |
| `GET` | `/api/forecast/timing-profiles?companyId=X` | — | `{ timingProfiles: TimingProfile[] }` |
| `POST` | `/api/forecast/timing-profiles?companyId=X` | `{ name, profileType, config, autoDerived?, isDefault? }` | `{ timingProfile }` |
| `PATCH` | `/api/forecast/config/timing-profile?companyId=X` | Same | `{ timingProfile }` |
| **Compliance** | | | |
| `PATCH` | `/api/forecast/config/compliance?companyId=X` | `{ gstType?, supplyType?, gstRate?, itcPct?, tdsRegime?, taxRate?, pfApplicable?, esiApplicable? }` | `{ config }` |
| **Metrics** | | | |
| `PATCH` | `/api/forecast/config/metrics?companyId=X` | `{ metric1?..metric5?, threshold? }` | `{ config }` |

---

### 6. Micro-Forecasts (Business Events)

| Method | Endpoint | Body/QS | Response |
|--------|----------|---------|----------|
| `GET` | `/api/micro-forecasts?companyId=X` | — | `{ companyId, forecasts: MicroForecast[] }` |
| `POST` | `/api/micro-forecasts` | `{ companyId?, name, category, isActive?, startMonth, endMonth?, wizardConfig, sortOrder?, lines? }` | `{ companyId, forecast }` (201) |
| `GET` | `/api/micro-forecasts/:id` | — | `{ forecast }` |
| `PATCH` | `/api/micro-forecasts/:id` | Partial fields + `lines?` | `{ forecast }` |
| `DELETE` | `/api/micro-forecasts/:id` | — | 204 |
| `PATCH` | `/api/micro-forecasts/:id/toggle` | `{ isActive: boolean }` | `{ forecast }` |

> `wizardConfig` can be object or JSON string. Backend normalizes it.

---

### 7. Scenarios

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `GET` | `/api/scenarios?companyId=X` | — | `{ scenarios: Scenario[] }` |
| `POST` | `/api/scenarios?companyId=X` | `{ name, description?, parentId?, isActive? }` | `{ scenario }` (201) |
| `GET` | `/api/scenarios/:companyId/:id` | — | `{ scenario }` (with overrides) |
| `PATCH` | `/api/scenarios/:companyId/:id` | Partial fields | `{ scenario }` |
| `DELETE` | `/api/scenarios/:companyId/:id` | — | 204 |
| `POST` | `/api/scenarios/:companyId/:id/overrides` | `{ overrides: [{ targetType, targetId?, config }] }` | `{ overrides }` |

---

### 8. Forecast Results (Cache)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `GET` | `/api/forecast/result?companyId=X` | — | `{ result }` |
| `POST` | `/api/forecast/result?companyId=X` | `{ scenarioId?, plData, bsData, cfData, compliance, metrics }` | `{ result }` |
| `GET` | `/api/forecast/result/:companyId` | — | Same |
| `POST` | `/api/forecast/result/:companyId` | Same | Same |

---

### 9. Forecast Compliance & Metrics

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/forecast/compliance?companyId=X` | Full compliance config |
| `POST` | `/api/forecast/compliance?companyId=X` | Upsert compliance config |
| `GET` | `/api/forecast/metrics?companyId=X` | Quick metrics config |
| `POST` | `/api/forecast/metrics?companyId=X` | Upsert metrics config |

---

### 10. Reports & Branding

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `GET` | `/api/reports/branding?companyId=X` | — | `{ branding }` |
| `GET` | `/api/reports/branding/:companyId` | — | Same |
| `PATCH` | `/api/reports/branding/:companyId` | `{ reportNotes?, logoDataUrl? }` | `{ branding }` |

---

### 11. Health Check

```
GET /api/health  (PUBLIC)
→ { status: "ok", timestamp, db: { status, latencyMs } }
```

---

## 🧮 Engine Integration Guide

### How to Run the Engine from Frontend

```typescript
import { runForecastEngine, type ForecastEngineOptions, type EngineResult } from '@/lib/engine'
import { runScenarioForecastEngine } from '@/lib/engine/scenarios/engine'

// 1. Fetch data from API
const accounts = await fetch('/api/coa?companyId=X').then(r => r.json())
const actuals = await fetch('/api/historical?companyId=X').then(r => r.json())
const config = await fetch('/api/forecast/config?companyId=X').then(r => r.json())
const microForecasts = await fetch('/api/micro-forecasts?companyId=X').then(r => r.json())

// 2. Transform into AccountInput[]
const accountInputs: AccountInput[] = accounts.map(acct => ({
  id: acct.id,
  name: acct.name,
  category: mapAccountTypeToCategory(acct.accountType), // 'revenue' → 'Revenue', etc.
  historicalValues: getMonthlyValuesForAccount(acct.id, actuals), // number[] in paise
}))

// 3. Run engine
const options: ForecastEngineOptions = {
  accounts: accountInputs,
  forecastMonthLabels: ['Apr-25', 'May-25', ...], // MMM-YY format
  valueRules: config.valueRules,
  timingProfiles: config.timingProfiles,
  microForecastItems: microForecasts,
  complianceConfig: {
    gstRatePct: config.compliance.gstRate,
    inputTaxCreditPct: config.compliance.itcPct,
    advanceTaxRatePct: config.compliance.taxRate,
    supplyType: config.compliance.supplyType,
  },
}

const result: EngineResult = runForecastEngine(options)
```

### EngineResult Shape

```typescript
{
  accountForecasts: Record<string, number[]>,  // accountId → paise[]
  rawIntegrationResults: ThreeWayMonth[],      // Pre-compliance 3-way
  integrationResults: ComplianceAdjustedMonth[], // Post-compliance 3-way
  forecastMonths: string[],                     // ['2025-04-01', ...]
  compliance: ComplianceResult,                 // GST, TDS, PF, ESI, AdvTax
  salaryForecast: number[],                     // Monthly salary paise[]
}
```

### ThreeWayMonth Shape (Each Forecast Month)

```typescript
{
  pl: { revenue, cogs, grossProfit, expense, depreciation, netIncome },
  cf: { cashIn, cashOut, operatingCashFlow, investingCashFlow, financingCashFlow, netCashFlow },
  bs: { cash, ar, fixedAssets, accDepreciation, totalAssets, ap, debt, totalLiabilities,
        equity, retainedEarnings, totalEquity }
}
```

> **A = L + E is always guaranteed** (cash is the plug).

---

## 🧙 Micro-Forecast Wizard Types

Each wizard generates a `MicroForecast` with `MicroForecastLine[]`:

| Wizard | Inputs | P&L Impact | Cash Impact |
|--------|--------|------------|-------------|
| **Revenue** | `clientName`, `monthlyAmount` (paise), `startMonth`, `gstRate`, `collectionPctSameMonth?` | ex-GST revenue | GST-inclusive cash (with timing) |
| **New Hire** | `name`, `annualSalary` (paise), `startMonth`, `pfApplicable?`, `bonusMonths[]` | Salary expense | Same-month payout |
| **Asset** | `assetName`, `purchaseAmount` (paise), `purchaseMonth`, `usefulLifeMonths`, `salvageValue` | Depreciation (starts NEXT month) | Purchase month capex |
| **Loan** | `loanName`, `principalAmount` (paise), `startMonth`, `termMonths`, `annualInterestRate` | Interest expense | Drawdown − principal repayment |

---

## 📱 Recommended Page → API Mapping

| Frontend Page | API Endpoints Used |
|--------------|-------------------|
| **Onboarding / Setup** | `POST /companies`, `POST /import/upload` → `POST /import/parse` → `POST /import/save` |
| **Dashboard** | `GET /companies`, `GET /forecast/metrics`, `GET /forecast/result/:companyId` |
| **Forecast Grid** | `GET /coa`, `GET /historical`, `GET /forecast/config`, `GET /micro-forecasts` → **run engine client-side** |
| **Scenario Manager** | `GET/POST/PATCH/DELETE /scenarios`, `POST /scenarios/:id/overrides` |
| **Micro-Forecast Events** | `GET/POST/PATCH/DELETE /micro-forecasts`, `PATCH /micro-forecasts/:id/toggle` |
| **Compliance Settings** | `PATCH /forecast/config/compliance` |
| **Reports** | `GET/PATCH /reports/branding`, cached `forecast/result` data |
| **Settings** | `PATCH /companies/:id`, `PATCH /forecast/config/metrics` |
| **Account Management** | `GET/POST/PATCH/DELETE /coa` |

---

## 🎨 Display Utilities Available

```typescript
// From @/lib/utils/indian-format.ts
formatRupees(paise)    // 123456789 → "₹12,34,567.89"
formatLakhs(paise)     // → "₹1.23L"
formatCrores(paise)    // → "₹1.23Cr"
formatAuto(paise)      // Auto-selects best format
parseToPaise(input)    // "₹12,34,567" → 123456700
formatDateIndian(date) // Date → "DD/MM/YYYY"

// From @/lib/utils/math.ts
sumPaise(...amounts)              // Safe sum
multiplyByPct(paise, pct)        // 10_00 × 18% = 1_80
calculatePct(part, total)        // ⚠️ DISPLAY ONLY — returns float
applyGrowth(paise, growthPct)    // Apply growth rate
isBalanced(a, b, tolerance?)     // 3-way check (±1 paise)
```

---

## 🔐 Auth Architecture

```
ClerkProvider (layout.tsx)
  └── middleware.ts (Clerk guard)
       ├── Protected: /dashboard/*, /forecast/*, /scenarios/*, /data/*,
       │              /settings/*, /reports/*, /compliance/*, /accounts/*,
       │              /api/* (except webhooks, health, import/template)
       └── Public: /, /sign-in, /sign-up, /api/health, /api/import/template
```

**Frontend must wrap in `<ClerkProvider>`.** Use `useAuth()` hook for client-side auth state.

---

## ⚡ Key Patterns to Follow

### API Client Pattern (recommended)
```typescript
// src/lib/api/client.ts
async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

### Store Pattern (recommended)
```typescript
// Replace localStorage stores with API-backed stores
const useCompanyStore = create<CompanyState>((set) => ({
  companies: [],
  activeCompanyId: null,
  async loadCompanies() {
    const { companies } = await apiGet('/api/companies')
    set({ companies, activeCompanyId: companies[0]?.id })
  },
}))
```

### Engine in Web Worker (recommended for large datasets)
```typescript
// Move engine computation off the main thread
const worker = new Worker(new URL('./engine-worker.ts', import.meta.url))
worker.postMessage({ type: 'RUN_ENGINE', options })
worker.onmessage = (e) => setEngineResult(e.data.result)
```
