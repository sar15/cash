# CashFlowIQ — Master Execution Plan
## Full-Stack System Audit & Fathom-Level Production Readiness

> **Status**: You've completed Production Fixes (21/21 ✅) and Final Gaps (7/7 ✅)  
> **Blocking Issue**: Fathom Features design incomplete — stuck for 4 hours  
> **Goal**: Systematic 5-pass verification, add missing Fathom features, achieve 99.99% reliability

---

## Executive Summary

### What We Have (Verified Against Code)
✅ Pure forecast engine with paise integrity  
✅ Three-way integration (P&L → BS → CF)  
✅ Compliance engine (GST, TDS, PF/ESI)  
✅ Scenario comparison  
✅ Micro-forecasts (business events)  
✅ Multi-user support (company_members table)  
✅ Audit trail (audit_log table)  
✅ Notifications feed  
✅ Zoho Books integration schema  
✅ Forecast result caching (with debounced save)  
✅ All production fixes deployed  

### What Fathom Has That We Don't (Research-Backed)
❌ **Cash Flow Waterfall Chart** — visual bridge showing opening → inflows → outflows → closing  
❌ **Scenario Comparison View** — side-by-side Base/Best/Worst with delta columns  
❌ **Rolling Forecast Lock** — mark months as actuals, auto-advance forecast window  
❌ **On-Demand PDF Reports** — branded reports with charts for stakeholder sharing  
❌ **GST Filing Tracker** — GSTR-1/3B status, due dates, overdue penalties  
❌ **Sensitivity Analysis** — real-time sliders for revenue/expense growth, AR/AP days  
❌ **CA Firm View** — portfolio dashboard for CAs managing multiple clients  
❌ **Bank Reconciliation Status** — track which months are reconciled vs unreconciled  

### Indian Market Gaps (Jiva/Tally Context)
❌ Daily auto-sync from Zoho Books (schema exists, sync logic incomplete)  
❌ GST portal integration (GSTR data pull)  
❌ Bank statement parsing (auto-reconciliation)  
❌ Multi-branch support (one company, multiple locations)  

---

## Phase 1: Complete Fathom Features Design (UNBLOCK NOW)

**Why You're Stuck**: The design.md cuts off mid-architecture. You need complete technical specs before building.

### 1.1 Cash Flow Waterfall Chart

**What It Does**: Visual bridge chart showing how cash moves month-to-month.

**Technical Design**:
```typescript
// Data Structure
interface WaterfallMonth {
  month: string              // 'Apr-25'
  openingCash: number        // paise
  totalInflows: number       // paise (sum of all cash inflows)
  totalOutflows: number      // paise (sum of all cash outflows)
  closingCash: number        // paise
}

// Derivation Logic (from existing engine output)
function buildWaterfallData(engineResult: EngineResult): WaterfallMonth[] {
  return engineResult.rawIntegrationResults.map((month, index) => {
    const openingCash = index === 0 
      ? month.bs.cash - month.cf.netCashFlow 
      : engineResult.rawIntegrationResults[index - 1].bs.cash
    
    return {
      month: engineResult.forecastMonths[index],
      openingCash,
      totalInflows: month.cf.operatingCashFlow > 0 ? month.cf.operatingCashFlow : 0,
      totalOutflows: month.cf.operatingCashFlow < 0 ? Math.abs(month.cf.operatingCashFlow) : 0,
      closingCash: month.bs.cash,
    }
  })
}
```

**UI Component**: `src/components/dashboard/CashWaterfallChart.tsx`  
**Chart Library**: Recharts (already in package.json)  
**Color Scheme**: Green (#059669) for inflows, Red (#DC2626) for outflows  
**Mobile**: Horizontal scroll for <768px screens  

**Invariant**: `closingCash[n] = openingCash[n] + inflows[n] - outflows[n]` for all n

---

### 1.2 Scenario Comparison View

**What It Does**: Side-by-side grid showing Base/Best/Worst scenarios with delta columns.

**Technical Design**:
```typescript
// Already have: runScenarioForecastEngine() in src/lib/engine/scenarios/engine.ts
// Need: UI component that runs engine 3 times (once per scenario) and displays results

interface ScenarioComparisonRow {
  accountName: string
  baseValues: number[]      // paise per month
  bestValues: number[]      // paise per month
  worstValues: number[]     // paise per month
  bestDelta: number[]       // best - base (paise)
  worstDelta: number[]      // worst - base (paise)
}

// Computation (client-side, <2s on 3G)
function buildComparisonGrid(
  accounts: Account[],
  baseScenario: ScenarioDefinition,
  bestScenario: ScenarioDefinition,
  worstScenario: ScenarioDefinition,
  ...engineOptions
): ScenarioComparisonRow[] {
  const baseResult = runScenarioForecastEngine({ ...engineOptions, scenario: baseScenario })
  const bestResult = runScenarioForecastEngine({ ...engineOptions, scenario: bestScenario })
  const worstResult = runScenarioForecastEngine({ ...engineOptions, scenario: worstScenario })
  
  return accounts.map(account => ({
    accountName: account.name,
    baseValues: baseResult.accountForecasts[account.id],
    bestValues: bestResult.accountForecasts[account.id],
    worstValues: worstResult.accountForecasts[account.id],
    bestDelta: bestResult.accountForecasts[account.id].map((v, i) => 
      v - baseResult.accountForecasts[account.id][i]
    ),
    worstDelta: worstResult.accountForecasts[account.id].map((v, i) => 
      v - baseResult.accountForecasts[account.id][i]
    ),
  }))
}
```

**UI Component**: `src/components/scenarios/ScenarioComparisonGrid.tsx`  
**Display**: Frozen left column (account names), 3 scenario columns, 2 delta columns  
**Color Coding**: Green for positive deltas, red for negative  

**Performance**: All 3 engine runs must complete in <2s total (engine is pure, no DB calls)

---

### 1.3 Rolling Forecast Lock

**What It Does**: Mark a month as "locked" (historical actual), auto-advance forecast window.

**DB Schema Addition**:
```sql
-- Add to companies table
ALTER TABLE companies ADD COLUMN locked_periods TEXT DEFAULT '[]';
-- JSON array of YYYY-MM-01 strings
```

**API Route**: `PATCH /api/companies/:id/lock-period`  
**Request Body**: `{ period: '2025-04-01' }`  
**Logic**:
1. Verify period has actuals in `monthly_actuals`
2. Append period to `locked_periods` JSON array
3. Return updated company

**Engine Integration**:
```typescript
// In buildForecastMonthLabels()
function buildForecastMonthLabels(options: {
  fyStartMonth: number
  historicalPeriods: string[]
  lockedPeriods?: string[]  // NEW
}): string[] {
  const latestLocked = options.lockedPeriods?.sort().at(-1)
  const startMonth = latestLocked 
    ? addMonths(parseISO(latestLocked), 1)
    : addMonths(parseISO(options.historicalPeriods.at(-1) ?? today()), 1)
  
  // Generate 12 months forward from startMonth
  return Array.from({ length: 12 }, (_, i) => 
    format(addMonths(startMonth, i), 'MMM-yy')
  )
}
```

**UI**: Lock icon (🔒) in ForecastGrid column header, grey background for locked months

---

### 1.4 On-Demand PDF Report Generation

**What It Does**: Generate branded PDF with P&L, BS, CF, metrics, and waterfall chart.

**Tech Stack**:
- `jspdf` (already in package.json)
- `html2canvas` (already in package.json) — for chart rendering

**API Route**: `POST /api/reports/generate`  
**Request Body**:
```typescript
{
  companyId: string
  scenarioId?: string
  periodStart: string  // 'YYYY-MM-01'
  periodEnd: string    // 'YYYY-MM-01'
  includeCharts: boolean
  includeScenarioComparison: boolean
}
```

**Response**: `{ downloadUrl: string, expiresAt: string }`  
**Storage**: R2 bucket (already configured), signed URL valid for 1 hour

**PDF Structure**:
1. Header: Company name + logo
2. P&L Statement (monthly columns)
3. Balance Sheet (end-of-period snapshot)
4. Cash Flow Statement
5. Key Metrics Summary (cash runway, net income, gross margin %)
6. Cash Waterfall Chart (embedded image via html2canvas)
7. Footer: "Generated by CashFlowIQ" + timestamp

**Performance**: <10s for 12-month report on Vercel serverless

---

### 1.5 GST Filing Status Tracker

**What It Does**: Track GSTR-1/3B filing status, due dates, overdue penalties.

**DB Schema**:
```sql
CREATE TABLE gst_filings (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period TEXT NOT NULL,  -- 'YYYY-MM-01'
  return_type TEXT NOT NULL,  -- 'GSTR-1' | 'GSTR-3B'
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'filed' | 'overdue'
  due_date TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  filed_at TEXT,
  reference_number TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_gst_filings_unique 
  ON gst_filings(company_id, period, return_type);
```

**Auto-Population**: When compliance engine runs, create/update `gst_filings` rows  
**Due Date Logic**:
- GSTR-1: 11th of following month
- GSTR-3B: 20th of following month
- QRMP (quarterly): 22nd/24th depending on state

**Overdue Penalty Calculation**:
```typescript
function calculateLateFee(filing: GSTFiling): number {
  if (filing.status !== 'overdue') return 0
  
  const daysOverdue = differenceInDays(new Date(), parseISO(filing.dueDate))
  const dailyPenalty = filing.amount_paise === 0 ? 5000 : 10000  // ₹50 or ₹100 per day
  const maxPenalty = 1000000  // ₹10,000 cap per GST Act
  
  return Math.min(daysOverdue * dailyPenalty, maxPenalty)
}
```

**UI Component**: `src/app/(app)/compliance/page.tsx` (already exists, add GST section)  
**Status Badges**: Green "Filed", Amber "Pending", Red "Overdue"

---

### 1.6 Cash Flow Sensitivity Analysis

**What It Does**: Real-time sliders for revenue/expense growth, AR/AP days — see impact on cash.

**UI Component**: `src/components/forecast/SensitivityPanel.tsx`  
**Sliders**:
- Revenue Growth % (-50% to +100%, step 1%)
- Expense Growth % (-50% to +100%, step 1%)
- Collection Days (0 to 180 days, step 1)
- Payment Days (0 to 180 days, step 1)

**Engine Integration**:
```typescript
// Modify runForecastEngine() to accept sensitivity overrides
interface SensitivityOverrides {
  revenueGrowthPct?: number
  expenseGrowthPct?: number
  collectionDays?: number
  paymentDays?: number
}

// Apply in value rule evaluation
function evaluateWithSensitivity(
  rule: AnyValueRuleConfig,
  context: RuleContext,
  overrides: SensitivityOverrides
): number[] {
  let forecast = evaluateRule(rule, context)
  
  if (overrides.revenueGrowthPct && rule.accountCategory === 'Revenue') {
    forecast = forecast.map(v => Math.round(v * (1 + overrides.revenueGrowthPct! / 100)))
  }
  
  if (overrides.expenseGrowthPct && ['COGS', 'Operating Expenses'].includes(rule.accountCategory)) {
    forecast = forecast.map(v => Math.round(v * (1 + overrides.expenseGrowthPct! / 100)))
  }
  
  return forecast
}
```

**Performance**: Re-run engine on every slider change, <500ms response time  
**Display**: Show delta from baseline (closing cash, runway, net income)  
**Persistence**: NO — sensitivity is read-only what-if, never saved to DB

---

### 1.7 CA Firm View (Multi-Company Dashboard)

**What It Does**: Portfolio dashboard for CAs managing multiple clients.

**Route**: `/firm`  
**Access Control**: Show only if user is member of 2+ companies

**Data Structure**:
```typescript
interface CompanySummaryCard {
  companyId: string
  companyName: string
  industry: string
  cashRunway: number  // months
  currentMonthNetIncome: number  // paise
  complianceHealth: 'healthy' | 'warning' | 'critical'
  overdueCount: number
}
```

**API Route**: `GET /api/firm/companies`  
**Response**: `CompanySummaryCard[]`  
**Data Source**: Cached `forecast_results` table (no engine re-run on page load)

**Compliance Health Logic**:
```typescript
function deriveComplianceHealth(company: Company): 'healthy' | 'warning' | 'critical' {
  const overdueFilings = await db.query.gstFilings.findMany({
    where: and(
      eq(gstFilings.companyId, company.id),
      eq(gstFilings.status, 'overdue')
    )
  })
  
  if (overdueFilings.length > 0) return 'critical'
  
  const dueSoon = await db.query.gstFilings.findMany({
    where: and(
      eq(gstFilings.companyId, company.id),
      eq(gstFilings.status, 'pending'),
      sql`date(due_date) <= date('now', '+7 days')`
    )
  })
  
  if (dueSoon.length > 0) return 'warning'
  return 'healthy'
}
```

**UI**: Card grid, sortable by runway/net income/compliance, filterable by industry/status

---

### 1.8 Bank Reconciliation Status

**What It Does**: Track which months are reconciled (actuals match bank statement).

**DB Schema**:
```sql
CREATE TABLE bank_reconciliations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period TEXT NOT NULL,  -- 'YYYY-MM-01'
  status TEXT NOT NULL DEFAULT 'unreconciled',  -- 'unreconciled' | 'in_progress' | 'reconciled'
  reconciled_by TEXT,  -- clerkUserId
  reconciled_at TEXT,
  bank_closing_balance_paise INTEGER,
  book_closing_balance_paise INTEGER,
  variance_paise INTEGER,  -- bank - book
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_reconciliations_unique 
  ON bank_reconciliations(company_id, period);
```

**Auto-Creation**: When actuals are imported, create `unreconciled` row with `book_closing_balance_paise` from engine

**API Routes**:
- `GET /api/reconciliations?companyId=` — list all reconciliations
- `PATCH /api/reconciliations/:id` — mark as reconciled, provide bank balance

**Variance Calculation**:
```typescript
variance_paise = bank_closing_balance_paise - book_closing_balance_paise
```

**UI**: Grid on `/data` page showing month, book balance, bank balance (editable), variance, status  
**Color Coding**: Green checkmark for zero variance, amber warning for non-zero variance

---

## Phase 2: Systematic 5-Pass Verification

### Pass 1: Code Audit (Deep Review)

**Objective**: Find logic flaws, security vulnerabilities, Indian market edge cases.

**Checklist**:
- [ ] Review every API route for `clerkUserId` ownership check
- [ ] Verify all monetary values are integer paise (no `real` or `float` columns)
- [ ] Check balance sheet invariant: `totalAssets === totalLiabilities + totalEquity` after every computation
- [ ] Validate period format: all periods are `YYYY-MM-01` (no month labels in DB)
- [ ] Confirm engine purity: no DB calls inside `runForecastEngine()`
- [ ] Test intermittent connectivity: all mutations are idempotent
- [ ] Verify mobile optimization: all pages render correctly on 360px screens
- [ ] Check Indian number format: all displays use `formatAuto` (lakhs/crores)

**Tools**:
- TypeScript compiler (`npm run typecheck`)
- ESLint (`npm run lint`)
- Drizzle schema validator (`npm run db:push --dry-run`)

**Output**: `AUDIT_PASS1_FINDINGS.md` with prioritized issue list

---

### Pass 2: Dependency Audit

**Objective**: Confirm all API keys, env vars, and secrets are correctly mapped.

**Checklist**:
- [ ] `TURSO_DATABASE_URL` — verify connection works
- [ ] `TURSO_AUTH_TOKEN` — verify auth succeeds
- [ ] `CLERK_SECRET_KEY` — verify webhook signature validation
- [ ] `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` — verify file upload/download
- [ ] `RESEND_API_KEY` — verify email sending (send test email)
- [ ] `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` — verify background jobs fire
- [ ] `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — verify rate limiting works across instances
- [ ] `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` — verify error capture
- [ ] `ENCRYPTION_KEY` — verify Zoho token encrypt/decrypt round-trip
- [ ] `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET` — verify OAuth flow (if Zoho integration enabled)

**Tools**:
- `.env.example` as checklist
- `src/lib/server/env.ts` validation logic
- Manual test: trigger each integration and verify success

**Output**: `AUDIT_PASS2_ENV_STATUS.md` with green/red status per env var

---

### Pass 3: Constraint Check (No Zoho/Tally Dependency)

**Objective**: Ensure no external integrations are required for core functionality.

**Checklist**:
- [ ] Forecast engine runs without Zoho Books connection
- [ ] Compliance engine computes GST/TDS/PF without external API calls
- [ ] All accounting logic is internal (no Tally API dependency)
- [ ] Manual Excel import works as primary data entry method
- [ ] Zoho Books integration is OPTIONAL (graceful degradation when not configured)

**Test**:
1. Create new company
2. Import Excel file with 12 months of actuals
3. Configure value rules
4. Run forecast engine
5. Verify P&L, BS, CF, compliance all compute correctly
6. Verify NO external API calls were made (check network tab)

**Output**: `AUDIT_PASS3_INDEPENDENCE.md` confirming internal architecture

---

### Pass 4: Performance Optimization

**Objective**: Optimize for Indian network conditions (3G, intermittent connectivity).

**Targets**:
- [ ] Forecast engine: <2s on 2GB RAM device
- [ ] API response time: <500ms for read routes, <2s for write routes
- [ ] Page load: <3s on 3G connection
- [ ] PDF generation: <10s for 12-month report
- [ ] Scenario comparison: <2s for 3 scenarios

**Optimizations**:
1. **DB Indexes** (already added in production-fixes):
   - `idx_actuals_account_period` on `(accountId, period)`
   - `idx_value_rules_account` on `accountId`
   - `idx_timing_profiles_company_name` on `(companyId, name)`

2. **Forecast Result Caching** (already implemented):
   - `useCurrentForecast` debounces save to DB (800ms)
   - Next page load uses cached result instead of recomputing

3. **Aggressive Client-Side Caching**:
   - Zustand stores persist to localStorage
   - Stale-while-revalidate pattern for API calls

4. **Bundle Size Reduction**:
   - Code-split routes (Next.js automatic)
   - Lazy-load charts (Recharts dynamic import)
   - Remove unused dependencies

**Tools**:
- Lighthouse (performance score >90)
- Chrome DevTools Network tab (throttle to 3G)
- `npm run build` — check bundle sizes

**Output**: `AUDIT_PASS4_PERFORMANCE.md` with before/after metrics

---

### Pass 5: Edge Case Torture Testing

**Objective**: Test extreme user behaviors, database deadlocks, "impossible" inputs.

**Test Scenarios**:

1. **Concurrent Writes**:
   - Two users edit the same value rule simultaneously
   - Expected: Last write wins, no data corruption

2. **Zero/Negative Actuals**:
   - Import file with all zero values
   - Import file with negative revenue
   - Expected: Engine handles gracefully, no NaN/Infinity

3. **Missing Data**:
   - Company with no actuals (empty history)
   - Account with no value rule configured
   - Expected: Engine uses fallback (rolling avg or zero)

4. **Extreme Values**:
   - Revenue = ₹1 crore per month (100,00,00,000 paise)
   - Forecast 36 months instead of 12
   - Expected: No integer overflow, balance sheet invariant holds

5. **Network Failures**:
   - Simulate 500ms latency on every API call
   - Simulate random 503 errors (50% failure rate)
   - Expected: Optimistic UI updates, retry logic works

6. **Database Deadlocks**:
   - 10 concurrent forecast saves for same company
   - Expected: Upsert handles conflicts, no duplicate rows

7. **Malicious Inputs**:
   - SQL injection in company name: `'; DROP TABLE companies; --`
   - XSS in account name: `<script>alert('xss')</script>`
   - Expected: Zod validation rejects, no code execution

**Tools**:
- Vitest for unit tests
- Playwright for E2E tests
- Artillery for load testing

**Output**: `AUDIT_PASS5_EDGE_CASES.md` with pass/fail per scenario

---

## Phase 3: Build Missing Fathom Features

**Priority Order** (visual impact first, then forecasting depth, then CA workflow):

1. ✅ Cash Flow Waterfall Chart (1 day)
2. ✅ Scenario Comparison View (1 day)
3. ✅ Rolling Forecast Lock (0.5 day)
4. ✅ GST Filing Tracker (1 day)
5. ✅ Sensitivity Analysis (1.5 days)
6. ✅ On-Demand PDF Reports (2 days)
7. ✅ CA Firm View (1 day)
8. ✅ Bank Reconciliation Status (1 day)

**Total**: 9 days (1.8 weeks)

---

## Phase 4: Production Hardening

### 4.1 Security Hardening

- [ ] Add `Content-Security-Policy` headers
- [ ] Add `X-Frame-Options: DENY`
- [ ] Validate file MIME type on upload (not just extension)
- [ ] Sanitize company name / account names (XSS prevention)
- [ ] Add CSRF protection on state-changing routes
- [ ] Rate limit all API routes (already done via Upstash)

### 4.2 Data Backup

- [ ] Turso automatic backups (paid plan)
- [ ] Add export endpoint: `GET /api/export/full` — returns all company data as JSON
- [ ] Document restore procedure

### 4.3 Monitoring & Alerting

- [ ] Sentry error tracking (already installed)
- [ ] Uptime monitoring (UptimeRobot or similar)
- [ ] Performance monitoring (Vercel Analytics)
- [ ] Alert on: API error rate >1%, P95 latency >2s, forecast engine failures

---

## Phase 5: Final Readiness Certification

### Checklist

- [ ] All 8 Fathom features implemented and tested
- [ ] All 5 audit passes completed with zero critical issues
- [ ] Performance targets met (forecast <2s, API <500ms, page load <3s)
- [ ] Security hardening complete
- [ ] Data backup and restore tested
- [ ] Monitoring and alerting configured
- [ ] Documentation complete (README, API docs, deployment guide)
- [ ] User acceptance testing with 3 real CAs
- [ ] Load testing: 100 concurrent users, zero errors

### Production Readiness Report

**Format**:
```markdown
# CashFlowIQ Production Readiness Report

## Executive Summary
- System Status: READY / NOT READY
- Reliability Target: 99.99% (verified via load testing)
- Performance: All targets met (forecast <2s, API <500ms)
- Security: All OWASP Top 10 mitigated
- Compliance: GST/TDS/PF calculations verified against CA manual calculations

## Feature Completeness
- [x] All 8 Fathom-level features
- [x] Indian market optimizations (GST, lakhs/crores, mobile)
- [x] Multi-user / CA firm support
- [x] Audit trail and notifications

## Test Results
- Unit Tests: 156 passed, 0 failed
- Integration Tests: 42 passed, 0 failed
- E2E Tests: 18 passed, 0 failed
- Load Test: 100 concurrent users, 0 errors, P95 latency 1.2s

## Known Limitations
- Zoho Books sync: manual trigger only (no daily auto-sync yet)
- PDF reports: 10s generation time (acceptable, not blocking)
- Tally integration: not implemented (Zoho Books covers 80% of market)

## Deployment Checklist
- [x] All env vars configured in Vercel
- [x] Database migrations applied
- [x] R2 bucket configured
- [x] Sentry error tracking active
- [x] Uptime monitoring configured
- [x] Backup and restore tested

## Sign-Off
- Engineering: [Name], [Date]
- QA: [Name], [Date]
- Product: [Name], [Date]
```

---

## Implementation Timeline

### Week 1: Unblock Design + Start Building
- **Day 1**: Complete this master plan, finalize Fathom features design
- **Day 2-3**: Build Waterfall Chart + Scenario Comparison
- **Day 4**: Build Rolling Forecast Lock + GST Tracker
- **Day 5**: Audit Pass 1 (Code Review)

### Week 2: Core Features + Testing
- **Day 1-2**: Build Sensitivity Analysis + PDF Reports
- **Day 3**: Build CA Firm View + Bank Reconciliation
- **Day 4**: Audit Pass 2 (Dependency) + Pass 3 (Constraint)
- **Day 5**: Audit Pass 4 (Performance) + Pass 5 (Edge Cases)

### Week 3: Hardening + Certification
- **Day 1-2**: Fix all critical issues from audits
- **Day 3**: Security hardening + backup testing
- **Day 4**: User acceptance testing with 3 CAs
- **Day 5**: Load testing + final certification

**Total**: 3 weeks to production-ready

---

## Key Invariants (Never Break These)

1. **Paise Integrity**: All monetary values are integer paise. Never store rupees.
2. **Engine Purity**: `runForecastEngine()` has no DB calls. It's a pure function.
3. **Balance Sheet Invariant**: `totalAssets === totalLiabilities + totalEquity` after every computation.
4. **Auth First**: Every DB write verifies `clerkUserId` ownership.
5. **Period Format**: All periods are `YYYY-MM-01`. Never store month labels in DB.
6. **Idempotency**: All mutations are idempotent. Retries don't corrupt data.
7. **Indian UX**: All displays use `formatAuto` (lakhs/crores). All pages work on 360px screens.

---

## Next Steps (Right Now)

1. **Read this plan** — understand the full scope
2. **Ask questions** — clarify anything unclear
3. **Start Phase 1.1** — build Cash Flow Waterfall Chart (1 day)
4. **Daily check-ins** — report progress, blockers, questions

Let's build this systematically. No more getting stuck. 🚀
