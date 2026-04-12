CashFlowIQ Backend Production-Ready Plan

Overview: 7 Phases, Bottom-Up

Each phase builds on the previous. Nothing is half-built — each phase is complete and tested before moving on.

PHASE 1: Database & Auth Foundation (Day 1-2)

Goal: Clean schema with all FKs, indexes, relations. Working auth. Working middleware.

1.1 Rename src/proxy.ts → src/middleware.ts

Simple rename. Next.js will now pick up Clerk middleware automatically.
Verify protected routes work.
1.2 Rewrite src/lib/db/schema.ts

Add ALL missing foreign keys:
accounts.parentId → accounts.id ON DELETE SET NULL
complianceConfig.companyId → companies.id ON DELETE CASCADE
quickMetricsConfig.companyId → companies.id ON DELETE CASCADE
microForecastLines.accountId → accounts.id
microForecastLines.timingProfileId → timingProfiles.id
valueRules.scenarioId → scenarios.id
forecastResults.scenarioId → scenarios.id
scenarios.parentId → scenarios.id
Add ALL missing indexes:
timing_profiles.company_id
micro_forecasts.company_id
scenarios.company_id
micro_forecast_lines.micro_forecast_id
scenario_overrides.scenario_id
Add Drizzle relations() definitions for ALL FK relationships (enables with: {} joins)
Keep real for percentage columns (acceptable per GEMINI.md)
No other schema changes
1.3 Generate fresh migration

Delete drizzle/0000_dark_hawkeye.sql and drizzle/meta/
Run npx drizzle-kit generate to create a clean single migration
Run npx drizzle-kit push to apply to Turso
1.4 Fix src/lib/db/index.ts

Add error on missing TURSO_DATABASE_URL in production (process.env.NODE_ENV === 'production')
Keep local.db fallback for development only
1.5 Fix src/lib/db/company-context.ts

Remove hardcoded "Patel Engineering Works" default
Accept company name as parameter, default to "My Company"
1.6 Add Zod validation schemas

Create src/lib/db/validation.ts with createInsertSchema/createSelectSchema for all tables
Export Zod schemas for API route validation
1.7 Create src/lib/db/queries/ modules

Each file encapsulates company-isolated DB operations:

companies.ts — getCompaniesForUser(), createCompany(), updateCompany(), deleteCompany()
accounts.ts — getAccountsForCompany(), upsertAccount(), deleteAccount(), getAccountTree()
historical.ts — getActualsForCompany(), upsertActuals(), getActualsByPeriod()
forecast-config.ts — getValueRules(), upsertValueRule(), getTimingProfiles(), upsertTimingProfile(), getComplianceConfig(), upsertComplianceConfig()
forecast-results.ts — getForecastResult(), saveForecastResult()
scenarios.ts — getScenarios(), createScenario(), updateScenario(), deleteScenario(), getScenarioOverrides(), saveScenarioOverrides()
micro-forecasts.ts — move existing logic from routes into query module, add db.transaction() wrapping
All queries use db.transaction() for multi-step operations. All queries enforce company_id isolation.

PHASE 2: Engine Refactor — Explicit Parameters (Day 3-4)

Goal: Engine receives all data as function parameters. Zero mutable global reads. Delete mutation bridge.

2.1 Refactor src/lib/engine/index.ts

Current signature:

runForecastEngine(options?: ForecastEngineOptions): EngineResult
New signature:

runForecastEngine(options: {
  accounts: AccountData[];          // REQUIRED (was read from demoData)
  historicalMonths: string[];       // REQUIRED (was read from global)
  forecastMonths: string[];         // REQUIRED (was read from global)
  valueRules: Record<string, AnyValueRuleConfig>;
  timingProfiles: Record<string, AnyTimingProfileConfig>;
  microForecastItems?: ForecastMicroForecastItem[];
  baselineAdjustments?: Record<string, number>;
  complianceConfig?: ComplianceConfig;
  openingBalances?: OpeningBalances; // NEW: explicit opening BS balances
}): EngineResult
Remove ALL imports of demoData, forecastMonths, historicalMonths, demoValueRules, demoTimingProfiles
Replace 3x demoData.forEach() with accounts.forEach()
Replace forecastMonths.length with options.forecastMonths.length
Replace demoData.find(a => a.id === 'ast-1') with explicit options.openingBalances.cash parameter
Remove runFullForecastEngine (dead code)
Remove ForecastEngineOptions.activeMicroForecasts (dead code path)
Remove deriveSalaryForecast duplication — move to compliance module, import from there
2.2 Refactor src/lib/engine/scenarios/engine.ts

Remove import of demoTimingProfiles
All data comes through options parameter, passed to runForecastEngine
2.3 Delete src/lib/workspace/runtime.ts

The applyWorkspaceStateToRuntime() function is no longer needed
Delete the file entirely
2.4 Keep demo-data.ts as seed data only

demoData, demoValueRules, demoTimingProfiles remain as static seed constants
They are used ONLY by: (a) workspace-store initial defaults, (b) tests, (c) demo mode
NO runtime mutation. Export as const (deep freeze or as const)
2.5 Update all engine tests

Tests already pass explicit data to engine functions
Remove any test that relies on mutable globals
Verify all 32 existing tests still pass
2.6 Add missing engine tests

engine/index.test.ts — full orchestrator test with explicit parameters + three-way balance assertion
three-way/builder.test.ts — add edge cases: zero revenue month, all-zero inputs, negative cash allowed
timing-profiles/calculator.test.ts — add 1-paise balance reconciliation test
PHASE 3: Engine Bug Fixes (Day 5-6)

Goal: Fix all critical engine bugs identified in audit.

3.1 Implement indirect method cash flow statement

Refactor three-way/builder.ts to produce BOTH direct and indirect CF
Add OperatingCFReconciliation type:
{
  netIncome: number;
  addBackDepreciation: number;
  changesInWorkingCapital: {
    increaseInAR: number;
    increaseInAP: number;
    // ... per compliance line
  };
  operatingCF: number;
}
Cash becomes the plug: cash = totalLiabilities + totalEquity - nonCashAssets
Verify |plugCash - (prevCash + netCF)| <= 1 as sanity check
Add test: indirect method CF reconciliation matches direct method within 1 paise
3.2 Fix New Hire wizard paise violation

wizards/new-hire.ts:32-33: Replace monthlyCTC * netSalaryPct with Math.round(monthlyCTC * netSalaryPct) or use multiplyByPct(monthlyCTC, netSalaryPct * 100)
3.3 Fix TDS per-employee calculation

New approach: TDS engine receives array of EmployeeSalaryRecord[] derived from active micro-forecasts
Each record: { monthlyGross: number, basicSalary: number, esiEligible: boolean }
Calculate tax per-employee, then sum
Source: iterate microForecastItems of type hire, extract salary details from wizardConfig
3.4 Fix PF/ESI per-employee calculation

Same approach: iterate active hire micro-forecasts
Each employee checked against ₹21,000 ESI threshold individually
PF capped at ₹15,000/month basic
3.5 Fix advance tax loss-month zeroing

compliance/index.ts:252: Sum ALL monthly PBT first (including negatives), then Math.max(0, annualTotal)
Add ₹10,000 minimum threshold check
3.6 Fix GST supplyType hardcoding

Read supplyType from complianceConfig (passed through to engine)
Add supplyType to WorkspaceComplianceConfig type
3.7 Fix revenue wizard timing bypass

wizards/revenue.ts: Instead of 100% immediate cash, apply the company's default receivables timing profile
Accept timingProfile parameter in RevenueWizardInputs
3.8 Fix loan interest CF classification

overlay.ts: Split interest into financingCashOut instead of expensePaid
Three-way builder must handle financingCashOut in the financing CF section
3.9 Add tests for all fixes

Per-employee TDS test (2 employees at different slabs)
Per-employee ESI threshold test (1 above, 1 below ₹21,000)
Advance tax with loss months test
GST inter-state test
Indirect method CF reconciliation test
Revenue with timing profile test
Loan interest in financing CF test
PHASE 4: API Routes — Build All 29 Missing (Day 7-10)

Goal: Full CRUD API for every entity. All routes have auth, validation, company isolation, transactions.

Route structure (all under src/app/api/):

api/
├── companies/
│   └── route.ts          GET, POST
│   └── [id]/route.ts     PATCH, DELETE
├── accounts/
│   └── route.ts          GET (by companyId param), POST
│   └── [id]/route.ts     PATCH, DELETE
├── historical/
│   └── route.ts          GET, PATCH (bulk upsert)
├── import/
│   └── upload/route.ts   POST (file → R2)
│   └── parse/route.ts    POST (R2 file → parsed data)
│   └── save/route.ts     POST (mapped data → DB)
│   └── template/route.ts GET (download XLSX template)
├── forecast/
│   └── config/route.ts   GET (rules + profiles + compliance + metrics)
│   └── value-rules/route.ts      PATCH (upsert single rule)
│   └── timing-profiles/route.ts  PATCH (upsert single profile)
│   └── compliance/route.ts       PATCH (upsert compliance config)
│   └── metrics/route.ts          PATCH (upsert metrics config)
│   └── result/route.ts   GET, POST (cache engine output)
├── scenarios/
│   └── route.ts          GET, POST
│   └── [id]/route.ts     PATCH, DELETE
│   └── [id]/overrides/route.ts   GET, POST
├── micro-forecasts/      (already exists, needs transaction fix)
│   └── route.ts          GET, POST
│   └── [id]/route.ts     PATCH, DELETE
├── reports/
│   └── branding/route.ts GET (logo + company info)
Pattern for every route:

// 1. Auth check
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// 2. Validate input with Zod
const parsed = schema.safeParse(body);
if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });

// 3. Resolve company (ownership check)
const company = await resolveCompanyForUser(userId, companyId);
if (!company) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

// 4. Execute query with company_id isolation + transaction
const result = await db.transaction(async (tx) => { ... });

// 5. Return JSON
return NextResponse.json(result);
Key route implementations:

/api/import/upload — Receive file, validate type/size, upload to R2, return fileId /api/import/parse — Download from R2, parse Excel/CSV, detect structure, return raw data + detected mapping /api/import/save — Receive mapped data, validate P&L/BS balance, insert accounts + actuals in transaction /api/historical — Bulk upsert with conflict resolution (company_id + account_id + period unique) /api/forecast/config — Aggregate GET returning rules, profiles, compliance config, metrics config in one call /api/forecast/result — GET returns cached result, POST saves engine output for offline access

Fix existing micro-forecasts routes:

Wrap POST in db.transaction()
Wrap PATCH delete+insert in db.transaction()
Add Zod validation
Standardize ownership check to use resolveCompanyForUser
PHASE 5: Import Pipeline (Day 11-12)

Goal: End-to-end working import: upload → R2 → parse → validate → map → save → DB.

5.1 Create src/lib/standards/indian-coa.ts

Indian Schedule III lite Chart of Accounts — 40+ accounts
Categories: Revenue (5), COGS (5), OpEx (12), Assets (8), Liabilities (7), Equity (3)
Each account: { id, name, code, accountType, category, aliases[] }
Aliases for common Indian names: "Sundry Debtors" → AR, "Staff Cost" → Salaries, etc.
5.2 Fix src/lib/import/structure-detector.ts

Fix parseIndianNumberString:
Replace lower.includes('cr') with word-boundary regex /\bcr(ore)?s?\b/i
Replace lower.includes('l') with /\bl(akh)?s?\b/i
Add return value in paise (currently returns rupees)
Fix detectStructure for multi-sheet support (P&L sheet + BS sheet)
5.3 Expand src/lib/import/account-mapper.ts

Replace 8-account STANDARD_ACCOUNT_OPTIONS with import from indian-coa.ts
Add category-aware matching (use sheet context to disambiguate)
Add "unmapped" category handling (create custom account if no match)
5.4 Wire src/lib/import/validator.ts

Call validateHistoricalStatement() in the import save API route
Return specific errors to frontend (P&L doesn't balance, BS doesn't balance, etc.)
5.5 Wire src/lib/r2.ts

Use in /api/import/upload to store original file
Use in /api/import/parse to retrieve file for parsing
Add file size validation (10MB max)
Add presigned URL for secure access
5.6 Create downloadable template

Create public/templates/cashflowiq-template.xlsx with pre-formatted P&L + BS sheets
Header row with month labels, account name column, standard account codes
Served via /api/import/template
PHASE 6: Store → API Migration (Day 13-14)

Goal: All stores read/write from API instead of localStorage. Workspace data survives browser clear.

6.1 Refactor useWorkspaceStore

Remove zustand/persist middleware (no more localStorage)
Replace with React Query / server state pattern:
useWorkspace() hook fetches from /api/forecast/config
Mutations call PATCH endpoints for value rules, timing profiles, compliance config
Optimistic updates with rollback on API failure
Cache in React Query (not localStorage)
6.2 Refactor useScenarioStore

Remove zustand/persist
Read/write via /api/scenarios endpoints
Keep Zustand only for UI state (selected scenario, sidebar open)
6.3 Refactor useMicroForecastStore

Already API-connected — just fix the forecastMonths import
Remove import { forecastMonths } from '@/lib/demo-data'
Pass months explicitly from workspace store
6.4 Refactor useCurrentForecast

Pass accounts, historicalMonths, forecastMonths explicitly to runScenarioForecastEngine
Remove dependency on engineVersion hack
Add error boundary: try/catch around engine call, return error state
Add isEngineError flag to return type
6.5 Delete src/lib/workspace/runtime.ts

Already done in Phase 2, confirming here
6.6 Add workspace hydration on app load

New hook useWorkspaceHydration() that:
Calls /api/companies to get user's companies
Calls /api/accounts, /api/historical, /api/forecast/config for active company
Populates Zustand store with server data
Sets ready = true when all data loaded
PHASE 7: Testing & Hardening (Day 15-16)

Goal: Every component tested. Every edge case covered. Production-ready.

7.1 API integration tests

Test every route with valid auth, invalid auth, wrong company, invalid input
Test transaction rollback on failure
Test concurrent writes
7.2 Engine end-to-end test

Full pipeline: demo data → engine → compliance → three-way balance assertion
Full pipeline: imported data → engine → compliance → three-way balance assertion
7.3 Import pipeline test

Parse real Excel file → detect structure → map accounts → validate → save to DB
Test with Indian number formats (lakhs, crores, ₹ symbols)
Test with corrupted files, missing sheets, empty data
7.4 Performance test

100 accounts × 24 months = 2,400 values through engine
Verify < 100ms in browser
Verify API response < 500ms for full config load
7.5 Security audit

Verify company_id isolation on every route
Verify no IDOR vulnerabilities (can't access another company's data)
Verify input sanitization (no SQL injection via Zod validation)
Verify file upload security (type, size, malware scan consideration)
Summary Timeline

Phase	Days	Deliverable
1. DB & Auth Foundation	1-2	Clean schema, FKs, indexes, relations, query modules, middleware working
2. Engine Refactor	3-4	Engine accepts explicit params, no mutable globals, mutation bridge deleted
3. Engine Bug Fixes	5-6	Indirect CF, per-employee TDS/ESI, paise violations, all 9 bugs fixed
4. API Routes	7-10	All 29 missing routes built, Zod validation, transactions, auth
5. Import Pipeline	11-12	Indian CoA (40+ accounts), fixed parser, R2 wired, validator wired
6. Store → API Migration	13-14	All stores read/write from API, no localStorage for business data
7. Testing & Hardening	15-16	Integration tests, edge cases, performance, security
Total: ~16 working days. After this, backend is production-ready. Then we redesign frontend.

