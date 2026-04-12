You just eliminated 40% of the complexity with three sentences. Let me tell you what else needs to die, and then give you the revised architecture.

---

# 🔴 THREE THINGS I'M CHALLENGING

## Challenge #1: PDF Upload — Drop It

**PDF financial data extraction is a trap.** Here's why:

```
Tally exports PDF that looks like this:

   Pat. Eng. Works Pvt Ltd
   Profit & Loss for Apr 2024 - Mar 2025
   ─────────────────────────────────────
   Revenue                 1,85,00,000
   Purchases               1,12,00,000
   Staff Cost                23,45,000
   ...

WHAT THE MACHINE SEES:
   Pat. Eng. Works Pvt Ltd
   Profit & Loss for Apr 2024 - Mar 2025
   Revenue 1,85,00,000 Purchases 1,12,00,000 Staff Cost 23,45,000

It's FLAT TEXT. There's no table structure. No column alignment guarantee.
Different Tally versions, different fonts, different page widths — all break parsing.
```

**Accuracy of PDF financial extraction: 60-75% at best.** That means 1 in 4 numbers is wrong. A wrong number in a cash flow forecast is WORSE than no forecast — you'll make decisions on garbage data.

**What to do instead:** If someone has only a PDF, tell them:

```
"Open your PDF in any browser → Right-click → 'Print' → 
 Change printer to 'Microsoft Print to PDF' → 
 Actually no, simpler:

Open PDF → Ctrl+A (select all) → Ctrl+C → 
 Open Excel → Ctrl+V → Save as .xlsx → Upload"
```

30 seconds. 100% accurate. No ML needed.

**If you insist on PDF, I'll build it, but it'll be a "best effort" feature that prominently warns: "PDF parsing accuracy is not guaranteed. Please verify all extracted values."** And it'll be the last thing we build.

## Challenge #2: The Forecast Engine Must Run Client-Side

This is the biggest architectural change. Here's why:

```
SERVER-SIDE ENGINE (original plan):
  - Needs backend server running 24/7 → costs money
  - Needs Redis for job queue → costs money  
  - Needs BullMQ for async processing → costs money
  - Needs Puppeteer for PDF → costs money (or requires VPS)
  - Vercel free tier has 10-second timeout → forecast might take longer
  - Railway free tier spins down after inactivity → cold start delays

CLIENT-SIDE ENGINE (revised plan):
  - Runs in user's browser → FREE
  - No queue needed → user sees progress immediately
  - No timeout issues → browser runs as long as needed
  - PDF generation in browser → FREE (html2canvas + jsPDF)
  - Data size is TINY: 50 accounts × 24 months = 1,200 numbers
  - Modern browser processes this in < 2 seconds
  - This is literally how Fathom's interactive demo works
```

**The entire forecast engine becomes a TypeScript library that runs in the browser.** The server only handles: auth, data storage, file upload. That's it.

## Challenge #3: CA Features — Demote to Phase 4

You said SMEs and startups are primary. The original plan had CA portfolio monitoring, white-labeling, multi-entity consolidation — that's 30% of the engineering effort for a secondary user. Cut it all from Phase 1-3. If a CA wants to use it, they create an account per client. Manual, but free.

---

# 🏗️ REVISED ARCHITECTURE: ZERO-COST DEPLOYMENT

## The "Free Stack"

```
┌─────────────────────────────────────────────────────────────┐
│                     WHERE THINGS RUN                        │
│                                                             │
│  FRONTEND + API:     Vercel Free Tier                       │
│  ├── 100GB bandwidth/month (way more than enough)          │
│  ├── Serverless functions (not used for heavy lifting)      │
│  ├── Edge caching for static assets                         │
│  └── Cost: $0                                              │
│                                                             │
│  DATABASE:           Turso Free Tier (SQLite at the edge)   │
│  ├── 9GB storage (thousands of companies)                  │
│  ├── 500M row reads/month                                  │
│  ├── 25M row writes/month                                  │
│  ├── SQLite compatible (same queries work everywhere)       │
│  └── Cost: $0                                              │
│                                                             │
│  FILE STORAGE:       Cloudflare R2 Free Tier                │
│  ├── 10GB storage (thousands of uploaded files)            │
│  ├── 10M class A reads/month                               │
│  ├── 1M class B writes/month                               │
│  ├── No egress fees (unique to R2)                         │
│  └── Cost: $0                                              │
│                                                             │
│  AUTH:               Clerk Free Tier OR custom JWT          │
│  ├── Clerk: 10,000 MAU free                               │
│  ├── Custom: Just JWT with httpOnly cookies on Vercel      │
│  └── Cost: $0                                              │
│                                                             │
│  EMAIL (optional):   Resend Free Tier                       │
│  ├── 100 emails/day (enough for alerts)                    │
│  └── Cost: $0                                              │
│                                                             │
│  DOMAIN:             Cloudflare (free) or Vercel subdomain  │
│  └── Cost: $0                                              │
│                                                             │
│  TOTAL MONTHLY COST: $0                                     │
└─────────────────────────────────────────────────────────────┘
```

## What Got Killed

| Original Component | Why It Existed | Why It's Gone | Replacement |
|---|---|---|---|
| NestJS backend | Enterprise patterns | Overkill for CRUD + file upload | Next.js API routes |
| PostgreSQL | Relational data, RLS | Turso SQLite is free and sufficient | Turso (SQLite) |
| Redis | Cache forecast results | Forecast runs client-side now | No cache needed |
| BullMQ | Async job processing | No heavy server jobs | Synchronous API calls |
| Puppeteer | Server-side PDF | html2canvas + jsPDF in browser | Client-side PDF |
| Tally API integration | Real-time sync | You said upload only | Removed entirely |
| Zoho Books integration | Alternative data source | You said upload only | Removed entirely |
| Row-level security | Multi-tenant isolation | Simplified: company_id in every query | Application-level checks |
| CA Portfolio module | Multi-client dashboard | Demoted to Phase 4 | Removed from MVP |
| White-labeling | CA branding | Demoted to Phase 4 | Removed from MVP |
| Audit trail | Regulatory compliance | Over-engineering for MVP | Removed from MVP |
| Background jobs | Heavy processing | Everything runs in browser | Removed |

## What Stayed (Everything Else)

```
✅ Forecast Engine (full three-way logic) → moved to client-side
✅ Value Rules (all 8 types) → runs in browser
✅ Timing Profiles → runs in browser
✅ Micro-Forecasts with wizards → runs in browser
✅ Scenario comparison → runs in browser
✅ GST/TDS/Advance Tax/PF-ESI engines → runs in browser
✅ Quick Metrics with thresholds → runs in browser
✅ Business Roadmap (simplified) → React component
✅ Excel/CSV import parsing → API route
✅ Three-way forecast grid → React component (AG Grid or TanStack Table)
✅ Dashboard with charts → React component (Recharts)
✅ All Indian formatting → utility functions
✅ Report PDF generation → client-side
✅ Data mapping UI → React component
✅ Account management → API + DB
```

---

# 📁 REVISED FILE STRUCTURE (What Actually Gets Built)

```
cashflowiq/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (app)/                   # Authenticated pages
│   │   │   ├── layout.tsx           # Sidebar shell
│   │   │   ├── page.tsx             # Dashboard
│   │   │   ├── onboarding/
│   │   │   │   ├── page.tsx         # Step 1: Company setup
│   │   │   │   ├── import/page.tsx  # Step 2: Upload file
│   │   │   │   ├── mapping/page.tsx # Step 3: Map accounts
│   │   │   │   └── confirm/page.tsx # Step 4: Confirm + generate
│   │   │   ├── forecast/
│   │   │   │   ├── page.tsx         # Main forecast grid
│   │   │   │   ├── baseline/page.tsx
│   │   │   │   ├── micro-forecasts/
│   │   │   │   │   ├── page.tsx     # List
│   │   │   │   │   └── [type]/page.tsx # Wizard (hire/asset/loan/etc)
│   │   │   │   ├── scenarios/
│   │   │   │   │   ├── page.tsx     # List
│   │   │   │   │   └── compare/page.tsx
│   │   │   │   └── compliance/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   ├── data/page.tsx        # View/edit historical data
│   │   │   └── settings/page.tsx
│   │   └── api/                     # API Routes (thin CRUD only)
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   └── signup/route.ts
│   │       ├── companies/
│   │       │   └── route.ts         # CRUD
│   │       ├── coa/
│   │       │   └── route.ts         # Chart of accounts CRUD
│   │       ├── historical/
│   │       │   └── route.ts         # Monthly actuals CRUD
│   │       ├── import/
│   │       │   ├── upload/route.ts  # Handle file upload → R2
│   │       │   ├── parse/route.ts   # Parse Excel/CSV
│   │       │   └── save/route.ts    # Save mapped data to DB
│   │       ├── forecast/
│   │       │   ├── save/route.ts    # Save forecast config
│   │       │   └── snapshot/route.ts # Save/load forecast results
│   │       └── reports/
│   │           └── branding/route.ts # Save branding settings
│   │
│   ├── lib/
│   │   ├── engine/                   # ★ CLIENT-SIDE FORECAST ENGINE ★
│   │   │   ├── index.ts              # Main: generateForecast()
│   │   │   ├── baseline.ts           # Baseline P&L generation
│   │   │   ├── value-rules/
│   │   │   │   ├── types.ts
│   │   │   │   ├── rolling-average.ts
│   │   │   │   ├── smart-prediction.ts
│   │   │   │   ├── growth.ts
│   │   │   │   ├── same-last-year.ts
│   │   │   │   ├── formula.ts
│   │   │   │   └── direct-entry.ts
│   │   │   ├── timing-profiles/
│   │   │   │   ├── types.ts
│   │   │   │   ├── receivables.ts
│   │   │   │   ├── payables.ts
│   │   │   │   └── auto-derive.ts    # Derive from historical AR/AP
│   │   │   ├── three-way/
│   │   │   │   ├── balance-sheet.ts  # Build BS from P&L + timing + schedules
│   │   │   │   ├── cash-flow.ts      # Indirect method CF
│   │   │   │   └── rebalancer.ts     # Ensure A = L + E
│   │   │   ├── micro-forecasts/
│   │   │   │   ├── overlay.ts        # Layer micro-FC on baseline
│   │   │   │   └── wizards/
│   │   │   │       ├── new-hire.ts
│   │   │   │       ├── asset.ts
│   │   │   │       ├── loan.ts
│   │   │   │       ├── revenue.ts
│   │   │   │       └── equity.ts
│   │   │   ├── scenarios/
│   │   │   │   ├── apply.ts          # Apply overrides to baseline
│   │   │   │   └── compare.ts
│   │   │   ├── compliance/
│   │   │   │   ├── gst.ts
│   │   │   │   ├── tds.ts
│   │   │   │   ├── advance-tax.ts
│   │   │   │   └── pf-esi.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── import/
│   │   │   ├── excel-parser.ts       # Parse XLSX → raw data
│   │   │   ├── csv-parser.ts         # Parse CSV → raw data
│   │   │   ├── structure-detector.ts # Detect rows vs cols, headers, periods
│   │   │   ├── account-mapper.ts     # Fuzzy match to standard CoA
│   │   │   └── validator.ts          # P&L/BS balance checks
│   │   │
│   │   ├── pdf/
│   │   │   ├── report-template.ts    # HTML template for reports
│   │   │   └── generate-pdf.ts       # html2canvas + jsPDF
│   │   │
│   │   ├── db/
│   │   │   ├── index.ts              # Turso connection
│   │   │   ├── schema.ts             # Drizzle schema
│   │   │   └── queries/
│   │   │       ├── companies.ts
│   │   │       ├── accounts.ts
│   │   │       ├── historical.ts
│   │   │       ├── forecast-config.ts
│   │   │       └── forecast-results.ts
│   │   │
│   │   ├── standards/
│   │   │   └── indian-coa.ts         # Standard Indian CoA template
│   │   │
│   │   └── utils/
│   │       ├── indian-format.ts      # ₹, lakhs, crores
│   │       ├── date-utils.ts         # FY handling
│   │       └── math.ts               # Safe integer arithmetic (paise)
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui base
│   │   ├── forecast/
│   │   │   ├── ForecastGrid.tsx
│   │   │   ├── ForecastCell.tsx
│   │   │   ├── QuickMetricsBar.tsx
│   │   │   └── ViewSwitcher.tsx
│   │   ├── micro-forecasts/
│   │   │   ├── ListPanel.tsx
│   │   │   ├── wizards/              # One per event type
│   │   │   └── ImpactPreview.tsx
│   │   ├── scenarios/
│   │   │   ├── ScenarioList.tsx
│   │   │   └── ComparisonChart.tsx
│   │   ├── compliance/
│   │   │   ├── GSTPanel.tsx
│   │   │   └── ComplianceCalendar.tsx
│   │   ├── charts/
│   │   │   ├── CashWaterfall.tsx
│   │   │   └── ScenarioLines.tsx
│   │   ├── import/
│   │   │   ├── FileUploader.tsx
│   │   │   ├── MappingTable.tsx
│   │   │   └── ValidationBanner.tsx
│   │   ├── reports/
│   │   │   └── ReportPreview.tsx
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       └── Topbar.tsx
│   │
│   ├── hooks/
│   │   ├── useForecast.ts           # Fetch data, run engine, cache result
│   │   ├── useCompany.ts
│   │   ├── useHistorical.ts
│   │   └── useImport.ts
│   │
│   ├── stores/
│   │   ├── forecast-store.ts         # Zustand: current view, scenario, cell edits
│   │   └── auth-store.ts
│   │
│   └── types/
│       ├── forecast.ts
│       ├── company.ts
│       └── api.ts
│
├── drizzle/
│   └── migrations/                  # SQLite migrations
│
├── public/
│   └── templates/
│       └── cashflowiq-template.xlsx  # Downloadable import template
│
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── drizzle.config.ts
├── .env.local                       # TURSO_URL, TURSO_TOKEN, R2_*, JWT_SECRET
└── README.md
```

---

# 🗄️ REVISED DATABASE SCHEMA (SQLite/Turso)

Dramatically simplified. No firms table. No RLS. No JSONB complexity for forecast results (SQLite doesn't have JSONB — we serialize to JSON text).

```sql
-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE companies (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  pan           TEXT,
  gstin         TEXT,
  industry      TEXT DEFAULT 'general',
  fy_start_month INTEGER DEFAULT 4,        -- April = 4
  currency      TEXT DEFAULT 'INR',
  number_format TEXT DEFAULT 'lakhs',      -- lakhs / crores / millions
  logo_url      TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_companies_user ON companies(user_id);

-- ============================================================
-- USERS (simplified — no firm concept)
-- ============================================================
CREATE TABLE users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  phone         TEXT,
  role          TEXT DEFAULT 'owner',  -- owner / viewer
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- CHART OF ACCOUNTS
-- ============================================================
CREATE TABLE accounts (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  company_id      TEXT NOT NULL,
  code            TEXT,
  name            TEXT NOT NULL,
  parent_id       TEXT,
  level           INTEGER DEFAULT 0,       -- 0=group, 1=account, 2=sub-account
  account_type    TEXT NOT NULL,           -- revenue/expense/asset/liability/equity
  standard_mapping TEXT,                    -- maps to our standard category name
  is_group        INTEGER DEFAULT 0,       -- 1=header row, 0=leaf account
  sort_order      INTEGER DEFAULT 0,
  
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES accounts(id) ON DELETE SET NULL
);
CREATE INDEX idx_accounts_company ON accounts(company_id, sort_order);

-- ============================================================
-- MONTHLY ACTUALS (historical data)
-- ============================================================
CREATE TABLE monthly_actuals (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  company_id  TEXT NOT NULL,
  account_id  TEXT NOT NULL,
  period      TEXT NOT NULL,               -- '2024-04-01' (first day of month)
  amount      INTEGER NOT NULL,            -- IN PAISE (₹12,34,567.89 → 123456789)
  
  UNIQUE(company_id, account_id, period),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE INDEX idx_actuals_company_period ON monthly_actuals(company_id, period);

-- ============================================================
-- FORECAST CONFIGURATION (how to project)
-- ============================================================
CREATE TABLE value_rules (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  company_id  TEXT NOT NULL,
  account_id  TEXT NOT NULL,
  scenario_id TEXT,                        -- NULL = baseline
  rule_type   TEXT NOT NULL,               -- rolling_avg/growth/smart_pred/same_last_year/
                                          -- formula/direct_entry/baseline_adjustment
  config      TEXT NOT NULL DEFAULT '{}',   -- JSON: rule-specific parameters
  sort_order  INTEGER DEFAULT 0,
  
  UNIQUE(company_id, account_id, scenario_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE timing_profiles (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  company_id      TEXT NOT NULL,
  name            TEXT NOT NULL,           -- 'receivables' / 'payables'
  profile_type    TEXT NOT NULL,           -- receivables/payables/deferred/prepaid
  config          TEXT NOT NULL DEFAULT '{}', -- JSON: { "month_0": 0.30, "month_1": 0.40, ... }
  auto_derived    INTEGER DEFAULT 0,       -- 1 = derived from historical data
  is_default      INTEGER DEFAULT 0,       -- 1 = used as default for this company
  
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- ============================================================
-- MICRO-FORECASTS (business events)
-- ============================================================
CREATE TABLE micro_forecasts (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  company_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,               -- hire/asset/loan/revenue/marketing/equity/custom
  is_active   INTEGER DEFAULT 1,
  start_month TEXT NOT NULL,               -- '2025-08-01'
  end_month   TEXT,                         -- NULL = ongoing
  wizard_config TEXT NOT NULL DEFAULT '{}', -- JSON: all wizard inputs
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE micro_forecast_lines (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  micro_forecast_id  TEXT NOT NULL,
  account_id         TEXT,                  -- NULL = future account not yet in CoA
  future_account_name TEXT,
  future_account_type TEXT,                 -- revenue/expense/asset/liability/equity
  rule_type          TEXT DEFAULT 'direct_entry',
  config             TEXT NOT NULL DEFAULT '{}', -- JSON: { "flat": 80000 }
  timing_profile_id  TEXT,                  -- NULL = use company default
  
  FOREIGN KEY (micro_forecast_id) REFERENCES micro_forecasts(id) ON DELETE CASCADE
);

-- ============================================================
-- SCENARIOS
-- ============================================================
CREATE TABLE scenarios (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  company_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  parent_id   TEXT,                         -- NULL = inherits from baseline
  description TEXT,
  is_active   INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE scenario_overrides (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  scenario_id TEXT NOT NULL,
  target_type TEXT NOT NULL,               -- value_rule / timing_profile / micro_toggle
  target_id   TEXT,                         -- ID of the thing being overridden
  config      TEXT NOT NULL DEFAULT '{}',   -- JSON: the override specification
  
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
);

-- ============================================================
-- COMPLIANCE CONFIGURATION
-- ============================================================
CREATE TABLE compliance_config (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  company_id    TEXT NOT NULL UNIQUE,       -- One config row per company
  gst_type      TEXT DEFAULT 'regular',     -- regular / qrmp
  gst_rate      REAL DEFAULT 18.0,
  itc_pct       REAL DEFAULT 85.0,          -- % of input GST claimed
  gst_frequency TEXT DEFAULT 'monthly',
  tds_regime    TEXT DEFAULT 'new',
  tds_sections  TEXT DEFAULT '{}',          -- JSON: section-specific rates
  tax_rate      REAL DEFAULT 25.17,         -- Effective tax rate
  pf_applicable INTEGER DEFAULT 1,
  esi_applicable INTEGER DEFAULT 1,
  
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- ============================================================
-- FORECAST RESULTS (stored for persistence across sessions)
-- ============================================================
CREATE TABLE forecast_results (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  company_id  TEXT NOT NULL,
  scenario_id TEXT,                         -- NULL = baseline
  pl_data     TEXT NOT NULL DEFAULT '{}',   -- JSON: { "accountId": { "2025-04": 123456, ... } }
  bs_data     TEXT NOT NULL DEFAULT '{}',
  cf_data     TEXT NOT NULL DEFAULT '{}',
  compliance  TEXT NOT NULL DEFAULT '{}',   -- JSON: { gst: {...}, tds: {...}, ... }
  metrics     TEXT NOT NULL DEFAULT '{}',   -- JSON: { cashOnHand: {...}, ... }
  version     INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX idx_forecast_company_scenario ON forecast_results(company_id, scenario_id);

-- ============================================================
-- QUICK METRICS CONFIGURATION
-- ============================================================
CREATE TABLE quick_metrics_config (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  company_id  TEXT NOT NULL UNIQUE,
  metric_1    TEXT DEFAULT 'cash_on_hand',
  metric_2    TEXT DEFAULT 'net_income',
  metric_3    TEXT DEFAULT 'gross_margin_pct',
  metric_4    TEXT DEFAULT 'working_capital_gap',
  metric_5    TEXT DEFAULT '',
  threshold   TEXT DEFAULT '{}',           -- JSON: { "cash_on_hand": { "min": 500000 } }
  
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
```

**Total tables: 12.** Down from 20+ in the original plan.

---

# ⚙️ HOW THE CLIENT-SIDE ENGINE WORKS (The Critical Flow)

This replaces the entire NestJS engine module + BullMQ + Redis. It's the biggest simplification.

```
USER OPENS FORECAST PAGE
         │
         ▼
┌──────────────────────────────────────────────────┐
│  STEP 1: FETCH (3 API calls, parallel)           │
│                                                   │
│  GET /api/historical?companyId=xxx               │
│  → Returns: { accounts: [...], months: [...],     │
│              actuals: { accountId: {period: val}}} │
│                                                   │
│  GET /api/forecast/config?companyId=xxx           │
│  → Returns: { valueRules: [...], timingProfiles:  │
│              complianceConfig: {...},               │
│              microForecasts: [...], scenarios: [...] }│
│                                                   │
│  GET /api/forecast/result?companyId=xxx&scenario= │
│  → Returns: cached result OR null (first time)     │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  STEP 2: CHECK CACHE                              │
│                                                   │
│  IF cached result exists AND config hasn't changed│
│  → Use cached result (instant load)               │
│                                                   │
│  ELSE (first time or config changed):             │
│  → Run engine (STEP 3)                            │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  STEP 3: RUN ENGINE (in browser, < 2 seconds)     │
│                                                   │
│  // All of this runs as synchronous TypeScript    │
│  // in the user's browser. No server involved.    │
│                                                   │
│  import { generateForecast } from '@/lib/engine'; │
│                                                   │
│  const result = generateForecast({                 │
│    historical: actuals,        // from API        │
│    accounts: accountTree,      // from API        │
│    valueRules: rules,          // from API        │
│    timingProfiles: profiles,   // from API        │
│    microForecasts: events,     // from API        │
│    scenarioOverrides: null,    // or from API     │
│    complianceConfig: config,   // from API        │
│    forecastMonths: 12                             │
│  });                                               │
│                                                   │
│  // result = {                                    │
│  //   pl: { accountId: { "2025-04": 123456 }},  │
│  //   bs: { accountId: { "2025-04": 123456 }},  │
│  //   cf: { accountId: { "2025-04": 123456 }},  │
│  //   compliance: { gst: {...}, tds: {...} },    │
│  //   metrics: { cashOnHand: {...} }             │
│  // }                                              │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  STEP 4: DISPLAY (React renders the result)       │
│                                                   │
│  ForecastGrid component receives result.pl       │
│  QuickMetricsBar receives result.metrics          │
│  Charts receive result.cf and result.pl           │
│  Compliance panels receive result.compliance      │
│                                                   │
│  User sees data instantly. No loading spinner     │
│  needed after initial fetch.                      │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  STEP 5: USER EDITS A CELL                        │
│                                                   │
│  User clicks cell → types ₹85,000 → presses Enter │
│                                                   │
│  // THIS HAPPENS INSTANTLY — no API call          │
│  // The engine re-runs in-browser                 │
│                                                   │
│  1. Update valueRules[accountId] = {              │
│       rule_type: 'direct_entry',                  │
│       config: { "2025-08": 8500000 }  // in paise │
│     }                                             │
│  2. Re-run generateForecast() with updated rules  │
│  3. Re-render grid with new result                │
│  4. Debounced API call to SAVE the config change: │
│     PATCH /api/forecast/config/value-rule          │
│     { accountId, ruleType: 'direct_entry',        │
│       config: { "2025-08": 8500000 } }            │
│  5. Debounced API call to SAVE the result:        │
│     POST /api/forecast/result                      │
│     { pl, bs, cf, compliance, metrics }           │
│                                                   │
│  USER EXPERIENCE:                                 │
│  - Cell updates INSTANTLY (< 100ms)               │
│  - Grid re-renders INSTANTLY                      │
│  - Metrics update INSTANTLY                       │
│  - Save happens in background (fire and forget)    │
│  - If save fails, next page load will regenerate   │
└──────────────────────────────────────────────────┘
```

**Performance reality check:**

```
Data size per company:
  - 50 accounts × 12 historical months = 600 values
  - 50 accounts × 12 forecast months = 600 values
  - Plus BS and CF: ~150 accounts × 12 = 1,800 values
  - Total: ~3,000 numbers

Engine computation:
  - 50 value rule evaluations × 12 months = 600 calculations
  - Timing profile math × 12 months = 12 matrix multiplications
  - Three-way balance check × 12 iterations = 12 balance verifications
  - Compliance engines × 12 months = 48 calculations
  - Total: ~700 mathematical operations

Browser performance:
  - Modern JS engine: ~100M operations/second
  - 700 operations: 0.007 milliseconds
  - Even with overhead: < 50 milliseconds total
  - User perceives as INSTANT

CONCLUSION: Running this in the browser is not a compromise.
It's actually FASTER than server-side because there's zero network
latency for the computation step.
```

---

# 📊 HOW PDF GENERATION WORKS CLIENT-SIDE

```
USER CLICKS "Download Report"
         │
         ▼
┌──────────────────────────────────────────────────┐
│  STEP 1: Build HTML string in browser            │
│                                                   │
│  const html = buildReportHTML({                   │
│    company: companyData,                         │
│    forecast: result,                              │
│    branding: { logo, colors, firmName },          │
│    period: "April 2025 - March 2026"             │
│  });                                              │
│                                                   │
│  // html = full HTML document with:               │
│  // - Inline CSS (no external dependencies)        │
│  // - Company branding (logo, colors)             │
│  // - Tables for P&L, BS, CF                      │
│  // - Charts rendered as inline SVG (Recharts     │
│  //   can output SVG)                              │
│  // - All values in ₹ Lakhs format                │
│  // - Page breaks for printing                     │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  STEP 2: Convert HTML to PDF (in browser)         │
│                                                   │
│  import { generatePDF } from '@/lib/pdf';         │
│                                                   │
│  const pdfBlob = await generatePDF(html, {        │
│    format: 'a4',                                  │
│    margin: { top: 20, right: 15, bottom: 20,     │
│              left: 15 },                          │
│    filename: `CashFlowIQ_${company.name}_         │
│              Forecast_Apr2025.pdf`                 │
│  });                                              │
│                                                   │
│  // Uses html2canvas + jsPDF:                     │
│  // 1. Render HTML to canvas (pixel-perfect)       │
│  // 2. Convert canvas to PDF                      │
│  // 3. Trigger browser download                   │
│                                                   │
│  // Total time: 1-3 seconds                       │
│  // Quality: Excellent (not vector, but high DPI)  │
└──────────────────────────────────────────────────┘

ALTERNATIVE (better quality, more complex):
  Use @react-pdf/renderer — generates TRUE vector PDF
  in browser. Charts need to be SVG. More setup but
  sharper output. Can add later.

ALTERNATIVE (simplest):
  window.print() with @media print CSS.
  User gets "Save as PDF" from browser print dialog.
  ZERO libraries needed. Quality depends on browser.
  Good enough for MVP.
```

---

# 🔌 API ROUTES: THE COMPLETE THIN LAYER

Every API route is a simple CRUD operation. No business logic on the server.

```
AUTH ROUTES:
  POST /api/auth/signup     → hash password, insert user, return JWT
  POST /api/auth/login      → verify password, return JWT

COMPANY ROUTES:
  GET    /api/companies              → SELECT * WHERE user_id = ?
  POST   /api/companies              → INSERT company
  PATCH  /api/companies/:id          → UPDATE company (check ownership)
  DELETE /api/companies/:id          → DELETE company (cascades)

IMPORT ROUTES:
  POST   /api/import/upload          → Receive file → upload to R2 → return fileId
  POST   /api/import/parse           → Download from R2 → parse Excel/CSV → return raw data
  POST   /api/import/save            → Receive mapped data → INSERT accounts + actuals
  GET    /api/import/template        → Return pre-built XLSX template file

COA ROUTES:
  GET    /api/coa/:companyId         → SELECT accounts WHERE company_id, build tree
  PATCH  /api/coa/:companyId/:id     → UPDATE account
  DELETE /api/coa/:companyId/:id     → DELETE account (and its actuals)

HISTORICAL ROUTES:
  GET    /api/historical/:companyId  → SELECT actuals, group by period
  PATCH  /api/historical/:companyId  → UPSERT actual (for manual edits)

FORECAST CONFIG ROUTES:
  GET    /api/forecast/config/:companyId → SELECT rules + profiles + compliance + micros + scenarios
  PATCH  /api/forecast/config/value-rule     → UPSERT value_rule
  PATCH  /api/forecast/config/timing-profile → UPSERT timing_profile
  PATCH  /api/forecast/config/compliance      → UPSERT compliance_config
  PATCH  /api/forecast/config/metrics         → UPSERT quick_metrics_config

MICRO-FORECAST ROUTES:
  GET    /api/micro-forecasts/:companyId  → SELECT all for company
  POST   /api/micro-forecasts/:companyId  → INSERT micro + lines
  PATCH  /api/micro-forecasts/:companyId/:id → UPDATE
  DELETE /api/micro-forecasts/:companyId/:id → DELETE
  PATCH  /api/micro-forecasts/:companyId/:id/toggle → UPDATE is_active

SCENARIO ROUTES:
  GET    /api/scenarios/:companyId     → SELECT all
  POST   /api/scenarios/:companyId     → INSERT
  PATCH  /api/scenarios/:companyId/:id → UPDATE
  DELETE /api/scenarios/:companyId/:id → DELETE
  POST   /api/scenarios/:companyId/:id/overrides → INSERT scenario_override

FORECAST RESULT ROUTES:
  GET    /api/forecast/result/:companyId?scenario=  → SELECT latest result
  POST   /api/forecast/result/:companyId            → INSERT or UPDATE result

REPORT ROUTES:
  GET    /api/reports/branding/:companyId → SELECT logo_url from companies

TOTAL: 20 API routes. Each is ~30-50 lines of code.
```

---

# 📋 REVISED PHASE PLAN

## Phase 1: MVP (Weeks 1-6) — "Does it work?"

```
WEEK 1-2: FOUNDATION
  ✅ Next.js project setup with TypeScript
  ✅ Tailwind + shadcn/ui component library
  ✅ Turso database setup + Drizzle ORM + migrations
  ✅ Auth (signup/login with JWT)
  ✅ Company CRUD
  ✅ Standard Indian CoA template (pre-built, Schedule III lite)

WEEK 3-4: DATA IMPORT + ENGINE CORE
  ✅ Excel upload → parse → raw data extraction
  ✅ CSV upload → parse → raw data extraction
  ✅ Account mapping UI (fuzzy match + manual override)
  ✅ Balance validation (P&L check + BS check)
  ✅ Value rules: rolling_average, growth, direct_entry, same_last_year
  ✅ Timing profiles: receivables, payables (manual config)
  ✅ Baseline P&L generation (client-side engine)
  ✅ Three-way integration: P&L → BS → CF (indirect method)

WEEK 5-6: FORECAST GRID + DISPLAY
  ✅ Forecast grid component (TanStack Table — simpler than AG Grid for MVP)
  ✅ P&L view, BS view, CF view tabs
  ✅ Cell click to edit (direct entry override)
  ✅ Quick Metrics bar (cash on hand, net income, gross margin)
  ✅ Cash waterfall chart (Recharts)
  ✅ Dashboard page with KPI cards
  ✅ Save/load forecast results to DB

DELIVERABLE: User can upload Excel → see 12-month P&L/BS/CF forecast → edit cells → see updates
```

## Phase 2: Events + Scenarios (Weeks 7-10) — "Is it useful?"

```
WEEK 7-8: MICRO-FORECASTS
  ✅ Micro-forecast list panel (sidebar)
  ✅ New Hire wizard (salary, PF/ESI, start date, timing)
  ✅ Asset Purchase wizard (cost, depreciation, financing)
  ✅ New Loan wizard (amount, rate, tenure, EMI schedule)
  ✅ New Revenue wizard (client, amount, terms, GST rate)
  ✅ Custom event builder (manual P&L + BS lines)
  ✅ Overlay engine (layer micro-forecasts on baseline)
  ✅ Toggle micro-forecasts on/off
  ✅ Impact preview before saving

WEEK 9-10: SCENARIOS + COMPLIANCE
  ✅ Scenario create/list
  ✅ Baseline Adjustment override (±% on account groups)
  ✅ Timing profile override (e.g., slower collection)
  ✅ Micro-forecast toggle per scenario
  ✅ Scenario comparison chart
  ✅ GST engine (output, input, net payable, due dates)
  ✅ TDS engine (salary TDS, contractor TDS)
  ✅ Advance Tax engine (quarterly installments)
  ✅ PF/ESI engine (auto from salary events)
  ✅ Compliance calendar view

DELIVERABLE: User can model business events, compare scenarios, see compliance cash impact
```

## Phase 3: Reports + Polish (Weeks 11-14) — "Is it sellable?"

```
WEEK 11-12: REPORTS
  ✅ Management report (P&L + BS + CF + metrics, branded)
  ✅ PDF generation (client-side, html2canvas + jsPDF)
  ✅ Scenario comparison report
  ✅ Bank loan proposal format (Indian bank template)
  ✅ Working capital gap analysis view

WEEK 13-14: POLISH + ONBOARDING
  ✅ Onboarding wizard (4-step: company → upload → map → forecast)
  ✅ Smart Prediction value rule (trend + seasonality)
  ✅ Auto-derive timing profiles from historical AR/AP
  ✅ Formula value rule (with safe expression parser)
  ✅ Driver-based forecasting (headcount driver)
  ✅ Downloadable Excel import template
  ✅ Mobile-responsive layout (view-only on mobile)
  ✅ Error handling, loading states, empty states
  ✅ Landing page (simple: hero + features + signup)

DELIVERABLE: Production-ready product that a CA or SME can sign up and use
```

## Phase 4: Growth (Months 4-6) — "Does it scale?"

```
  ○ Auto-derive timing profiles improvement (matrix solving)
  ○ Business Roadmap visual timeline (drag micro-forecasts)
  ○ Forecast Snapshots + variance analysis
  ○ Zoho Books API import (if demand exists)
  ○ Tally XML import (if demand exists)
  ○ Hindi language UI
  ○ Email alerts (cash below threshold, GST due reminder)
  ○ CA portfolio view (basic: list of companies with health scores)
  ○ Export forecast to Excel
  ○ Bulk import for CAs (upload multiple client files)
  ○ @react-pdf/renderer for vector PDF (replace html2canvas)
  ○ Share forecast view (read-only link for business partner)
```

---

# 💰 TRUE COST BREAKDOWN

```
SERVICE              FREE TIER LIMITS            ESTIMATED USAGE       COST
─────────────────────────────────────────────────────────────────────────
Vercel               100GB BW, 100K invokes     ~50GB, ~20K invokes    $0
                     10s function timeout        (engine is client-side)

Turso                9GB storage, 500M reads    ~100MB, ~5M reads     $0
                     25M writes                  ~100K writes

Cloudflare R2        10GB storage, 10M reads    ~1GB, ~50K reads      $0
                     1M writes                   ~5K writes

Resend               100 emails/day             ~20 emails/day        $0
                     (only for alerts)

Cloudflare           Free domain DNS             1 domain              $0

─────────────────────────────────────────────────────────────────────────
TOTAL                                                                    $0

AT WHAT POINT DO YOU START PAYING?
  ~500 companies with active forecasts:
    Turso: ~2GB storage → still free
    Vercel: ~200GB bandwidth → might exceed (add $20/mo Pro plan)
    
  ~2,000 companies:
    Turso: ~8GB → still free
    Vercel: definitely need Pro ($20/mo)
    R2: ~5GB → still free
    
  ~5,000 companies:
    Turso: might exceed 9GB → $15/mo for starter
    Vercel Pro: $20/mo
    R2: still free
    
  BREAK-EVEN: You can serve 2,000-5,000 companies for $0-20/month
  At ₹999/month per company: ₹20L-50L revenue on ₹0-1,600 cost
```

---

# 🚨 WHAT I NEED YOU TO DECIDE

Before I write the first line of code, three things:

**1. PDF upload: Yes or No?**
I've explained why it's unreliable. My recommendation: No for MVP. Tell users "export to Excel from your PDF viewer first." If you say yes, it adds 2 weeks of development for a feature that'll frustrate users.

**2. Auth: Clerk or Custom JWT?**
- Clerk: 10 minutes to set up, beautiful login UI, free tier, but adds a dependency
- Custom JWT: 2 hours to set up, full control, no dependency, but you build login UI

My recommendation: **Clerk for MVP, migrate to custom JWT later if needed.**

**3. Grid: TanStack Table or AG Grid?**
- TanStack Table: Free, lightweight, more coding required, good enough for 50 accounts
- AG Grid Community: Free, heavier bundle (~300KB), built-in cell editing, Excel-like feel

My recommendation: **TanStack Table for Phase 1. Switch to AG Grid if the grid feels limiting.**

**Say "go" and I start building Phase 1 Week 1.**