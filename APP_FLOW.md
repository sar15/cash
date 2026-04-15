# CashFlowIQ — App Flow

## Frontend → Backend Data Flow

```
Clerk Auth
    │
    ▼
useCompanyContext (hook)
    │  on activeCompanyId change, fires in parallel:
    ├─ useAccountsStore.load()        → GET /api/coa
    ├─ useActualsStore.load()         → GET /api/historical
    ├─ useForecastConfigStore.load()  → GET /api/forecast/config
    ├─ useScenarioStore.load()        → GET /api/scenarios
    └─ useMicroForecastStore.load()   → GET /api/micro-forecasts
                │
                ▼
        useCurrentForecast (hook)
            │  useMemo — runs when any store changes
            │  1. Map accounts → AccountInput[]
            │  2. Derive OpeningBalances from latest actuals
            │  3. Build effective value rules (fill gaps with rolling_avg/same_last_year)
            │  4. Build ScenarioDefinition from selected scenario overrides
            │  5. runScenarioForecastEngine() → EngineResult
            │  6. Debounced 800ms: POST /api/forecast/result (cache to DB)
            │     └─ auto-populates GST filings (fire-and-forget)
            ▼
        EngineResult → ForecastGrid, Dashboard, Compliance page
```

---

## Page Flows

### First-Time Setup
```
Sign up (Clerk) → auto-create default company
    → /forecast shows upload prompt
    → Upload Excel/CSV → POST /api/import/upload (→ R2)
    → POST /api/import/parse (preview)
    → POST /api/import/save (accounts + actuals to DB)
    → stores reload → engine runs → forecast grid renders
```

### Forecast Page (`/forecast`)
```
Load: useCompanyContext → all stores → useCurrentForecast → ForecastGrid

Views (keyboard shortcuts):
  P → P&L     B → Balance Sheet     C → Cash Flow
  D → Drivers  V → Variance          S → Sensitivity panel

Cell edit:
  Click cell → inline input → blur/Enter
  → updateValueRule() → PATCH /api/forecast/config/value-rule
  → store updates → engine re-runs → grid re-renders

Add event (N):
  MicroForecastWizard modal → fill wizard steps
  → addHire/addRevenue/etc() → POST /api/micro-forecasts
  → store updates → engine re-runs

Scenario compare:
  "Compare Scenarios" toggle → scenarioResults useMemo
  → runs engine for each scenario (up to 3) client-side
  → ForecastGrid compare mode: baseline + scenarios side-by-side with Δ columns

Sensitivity (S):
  SensitivityPanel opens as right panel
  → sliders for revenue growth %, expense growth %, collection days, payment days
  → re-runs engine with adjusted direct_entry overrides
  → shows impact on closing cash, net income, runway
  → read-only, never persists

Lock period:
  Lock icon in column header → PATCH /api/companies/[id]/lock-period
  → company reloads → lockedPeriods updated → grid shows grey column
```

### Compliance Page (`/compliance`)
```
Load: useCurrentForecast → engineResult.compliance
    + GET /api/gst-filings (filing status)
    + GET /api/compliance/payments (paid status)

Month navigator → shows GST/TDS/PF/ESI obligations for selected month
Mark paid → POST /api/compliance/payments (server-side, also localStorage fallback)
GST filing tracker → PATCH /api/gst-filings/[id] to mark as filed
```

### Reports Page (`/reports`)
```
Select period → click Generate
    → POST /api/reports/generate
        → GET forecast_results from DB (cached engine output)
        → GET accounts from DB
        → generatePDFReport() (jsPDF, server-side)
        → uploadFile() → R2 (or local fallback)
        → return downloadUrl
    → window.open(downloadUrl)
    → GET /api/reports/download → streams PDF
```

### CA Firm View (`/firm`)
```
Load: GET /api/firm/companies
    → getFirmCompanies(userId)
        → owned companies + member companies (deduplicated)
        → for each: read forecast_results cache (no engine re-run)
            → cashRunwayMonths from OCF burn rate
            → netIncome from cached metrics
            → complianceHealth from gst_filings (overdue/pending)
    → card grid with sort + filter
```

---

## State Management

```
Zustand stores (client state, API-backed):
  useCompanyStore      → companies, activeCompanyId
  useAccountsStore     → accounts[]
  useActualsStore      → actuals[], historicalMonths[], getHistoricalValues()
  useForecastConfigStore → valueRules, timingProfiles, complianceConfig
  useMicroForecastStore  → items[]
  useScenarioStore     → scenarios[], selectedScenarioId
  useUIStore           → sidebarCollapsed, toast (UI only)

Derived (useMemo in hooks):
  useCurrentForecast   → engineResult, forecastMonths, isReady, hasAccounts
```

---

## Backend Request Lifecycle

```
Request arrives
    │
    ▼
Clerk middleware (src/middleware.ts)
    → verifies session token
    → rate limiting (100 req/min, 10/hr import)
    │
    ▼
Route handler (src/app/api/...)
    │
    ├─ resolveAuthedCompany(request)
    │   → auth() → userId
    │   → read companyId from ?companyId= or x-company-id header
    │   → verify ownership (companies.clerkUserId === userId)
    │     OR membership (company_members table)
    │   → return { userId, companyId }
    │
    ├─ Zod validation on request body
    │
    ├─ Drizzle query (Turso/libSQL)
    │
    └─ jsonOk({ data }) or jsonError('message', status)
```

---

## Import Pipeline

```
1. POST /api/import/upload
   → validate MIME type + size (max 10MB)
   → uploadFile() → R2 bucket (or .local-uploads/ in dev)
   → return { fileKey }

2. POST /api/import/parse
   → getFile(fileKey) from R2
   → xlsx.read() → detect sheets, headers, data
   → auto-map account names to Indian CoA standard mappings
   → return { accounts[], months[], data[][] }

3. POST /api/import/save
   → upsert accounts (by name, company-scoped)
   → bulk upsert monthly_actuals (max 5000 rows)
   → amounts must be integer paise
   → periods must be YYYY-MM-01
   → return { createdAccounts, savedActuals }
```

---

## Engine ↔ Compliance Data Flow

```
runForecastEngine()
    │
    ├─ accountForecasts: Record<accountId, number[]>  ← paise per month
    ├─ rawIntegrationResults: ThreeWayMonth[]          ← pre-compliance
    ├─ integrationResults: ComplianceAdjustedMonth[]   ← post-compliance
    ├─ forecastMonths: string[]                        ← ['2025-04-01', ...]
    ├─ compliance: ComplianceResult
    │   ├─ gst.months[].netPayable                    ← paise
    │   ├─ tds.months[].salaryTDS                     ← paise
    │   ├─ pfEsi.months[].employerPF/employeeESI      ← paise
    │   └─ advanceTax.installments[].installmentAmount ← paise
    └─ salaryForecast: number[]                        ← paise per month

POST /api/forecast/result (debounced 800ms)
    → saves to forecast_results table
    → triggers populateGSTFilings() (fire-and-forget)
        → upserts gst_filings rows for each month with GST payable
        → sets status: 'pending' or 'overdue' based on today vs due date
```
