# CashFlowIQ — Architecture

Three-way financial forecasting for Indian SMEs and CAs. Uploads P&L + Balance Sheet → generates 12-month integrated P&L, Balance Sheet, Cash Flow + GST/TDS/PF/ESI compliance.

**Stack:** Next.js 16 (App Router) · TypeScript · Drizzle ORM + Turso (libSQL/SQLite) · Clerk auth · Cloudflare R2 · Zustand (8 stores) · Recharts · Tailwind CSS v4

---

## Directory Structure

```
src/
├── app/
│   ├── (marketing)/        Public landing page
│   ├── (auth)/             Clerk sign-in / sign-up
│   ├── (app)/              All authenticated pages
│   └── api/                API route handlers
├── components/
│   ├── layout/             AppShell, AppSidebar, AppTopbar
│   ├── shared/             PageHeader, Toast, skeletons
│   ├── dashboard/          MetricCards, CashRunwayChart, ComplianceWidget
│   ├── forecast/           ForecastGrid, ViewSwitcher, AccountRuleEditor,
│   │                       MicroForecastWizard, SensitivityPanel
│   └── ui/                 Shadcn primitives
├── stores/                 8 Zustand stores (all API-backed)
├── hooks/                  useCompanyContext, useCurrentForecast, useFormatCurrency
└── lib/
    ├── engine/             Core forecast engine (pure function)
    ├── db/                 Drizzle schema + queries
    ├── import/             Excel/CSV parsing pipeline
    ├── reports/            PDF generator (jsPDF)
    ├── api/                Fetch helpers + server response helpers
    └── utils/              indian-format, math, date-utils
```

---

## Pages

| Route | Purpose |
|-------|---------|
| `/dashboard` | Cash position, runway chart, 4 metric cards, compliance due-dates |
| `/forecast` | Three-way grid (P&L/BS/CF/Drivers/Variance), scenario selector, sensitivity panel, account rule editor, business events strip |
| `/data` | Excel/CSV import pipeline |
| `/accounts` | Chart of Accounts editor |
| `/compliance` | GST/TDS/PF/ESI calendar + GST filing tracker |
| `/scenarios` | Scenario manager with per-account % overrides |
| `/reports` | PDF report generation |
| `/reconciliation` | Bank reconciliation status |
| `/firm` | CA multi-company portfolio dashboard |
| `/settings` | Company settings, compliance config, branding |

---

## API Routes

### Companies
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/companies` | List all companies. Auto-creates default if none. |
| POST | `/api/companies` | Create company |
| PATCH | `/api/companies/[id]` | Update company |
| DELETE | `/api/companies/[id]` | Delete company (cascades all data) |
| PATCH | `/api/companies/[id]/lock-period` | Lock/unlock a forecast period as actual |
| POST | `/api/companies/[id]/members` | Invite team member |

### Forecast
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/forecast/config?companyId=` | Fetch all config: accounts, actuals, valueRules, timingProfiles, complianceConfig |
| PATCH | `/api/forecast/config/value-rule` | Upsert value rule for one account |
| PATCH | `/api/forecast/config/timing-profile` | Upsert timing profile |
| PATCH | `/api/forecast/config/compliance` | Update GST/TDS/PF settings |
| GET/POST | `/api/forecast/result` | Get/save cached engine result. POST auto-populates GST filings. |

### Data
| Method | Path | Description |
|--------|------|-------------|
| GET/PATCH | `/api/historical` | Get/bulk-upsert monthly actuals (amounts in paise) |
| GET/POST/PATCH/DELETE | `/api/coa` | Chart of Accounts CRUD |
| POST | `/api/import/upload` | Upload file to R2 (max 10MB, xlsx/xls/csv) |
| POST | `/api/import/parse` | Parse uploaded file, return preview |
| POST | `/api/import/save` | Persist parsed accounts + actuals to DB |
| POST | `/api/import/seed-demo` | Seed Indian manufacturing demo data |

### Features
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PATCH/DELETE | `/api/scenarios` | Scenario CRUD |
| GET/POST/PATCH/DELETE | `/api/micro-forecasts` | Business events CRUD |
| GET/POST | `/api/gst-filings` | GST filing status tracker |
| PATCH | `/api/gst-filings/[id]` | Mark filing as filed |
| GET/PATCH | `/api/reconciliations` | Bank reconciliation records |
| GET | `/api/firm/companies` | CA portfolio — all companies with cached metrics |
| POST | `/api/reports/generate` | Generate PDF from cached forecast result |
| GET | `/api/reports/download` | Download generated PDF |
| GET/POST | `/api/compliance/payments` | Server-side compliance paid status |
| GET/POST | `/api/notifications` | Notification feed |

---

## Zustand Stores

| Store | Loads from | Key state |
|-------|-----------|-----------|
| `useCompanyStore` | `/api/companies` | `companies[]`, `activeCompanyId`, `activeCompany()` |
| `useAccountsStore` | `/api/coa` | `accounts[]` |
| `useActualsStore` | `/api/historical` | `actuals[]`, `historicalMonths[]`, `getHistoricalValues(id)` |
| `useForecastConfigStore` | `/api/forecast/config` | `valueRules`, `timingProfiles`, `complianceConfig` |
| `useMicroForecastStore` | `/api/micro-forecasts` | `items[]` |
| `useScenarioStore` | `/api/scenarios` | `scenarios[]`, `selectedScenarioId`, `selectedScenario()` |
| `useUIStore` | — (UI only) | `sidebarCollapsed`, `toast`, `activeModal` |

All stores are loaded by `useCompanyContext` when `activeCompanyId` changes.

---

## Engine Pipeline (`src/lib/engine/`)

Entry: `runForecastEngine(options)` → `EngineResult`  
Scenario wrapper: `runScenarioForecastEngine(...)` in `src/lib/engine/scenarios/engine.ts`

**Steps:**
1. **Value Rules** — per account: `rolling_avg`, `growth`, `direct_entry`, `same_last_year`, `baseline_adjustment`
2. **Timing Profiles** — convert accrual → cash: `receivables` (AR lag), `payables` (AP lag), `deferred`, `prepaid`
3. **Monthly Inputs** — aggregate into `{ revenue, cashIn, cogs, cogsPaid, expense, expensePaid }[]`
4. **Micro-Forecast Overlay** — add business events (hires, assets, loans, revenue streams)
5. **Three-Way Integration** — `runThreeWayIntegration()` → per-month P&L + BS + CF. Invariant: `totalAssets === totalLiabilities + totalEquity`
6. **Compliance Engine** — GST (output tax − ITC), TDS (salary/contractor), PF/ESI (12%/3.25%), Advance Tax (quarterly installments)

**Engine is pure** — no DB calls inside. All data passed as explicit parameters.

---

## Database Schema (14 tables, Turso/libSQL)

All monetary values: **integer paise**. All periods: **YYYY-MM-01**. All IDs: UUID.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `companies` | `id`, `clerkUserId`, `name`, `pan`, `gstin`, `fyStartMonth`, `lockedPeriods` | One user → many companies |
| `accounts` | `id`, `companyId`, `name`, `accountType`, `standardMapping`, `sortOrder` | `accountType`: revenue/expense/asset/liability/equity |
| `monthly_actuals` | `id`, `companyId`, `accountId`, `period`, `amount` | Unique on `(companyId, accountId, period)` |
| `scenarios` | `id`, `companyId`, `name`, `parentId`, `isActive` | Supports inheritance |
| `scenario_overrides` | `id`, `scenarioId`, `targetType`, `targetId`, `config` | `targetType`: value_rule/timing_profile/micro_toggle |
| `value_rules` | `id`, `companyId`, `accountId`, `scenarioId`, `ruleType`, `config` | Unique on `(companyId, accountId, scenarioId)` |
| `timing_profiles` | `id`, `companyId`, `name`, `profileType`, `config` | Unique on `(companyId, name)` |
| `micro_forecasts` | `id`, `companyId`, `name`, `category`, `isActive`, `startMonth`, `wizardConfig` | |
| `micro_forecast_lines` | `id`, `microForecastId`, `accountId`, `config` | Maps wizard output to accounts |
| `compliance_config` | `id`, `companyId`, `gstRate`, `itcPct`, `taxRate`, `pfApplicable`, `esiApplicable` | One per company |
| `forecast_results` | `id`, `companyId`, `scenarioId`, `plData`, `bsData`, `cfData`, `compliance`, `metrics` | Cached engine output (JSON) |
| `gst_filings` | `id`, `companyId`, `period`, `returnType`, `status`, `dueDate`, `amountPaise` | Auto-populated on forecast save |
| `bank_reconciliations` | `id`, `companyId`, `period`, `status`, `bookClosingBalancePaise`, `bankClosingBalancePaise`, `variancePaise` | |
| `company_members` | `id`, `companyId`, `clerkUserId`, `role`, `acceptedAt` | Multi-user team sharing |
| `compliance_payments` | `id`, `companyId`, `obligationId`, `paidAt` | Server-side paid status |

---

## Auth Patterns

All routes use Clerk. Three patterns:

- **`resolveAuthedCompany(request)`** — used by most routes. Reads `companyId` from `?companyId=` or `x-company-id` header. Verifies ownership or membership.
- **`requireOwnedCompany(userId, companyId)`** — strict owner-only check. Used by company CRUD.
- **`requireUserId()`** — bare auth check. Used by GET /api/companies and import template.

---

## Key Invariants

1. Every DB write verifies `clerkUserId` ownership
2. All monetary values are integer paise — never rupees in DB or engine
3. Period format is always `YYYY-MM-01`
4. Engine is pure — no DB calls inside `runForecastEngine()`
5. `totalAssets === totalLiabilities + totalEquity` after every integration
6. OAuth tokens encrypted at rest (AES-256-GCM via `@noble/ciphers`)
