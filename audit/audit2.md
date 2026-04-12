Now I have all the information needed. Here is the comprehensive audit report.

---

# CashFlowIQ Database Layer Audit Report

## 1. FILES EXAMINED

| File | Path | Status |
|------|------|--------|
| Schema | `/Users/sarhanak/Documents/CashFlowIQ/src/lib/db/schema.ts` | 179 lines, 12 tables |
| Migration | `/Users/sarhanak/Documents/CashFlowIQ/drizzle/0000_dark_hawkeye.sql` | 155 lines, single migration |
| Drizzle Config | `/Users/sarhanak/Documents/CashFlowIQ/drizzle.config.ts` | 14 lines |
| DB Connection | `/Users/sarhanak/Documents/CashFlowIQ/src/lib/db/index.ts` | 12 lines |
| Company Context | `/Users/sarhanak/Documents/CashFlowIQ/src/lib/db/company-context.ts` | 44 lines |
| Queries Directory | `src/lib/db/queries/` | **DOES NOT EXIST** |
| API Routes (only ones) | `src/app/api/micro-forecasts/route.ts` and `[id]/route.ts` | 2 routes only |

---

## 2. TABLE COUNT vs PRD2 SPEC

**PRD2 specifies 12 tables. The schema defines 12 table objects. Match is correct.**

| # | PRD2 Table | Schema Table | Status |
|---|-----------|-------------|--------|
| 1 | companies | `companies` | Present |
| 2 | users | `companies` (Clerk replaces) | **Intentionally omitted** -- schema comment says "Clerk manages users" |
| 3 | accounts | `accounts` | Present |
| 4 | monthly_actuals | `monthlyActuals` | Present |
| 5 | value_rules | `valueRules` | Present |
| 6 | timing_profiles | `timingProfiles` | Present |
| 7 | micro_forecasts | `microForecasts` | Present |
| 8 | micro_forecast_lines | `microForecastLines` | Present |
| 9 | scenarios | `scenarios` | Present |
| 10 | scenario_overrides | `scenarioOverrides` | Present |
| 11 | compliance_config | `complianceConfig` | Present |
| 12 | forecast_results | `forecastResults` | Present |
| -- | quick_metrics_config | `quickMetricsConfig` | Present (PRD2 also defines this) |

**Verdict: All 12 PRD2 tables are present. The `users` table was correctly replaced by Clerk. The schema actually has 12 Drizzle table objects matching the PRD2 count.**

---

## 3. MONETARY COLUMNS AUDIT (Paise Requirement)

**GEMINI.md Rule 1: ALL monetary values MUST be stored as INTEGER PAISE.**

| Table | Monetary Column | Type | Compliant? |
|-------|----------------|------|-----------|
| `monthlyActuals` | `amount` | `integer` | YES -- comment explicitly says "IN PAISE" |
| `complianceConfig` | `gstRate` | `real` | ACCEPTABLE -- this is a percentage (18.0), not money |
| `complianceConfig` | `itcPct` | `real` | ACCEPTABLE -- percentage (85.0%) |
| `complianceConfig` | `taxRate` | `real` | ACCEPTABLE -- percentage (25.17%) |

**All monetary columns that represent actual money are `integer`. The `real` columns are percentages/rates, not monetary amounts, which is acceptable.** The schema even has a comment on line 139: `// Percentage, not money -- REAL is fine`.

**Verdict: PASS.** However, there is one concern: the `quick_metrics_config.threshold` column is stored as JSON text (`text` type). If thresholds contain monetary values (e.g., `"min": 500000` for cash_on_hand), the PRD2 shows them in paise already. The developer must ensure threshold monetary values are also stored in paise.

---

## 4. MISSING COLUMNS vs PRD2

| Table | PRD2 Column | Schema Column | Status |
|-------|-----------|--------------|--------|
| `companies` | `user_id` | `clerkUserId` (clerk_user_id) | **Intentionally different** -- Clerk replaces custom auth |
| `companies` | `FOREIGN KEY (user_id) REFERENCES users(id)` | No FK to users | **Correct** -- no users table |
| `accounts` | `FOREIGN KEY (parent_id) REFERENCES accounts(id) ON DELETE SET NULL` | `parentId` has NO FK reference at all | **BUG -- Missing FK** |
| `scenarios` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` | Has FK with cascade | OK |
| `scenarios` | No index on company_id | No index | **Missing index** |
| `scenario_overrides` | No index on scenario_id | No index | **Missing index** |
| `micro_forecasts` | No index on company_id | No index | **Missing index** |
| `micro_forecast_lines` | No index on micro_forecast_id | No index | **Missing index** |
| `compliance_config` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` | Has `.unique()` but **NO FK** to companies | **BUG -- Missing FK** |
| `quick_metrics_config` | `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` | Has `.unique()` but **NO FK** to companies | **BUG -- Missing FK** |
| `micro_forecast_lines` | `account_id` nullable FK | `accountId` nullable but **NO FK reference** | **Missing FK** |
| `micro_forecast_lines` | `timing_profile_id` nullable FK | `timingProfileId` nullable but **NO FK reference** | **Missing FK** |
| `value_rules` | `scenario_id` FK reference | `scenarioId` but **NO FK reference** to scenarios | **Missing FK** |
| `forecast_results` | `scenario_id` FK reference | `scenarioId` but **NO FK reference** to scenarios | **Missing FK** |
| `scenarios` | `parent_id` FK to scenarios | `parentId` but **NO FK reference** | **Missing FK** |

**Verdict: Multiple missing foreign keys. See Section 5 for details.**

---

## 5. FOREIGN KEY & CASCADE AUDIT

### 5a. Foreign Keys Present and Correct

| From Table | From Column | To Table | To Column | onDelete | Status |
|-----------|-----------|---------|----------|---------|--------|
| accounts | company_id | companies | id | CASCADE | OK |
| monthlyActuals | company_id | companies | id | CASCADE | OK |
| monthlyActuals | account_id | accounts | id | CASCADE | OK |
| valueRules | company_id | companies | id | CASCADE | OK |
| valueRules | account_id | accounts | id | CASCADE | OK |
| timingProfiles | company_id | companies | id | CASCADE | OK |
| microForecasts | company_id | companies | id | CASCADE | OK |
| scenarios | company_id | companies | id | CASCADE | OK |
| forecastResults | company_id | companies | id | CASCADE | OK |
| microForecastLines | micro_forecast_id | microForecasts | id | CASCADE | OK |
| scenarioOverrides | scenario_id | scenarios | id | CASCADE | OK |

### 5b. Foreign Keys MISSING (Critical)

| From Table | From Column | Should Reference | PRD2 Says | Severity |
|-----------|-----------|-----------------|-----------|----------|
| **accounts** | parent_id | accounts(id) ON DELETE SET NULL | YES | **HIGH** -- Self-referential FK missing. Orphaned parent_id values possible. |
| **compliance_config** | company_id | companies(id) ON DELETE CASCADE | YES | **HIGH** -- No cascade, orphaned rows when company deleted. |
| **quick_metrics_config** | company_id | companies(id) ON DELETE CASCADE | YES | **HIGH** -- No cascade, orphaned rows when company deleted. |
| **micro_forecast_lines** | account_id | accounts(id) | YES (nullable) | **MEDIUM** -- Data integrity risk. |
| **micro_forecast_lines** | timing_profile_id | timing_profiles(id) | YES (nullable) | **MEDIUM** -- Data integrity risk. |
| **value_rules** | scenario_id | scenarios(id) | YES (nullable) | **MEDIUM** -- Orphaned scenario refs possible. |
| **forecast_results** | scenario_id | scenarios(id) | YES (nullable) | **MEDIUM** -- Orphaned scenario refs possible. |
| **scenarios** | parent_id | scenarios(id) | YES (nullable) | **LOW** -- Self-referential for scenario hierarchy. |

**Verdict: 8 missing foreign keys, 3 of which are HIGH severity. Deleting a company will leave orphaned rows in `compliance_config` and `quick_metrics_config`.**

---

## 6. INDEX AUDIT

### 6a. Indexes Present

| Table | Index Name | Columns | Unique? | Justified? |
|-------|-----------|---------|---------|-----------|
| companies | idx_companies_user | clerk_user_id | No | YES -- lookup company by user |
| accounts | idx_accounts_company | (company_id, sort_order) | No | YES -- list accounts for company |
| monthlyActuals | idx_actuals_unique | (company_id, account_id, period) | Yes | YES -- prevent duplicates |
| monthlyActuals | idx_actuals_company_period | (company_id, period) | No | YES -- query by time range |
| valueRules | idx_value_rules_unique | (company_id, account_id, scenario_id) | Yes | YES -- prevent duplicates |
| forecastResults | idx_forecast_company_scenario | (company_id, scenario_id) | No | YES -- lookup results |
| compliance_config | compliance_config_company_id_unique | company_id | Yes | YES -- one config per company |
| quick_metrics_config | quick_metrics_config_company_id_unique | company_id | Yes | YES -- one config per company |

### 6b. Missing Indexes (Performance Risk)

| Table | Missing Index On | Query Pattern Affected | Severity |
|-------|-----------------|----------------------|----------|
| **timing_profiles** | company_id | Listing profiles for a company | **HIGH** -- full table scan |
| **micro_forecasts** | company_id | Listing forecasts for a company | **HIGH** -- full table scan |
| **scenarios** | company_id | Listing scenarios for a company | **HIGH** -- full table scan |
| **micro_forecast_lines** | micro_forecast_id | Joining lines to forecasts | **HIGH** -- the GET route in `micro-forecasts/route.ts` does `inArray(mfl.microForecastId, forecastIds)` without an index |
| **scenario_overrides** | scenario_id | Loading overrides for a scenario | **MEDIUM** |
| **value_rules** | account_id (standalone) | Looking up rules by account | **LOW** -- covered by composite unique index |

**Verdict: 5 missing indexes, 4 of which are HIGH severity. As data grows, queries for timing_profiles, micro_forecasts, scenarios, and micro_forecast_lines by company_id will degrade significantly.**

---

## 7. COMPANY_ID ISOLATION AUDIT

**GEMINI.md / PRD2 requirement: Every DB query MUST include `WHERE company_id = ?`.**

### 7a. Schema Level
All company-scoped tables correctly have `company_id NOT NULL`. This is good.

### 7b. Query Level (API Routes)

**The only API routes that exist are `micro-forecasts`.** All other API routes from the PRD2 spec (companies, coa, historical, forecast/config, scenarios, forecast/result, reports) are **not yet built**.

| Route | File | Company Isolation | Notes |
|-------|------|------------------|-------|
| GET /api/micro-forecasts | route.ts:36-42 | **PASS** | Uses `resolveCompanyForUser()` then `eq(schema.microForecasts.companyId, company.id)` |
| POST /api/micro-forecasts | route.ts:78-85 | **PASS** | Uses `resolveCompanyForUser()` then sets `companyId: company.id` |
| PATCH /api/micro-forecasts/[id] | [id]/route.ts:40-52 | **WEAK PASS** | Verifies ownership by fetching forecast, then fetching company by `forecast.companyId`, then checking `company.clerkUserId !== userId`. **Two extra queries instead of a single filtered query.** |
| DELETE /api/micro-forecasts/[id] | [id]/route.ts:100-114 | **WEAK PASS** | Same pattern as PATCH -- two extra queries for ownership check. |

### 7c. Isolation Pattern Problems

1. **PATCH/DELETE use indirect ownership check**: They first fetch the micro-forecast by ID, then look up the company from `forecast.companyId`, then check `company.clerkUserId !== userId`. This is correct but inefficient (3 queries instead of 1). A single query joining micro_forecasts to companies would be safer and faster.

2. **No helper middleware**: There is no reusable function like `verifyOwnership(resourceType, resourceId, userId)` that enforces company isolation consistently. Each route re-implements the pattern.

3. **Missing API routes = missing isolation**: The following PRD2-specified routes do not exist at all, meaning no isolation enforcement for their data:
   - `/api/companies` (CRUD)
   - `/api/coa/:companyId` (accounts CRUD)
   - `/api/historical/:companyId` (actuals CRUD)
   - `/api/forecast/config/:companyId` (rules, profiles, compliance, micros, scenarios)
   - `/api/scenarios/:companyId` (CRUD)
   - `/api/forecast/result/:companyId` (save/load results)
   - `/api/import/*` (upload, parse, save)

**Verdict: Existing routes correctly enforce company isolation, but the pattern is verbose and not DRY. Most API routes are missing entirely.**

---

## 8. SCHEMA MIGRATION ANALYSIS

### 8a. Current State
- Only **1 migration** exists: `0000_dark_hawkeye.sql`
- Journal confirms single entry
- Snapshot matches the schema file

### 8b. Migration Issues

1. **Missing FKs in migration match missing FKs in schema**: The migration SQL correctly reflects the schema -- but the schema itself is missing FKs (see Section 5b). A new migration will be needed to add them.

2. **Schema drift risk**: Since the missing FKs and indexes are not in the initial migration, adding them requires a new migration. However, SQLite has limited `ALTER TABLE` support -- it cannot add foreign keys to existing columns. To add missing FKs, you would need to:
   - Create new tables with FKs
   - Copy data
   - Drop old tables
   - Rename new tables
   
   This is a well-known SQLite limitation that Drizzle Kit handles via its migration generator.

3. **No seed scripts found**: There is no `seed.ts` or similar file for populating initial data (e.g., default compliance config, standard Indian CoA template).

**Verdict: Migration system is functional but the initial schema has gaps that will require careful migration to fix.**

---

## 9. DRIZZLE ORM USAGE AUDIT

### 9a. Correct Usage

- Import from `drizzle-orm/sqlite-core` -- correct for Turso/SQLite
- Uses `sqliteTable`, `text`, `integer`, `real` -- correct
- Uses `sql` template for defaults like `datetime('now')` -- correct
- Uses `$defaultFn(() => crypto.randomUUID())` for ID generation -- correct
- Uses `index()` and `uniqueIndex()` builders -- correct
- Uses relational query API (`db.query.table.findMany`) -- correct
- Uses `drizzle-orm/libsql` driver -- correct for Turso

### 9b. Issues Found

1. **`real` type usage on `complianceConfig`**: While these are percentages (not money), using `real` for rates that participate in calculations (like GST rate * amount in paise) could introduce floating point errors. Consider storing rates as basis points in integer (e.g., 18.0% = 1800 basis points). This is a **minor** concern since these rates are used in the client-side engine, not in SQL arithmetic.

2. **No Zod/validation schemas alongside DB schemas**: The Drizzle schema defines DB shape, but there are no corresponding Zod schemas for API input validation (the API routes use raw TypeScript interfaces instead of `createInsertSchema`/`createSelectSchema` from Drizzle).

3. **No relations defined**: The schema file does not define Drizzle `relations()` objects. This means the relational query API (`db.query.table.findMany({ with: { ... } })`) cannot auto-join related tables. This is why the micro-forecasts GET route has to do 2 separate queries (forecasts, then lines) and manually join them in JavaScript.

**Verdict: Drizzle is used correctly at a basic level, but missing `relations()` definitions and Zod schemas limit its power.**

---

## 10. N+1 QUERY AUDIT

### 10a. Micro-Forecasts GET Route (route.ts:41-53)

```typescript
// Query 1: Fetch all forecasts for company
const forecasts = await db.query.microForecasts.findMany({
  where: eq(schema.microForecasts.companyId, company.id),
});

// Query 2: Fetch all lines for those forecasts
const lines = await db.query.microForecastLines.findMany({
  where: (mfl, { inArray }) => inArray(mfl.microForecastId, forecastIds)
});
```

**This is actually a GOOD pattern** -- it avoids N+1 by batching the lines query with `inArray`. However, it could be a single query if Drizzle `relations()` were defined, allowing `with: { lines: true }`.

### 10b. Micro-Forecasts PATCH Route ([id]/route.ts:40-83)

```
Query 1: db.query.microForecasts.findFirst (fetch forecast)
Query 2: db.query.companies.findFirst (fetch company for ownership check)
Query 3: db.update(schema.microForecasts) (update forecast)
Query 4: db.delete(schema.microForecastLines) (delete old lines)
Query 5: db.insert(schema.microForecastLines) (insert new lines)
Query 6: db.query.microForecastLines.findMany (fetch final lines)
```

**6 queries for a single PATCH.** This could be reduced to 3-4 with proper join queries for the ownership check and relations.

### 10c. Company Context (company-context.ts)

```typescript
const existingCompany = await db.query.companies.findFirst({
  where: eq(schema.companies.clerkUserId, clerkUserId),
});
```

This is fine -- single query, indexed.

**Verdict: No classic N+1 problem, but the PATCH route is query-heavy. Missing `relations()` definitions prevent more efficient joined queries.**

---

## 11. CONNECTION POOL & ERROR HANDLING AUDIT

### 11a. Connection Setup (`src/lib/db/index.ts`)

```typescript
const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export const db = drizzle(client, { schema })
```

**Issues:**

1. **No connection pool configuration**: The `@libsql/client` createClient does not accept pool configuration. Turso/libsql handles HTTP connection pooling internally on the server side. This is acceptable for Turso's architecture.

2. **No error handling on connection**: If `TURSO_DATABASE_URL` is missing in production, the code falls back to `file:local.db` silently. This could lead to data being written to a local SQLite file instead of Turso without any warning.

3. **No retry logic**: If a query fails due to transient network issues (common with edge databases), there is no retry mechanism.

4. **No connection health check**: No ping/health-check function for the database connection.

5. **Module-level singleton**: The `client` and `db` objects are created at module import time. In a Next.js serverless environment, this means a new connection per cold start, which is expected behavior for Turso HTTP connections.

### 11b. Error Handling in API Routes

```typescript
} catch (error) {
  console.error('[MICRO_FORECASTS_GET]', error);
  return new NextResponse('Internal Error', { status: 500 });
}
```

**Issues:**

1. **Generic error responses**: All errors return `'Internal Error'` with no detail. This is acceptable for security (no leaking internals) but makes debugging harder.

2. **No specific Drizzle error handling**: Drizzle can throw specific errors for unique constraint violations, FK violations, etc. These are not caught and translated into meaningful HTTP responses (e.g., 409 Conflict for duplicate key).

3. **No input validation errors**: The API routes do not validate input before passing to Drizzle. Invalid data will cause raw database errors.

**Verdict: Connection setup is minimal but functional for Turso. Error handling is bare-bones.**

---

## 12. TRANSACTION AUDIT

**GEMINI.md requirement: "Are transactions used where needed (e.g., creating micro-forecast + lines together)?"**

### 12a. Micro-Forecast POST (route.ts:84-109)

```typescript
// Insert micro-forecast
const [newForecast] = await db.insert(schema.microForecasts).values({...}).returning();

// Insert lines if any
const insertedLines = await db.insert(schema.microForecastLines).values([...]).returning();
```

**CRITICAL BUG: These two inserts are NOT wrapped in a transaction.** If the lines insert fails, you will have an orphaned micro-forecast with no lines. The reverse is also true conceptually (though lines cannot exist without the forecast due to FK).

### 12b. Micro-Forecast PATCH (route.ts:55-81)

```typescript
// Update forecast
await db.update(schema.microForecasts).set({...}).where(eq(...));

// Delete all existing lines
await db.delete(schema.microForecastLines).where(eq(...));

// Insert new lines
await db.insert(schema.microForecastLines).values([...]);
```

**CRITICAL BUG: Delete + re-insert is not atomic.** If the insert fails after the delete, all lines are lost.

### 12c. Drizzle Transaction API

Drizzle ORM supports transactions with `db.transaction(async (tx) => { ... })`. The `grep` for `db.transaction` returned **0 results** -- transactions are never used anywhere in the codebase.

**Verdict: FAIL. No transactions are used. The micro-forecast POST and PATCH operations are multi-step and MUST be wrapped in transactions to maintain data integrity.**

---

## 13. SUMMARY OF ALL ISSUES

### CRITICAL (Must Fix)

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| C1 | **No transactions in micro-forecast POST** | Orphaned forecasts if lines insert fails | Wrap in `db.transaction()` |
| C2 | **No transactions in micro-forecast PATCH** | Data loss if re-insert fails after delete | Wrap in `db.transaction()` |
| C3 | **Missing FK: compliance_config.company_id -> companies.id** | Orphaned rows when company deleted | Add FK with CASCADE |
| C4 | **Missing FK: quick_metrics_config.company_id -> companies.id** | Orphaned rows when company deleted | Add FK with CASCADE |
| C5 | **Missing FK: accounts.parent_id -> accounts.id** | Orphaned parent references | Add FK with ON DELETE SET NULL |

### HIGH (Should Fix Soon)

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| H1 | **Missing index: timing_profiles.company_id** | Full table scan per query | Add `index('idx_timing_company').on(table.companyId)` |
| H2 | **Missing index: micro_forecasts.company_id** | Full table scan per query | Add `index('idx_micro_fc_company').on(table.companyId)` |
| H3 | **Missing index: scenarios.company_id** | Full table scan per query | Add `index('idx_scenarios_company').on(table.companyId)` |
| H4 | **Missing index: micro_forecast_lines.micro_forecast_id** | Full table scan on join | Add `index('idx_mfl_forecast').on(table.microForecastId)` |
| H5 | **No queries/ directory** | PRD2 specifies `queries/companies.ts`, `accounts.ts`, `historical.ts`, `forecast-config.ts`, `forecast-results.ts` | Create query modules with company isolation built in |
| H6 | **Most API routes missing** | No CRUD for accounts, actuals, value rules, timing profiles, scenarios, compliance, forecast results, companies | Build remaining 18 API routes |

### MEDIUM (Should Fix Eventually)

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| M1 | **Missing FK: micro_forecast_lines.account_id -> accounts.id** | Invalid account references | Add nullable FK |
| M2 | **Missing FK: micro_forecast_lines.timing_profile_id -> timing_profiles.id** | Invalid profile references | Add nullable FK |
| M3 | **Missing FK: value_rules.scenario_id -> scenarios.id** | Orphaned scenario references | Add nullable FK |
| M4 | **Missing FK: forecast_results.scenario_id -> scenarios.id** | Orphaned scenario references | Add nullable FK |
| M5 | **Missing FK: scenarios.parent_id -> scenarios.id** | Invalid parent references | Add nullable FK |
| M6 | **No Drizzle relations() defined** | Cannot use `with: {}` for auto-joins; forces manual multi-query + JS join patterns | Add `relations()` for all FK relationships |
| M7 | **No Zod validation schemas from Drizzle** | API input is unvalidated; relies on TypeScript interfaces | Use `createInsertSchema()`/`createSelectSchema()` |
| M8 | **Missing index: scenario_overrides.scenario_id** | Full table scan when loading overrides | Add index |
| M9 | **Silent fallback to local.db** | Data could be written to local file instead of Turso | Throw error if env vars missing in production |

### LOW (Nice to Have)

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| L1 | **No seed scripts** | Manual setup required for testing | Create `src/lib/db/seed.ts` |
| L2 | **No DB health check endpoint** | Cannot verify DB connectivity | Add `/api/health` route |
| L3 | **PATCH/DELETE use 3 queries for ownership check** | Slight performance overhead | Create single-join ownership query |
| L4 | **No retry logic for transient Turso errors** | Occasional failed writes | Add exponential backoff wrapper |
| L5 | **`real` type for compliance percentages** | Floating point in rates could affect calculations | Consider storing as basis points (integer) |
| L6 | **No updated_at trigger** | `updated_at` has default but never auto-updates on row change | Add trigger or update in application code |

---

## 14. KEY POSITIVE FINDINGS

1. **Paise standard correctly enforced**: All monetary columns use `integer`, not `real` or `numeric`.
2. **Cascading deletes on core FKs**: When a company is deleted, its accounts, actuals, value rules, timing profiles, micro-forecasts, scenarios, and forecast results are all cascaded.
3. **Unique constraints where needed**: `monthly_actuals` (company+account+period), `value_rules` (company+account+scenario), `compliance_config` (company), `quick_metrics_config` (company).
4. **Company isolation pattern exists**: `resolveCompanyForUser()` in `company-context.ts` is a reusable pattern, though not yet used consistently.
5. **Drizzle ORM used correctly**: Proper imports, schema structure, and query patterns.
6. **N+1 avoided in GET route**: The micro-forecasts GET uses `inArray` batching instead of per-forecast line queries.
7. **Demo-mode company auto-creation**: `getOrCreatePrimaryCompanyForUser()` gracefully handles first-time users.

---

## 15. RECOMMENDED PRIORITY FIX ORDER

1. **Wrap micro-forecast POST/PATCH in `db.transaction()`** -- data integrity risk
2. **Add missing FKs** (compliance_config, quick_metrics_config, accounts.parent_id) -- requires new migration
3. **Add missing indexes** (timing_profiles, micro_forecasts, scenarios, micro_forecast_lines) -- requires new migration
4. **Add Drizzle `relations()` definitions** -- enables `with: {}` joins, reduces query count
5. **Build remaining API routes** with consistent company isolation
6. **Create `src/lib/db/queries/` modules** with reusable, company-isolated query functions
7. **Add Zod validation schemas** from Drizzle schema
8. **Improve error handling** with specific Drizzle error translation