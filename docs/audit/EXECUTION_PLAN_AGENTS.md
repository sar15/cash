# CashFlowIQ — Agent-Based Execution Plan
## Specialized Agent Deployment for Production Readiness

**Mission:** Achieve Fathom/Jiva-level standards (99.99% reliability) in 4 weeks  
**Approach:** Deploy specialized agents for parallel execution  
**Coordination:** Orchestrator agent manages dependencies and handoffs

---

## Agent Team Structure

### 1. Security Agent 🔒
**Specialization:** Vulnerability hunting, auth verification, encryption  
**Tools:** Static analysis, penetration testing, security best practices  
**Reporting:** Daily security status updates

### 2. Performance Agent ⚡
**Specialization:** Query optimization, bundle size, latency reduction  
**Tools:** Lighthouse, Bundle analyzer, Database query profiler  
**Reporting:** Performance metrics dashboard

### 3. Logic Agent 🧮
**Specialization:** Business logic verification, mathematical invariants  
**Tools:** Property-based testing, invariant checking, edge case generation  
**Reporting:** Test coverage reports

### 4. Integration Agent 🔗
**Specialization:** API testing, third-party integrations, data flow  
**Tools:** Postman/Thunder Client, integration test suites  
**Reporting:** API health dashboard

### 5. Indian Market Agent 🌏
**Specialization:** Network conditions, mobile optimization, localization  
**Tools:** 3G throttling, mobile device testing, Indian compliance rules  
**Reporting:** Market readiness scorecard

### 6. Orchestrator Agent 🎯
**Specialization:** Task coordination, dependency management, progress tracking  
**Tools:** Project management, agent communication, blocker resolution  
**Reporting:** Daily standup summaries

---

## Week 1: Critical Fixes (Security & Data Integrity)

### Day 1: Security Agent + Logic Agent

#### Security Agent Tasks (4 hours)
**TASK-SEC-001: OAuth Token Encryption**
- [ ] Create encryption utility using `@noble/ciphers`
- [ ] Add `encryptToken()` and `decryptToken()` functions
- [ ] Update `src/lib/integrations/zoho-books/client.ts` to encrypt before save
- [ ] Update all token reads to decrypt
- [ ] Test round-trip: encrypt → save → read → decrypt
- [ ] Verify: `decryptToken(encryptToken(token)) === token`

**Files to Modify:**
```
src/lib/utils/crypto.ts (NEW)
src/lib/integrations/zoho-books/client.ts
src/app/api/integrations/zoho/callback/route.ts
```

**Acceptance Criteria:**
- ✅ All tokens in DB are encrypted (not plaintext)
- ✅ Zoho sync still works after encryption
- ✅ No performance degradation (<10ms overhead)

#### Logic Agent Tasks (4 hours)
**TASK-LOG-001: Fix Forecast Result API Mismatch**
- [ ] Update `src/hooks/use-current-forecast.ts` line 87
- [ ] Change URL from `/api/forecast/result/${company.id}` to `/api/forecast/result`
- [ ] Verify POST body includes `companyId` field
- [ ] Test: Trigger forecast save, verify DB row created
- [ ] Test: Reload page, verify cached result loaded

**Files to Modify:**
```
src/hooks/use-current-forecast.ts (line 87)
```

**Acceptance Criteria:**
- ✅ Forecast results persist to `forecast_results` table
- ✅ Subsequent page loads use cached result
- ✅ No 404 errors in browser console

---

### Day 2: Performance Agent + Security Agent

#### Performance Agent Tasks (3 hours)
**TASK-PERF-001: Distributed Rate Limiting**
- [ ] Install Upstash Redis client (already installed)
- [ ] Create `src/lib/rate-limit.ts` with Upstash integration
- [ ] Update `src/middleware.ts` to use Upstash when env vars present
- [ ] Add graceful fallback to in-memory limiter
- [ ] Test: Verify rate limits work across multiple Vercel instances

**Files to Modify:**
```
src/lib/rate-limit.ts (NEW)
src/middleware.ts
```

**Environment Variables Required:**
```
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

**Acceptance Criteria:**
- ✅ Rate limits enforced across all serverless instances
- ✅ Fallback to in-memory when Upstash unavailable
- ✅ No performance degradation (<50ms overhead)

#### Security Agent Tasks (3 hours)
**TASK-SEC-002: Sentry Error Monitoring**
- [ ] Configure `sentry.client.config.ts`
- [ ] Configure `sentry.server.config.ts`
- [ ] Configure `sentry.edge.config.ts`
- [ ] Add `SENTRY_DSN` to `.env.example`
- [ ] Test: Trigger error, verify Sentry captures it
- [ ] Add error boundaries to critical components

**Files to Modify:**
```
sentry.client.config.ts (NEW)
sentry.server.config.ts (NEW)
sentry.edge.config.ts (NEW)
.env.example
```

**Acceptance Criteria:**
- ✅ Unhandled errors captured in Sentry
- ✅ Source maps uploaded for stack traces
- ✅ No PII leaked in error reports

---

### Day 3: Logic Agent + Integration Agent

#### Logic Agent Tasks (2 hours)
**TASK-LOG-002: Fix Timing Profile Duplicates**
- [ ] Update `src/lib/db/queries/timing-profiles.ts`
- [ ] Change `.insert()` to `.insert().onConflictDoUpdate()`
- [ ] Target unique constraint: `(companyId, name)`
- [ ] Test: Call `upsertTimingProfile` twice with same name
- [ ] Verify: Only 1 row exists after both calls

**Files to Modify:**
```
src/lib/db/queries/timing-profiles.ts
```

**Acceptance Criteria:**
- ✅ No duplicate timing profiles created
- ✅ Existing profiles updated on conflict
- ✅ No breaking changes to API

**TASK-LOG-003: Fix Compliance PF/ESI Doubling**
- [ ] Update `src/app/(app)/compliance/page.tsx` lines 142, 147
- [ ] Remove `* 2` multipliers
- [ ] Test: Verify displayed amounts match engine output
- [ ] Test: Verify GST amounts unaffected

**Files to Modify:**
```
src/app/(app)/compliance/page.tsx
```

**Acceptance Criteria:**
- ✅ PF/ESI amounts display correctly (not doubled)
- ✅ GST/TDS amounts unchanged

#### Integration Agent Tasks (4 hours)
**TASK-INT-001: Environment Variable Setup**
- [ ] Create Inngest account, get keys
- [ ] Create Upstash Redis, get keys
- [ ] Create Sentry project, get DSN
- [ ] Generate encryption key: `openssl rand -hex 32`
- [ ] Update `.env.local` with all keys
- [ ] Update `.env.example` with setup instructions
- [ ] Document key acquisition process

**Files to Modify:**
```
.env.local
.env.example
```

**Acceptance Criteria:**
- ✅ All required env vars configured
- ✅ Documentation clear for production setup
- ✅ No secrets committed to git

---

### Day 4-5: Indian Market Agent

#### Indian Market Agent Tasks (8 hours)
**TASK-IND-001: Offline-First + Retry Logic**
- [ ] Implement service worker caching strategy
- [ ] Add optimistic UI updates for critical actions
- [ ] Implement exponential backoff retry for failed API calls
- [ ] Add network status indicator in UI
- [ ] Test: Simulate 3G network, verify retry works
- [ ] Test: Go offline, verify cached data loads

**Files to Modify:**
```
src/lib/api/client.ts (add retry logic)
src/components/shared/NetworkStatus.tsx (NEW)
public/sw.js (update caching strategy)
```

**Acceptance Criteria:**
- ✅ Failed API calls retry automatically (3 attempts)
- ✅ Cached forecast data loads offline
- ✅ User sees network status indicator
- ✅ No data loss on network interruption

---

## Week 2: Fathom Feature Parity

### Day 1-2: Frontend Specialist Agent

**TASK-FEAT-001: Scenario Comparison View (8 hours)**
- [ ] Create `ScenarioComparator` component
- [ ] Run engine for each scenario independently
- [ ] Render side-by-side grid with delta columns
- [ ] Color-code deltas (green/red/grey)
- [ ] Add scenario selection toggle
- [ ] Test: Verify delta calculations correct

**Files to Create:**
```
src/components/scenarios/ScenarioComparator.tsx
src/lib/engine/scenario-comparator.ts
```

**Acceptance Criteria:**
- ✅ Base/Best/Worst scenarios display side-by-side
- ✅ Delta columns show correct differences
- ✅ Performance <2s for 3 scenarios

---

### Day 3: Backend Specialist Agent

**TASK-FEAT-002: Rolling Forecast Lock (6 hours)**
- [ ] Add `lockedPeriods` support to forecast engine
- [ ] Create `PATCH /api/companies/:id/lock-period` endpoint
- [ ] Update `buildForecastMonthLabels` to skip locked periods
- [ ] Add lock/unlock UI to ForecastGrid
- [ ] Test: Lock month, verify forecast window advances

**Files to Modify:**
```
src/lib/engine/index.ts
src/app/api/companies/[id]/lock-period/route.ts (NEW)
src/components/forecast/ForecastGrid.tsx
```

**Acceptance Criteria:**
- ✅ Locked periods treated as actuals
- ✅ Forecast window advances automatically
- ✅ Lock icon displays in grid header

---

### Day 4-5: Backend Specialist Agent + Frontend Specialist Agent

**TASK-FEAT-003: PDF Report Generation (10 hours)**
- [ ] Install `jspdf` and `html2canvas` (already installed)
- [ ] Create `PDFReportGenerator` class
- [ ] Design report template (P&L, BS, CF, metrics, charts)
- [ ] Implement `POST /api/reports/generate` endpoint
- [ ] Add "Generate Report" button to Reports page
- [ ] Test: Generate 12-month report, verify PDF valid

**Files to Create:**
```
src/lib/reports/pdf-generator.ts
src/app/api/reports/generate/route.ts
```

**Acceptance Criteria:**
- ✅ PDF contains all required sections
- ✅ Indian number formatting in PDF
- ✅ Generation completes <10s
- ✅ PDF opens in all standard readers

---

## Week 3: Indian Market Features

### Day 1-2: Backend Specialist Agent

**TASK-IND-002: GST Filing Status Tracker (8 hours)**
- [ ] Implement `gst_filings` table CRUD (schema already exists)
- [ ] Auto-populate filings from compliance engine output
- [ ] Compute due dates (GSTR-1: 11th, GSTR-3B: 20th)
- [ ] Create `PATCH /api/gst-filings/:id` endpoint for marking filed
- [ ] Add filing status grid to Compliance page
- [ ] Test: Verify overdue status updates automatically

**Files to Create:**
```
src/lib/db/queries/gst-filings.ts
src/app/api/gst-filings/route.ts
src/components/compliance/GSTFilingGrid.tsx
```

**Acceptance Criteria:**
- ✅ Filings auto-created from compliance output
- ✅ Due dates calculated correctly
- ✅ Overdue status updates daily
- ✅ Late fee calculation accurate

---

### Day 3-4: Backend Specialist Agent + Frontend Specialist Agent

**TASK-IND-003: Bank Reconciliation Status (10 hours)**
- [ ] Implement `bank_reconciliations` table CRUD (schema exists)
- [ ] Auto-create unreconciled rows on actuals import
- [ ] Create `PATCH /api/reconciliations/:id` endpoint
- [ ] Compute variance: `bank - book`
- [ ] Add reconciliation grid to Data page
- [ ] Display variance in ForecastGrid column headers
- [ ] Test: Reconcile month with variance, verify display

**Files to Create:**
```
src/lib/db/queries/bank-reconciliations.ts
src/app/api/reconciliations/route.ts
src/components/data/ReconciliationGrid.tsx
```

**Acceptance Criteria:**
- ✅ Reconciliation rows auto-created
- ✅ Variance calculated correctly
- ✅ Status badges display (green/amber/grey)
- ✅ Variance shows in grid headers

---

### Day 5: Frontend Specialist Agent

**TASK-FEAT-004: Cash Flow Sensitivity Analysis (6 hours)**
- [ ] Create `SensitivityPanel` component with sliders
- [ ] Implement real-time engine re-run on slider change
- [ ] Display impact: cash position, runway, net income
- [ ] Add "Reset to Baseline" button
- [ ] Test: Verify slider changes update metrics <500ms
- [ ] Test: Verify reset returns to baseline

**Files to Create:**
```
src/components/forecast/SensitivityPanel.tsx
```

**Acceptance Criteria:**
- ✅ Sliders update forecast in real-time
- ✅ Impact metrics display correctly
- ✅ Performance <500ms per slider change
- ✅ Reset restores baseline exactly

---

## Week 4: CA Workflow & Performance

### Day 1-2: Backend Specialist Agent + Frontend Specialist Agent

**TASK-FEAT-005: Multi-Company Dashboard (CA Firm View) (8 hours)**
- [ ] Create `GET /api/firm/companies` endpoint
- [ ] Fetch all companies user has access to
- [ ] Derive metrics from cached `forecast_results`
- [ ] Create CA Firm View page at `/firm`
- [ ] Display company cards with key metrics
- [ ] Add sort/filter controls
- [ ] Test: Verify performance with 100 companies

**Files to Create:**
```
src/app/api/firm/companies/route.ts
src/app/(app)/firm/page.tsx
src/components/firm/CompanyCard.tsx
```

**Acceptance Criteria:**
- ✅ All companies load in single API call
- ✅ Metrics derived from cached results
- ✅ Sort/filter works <500ms
- ✅ Compliance health indicator accurate

---

### Day 3-4: Performance Agent

**TASK-PERF-002: Mobile Optimization (8 hours)**
- [ ] Implement code splitting by route
- [ ] Lazy load Recharts library
- [ ] Remove unused Tailwind classes
- [ ] Optimize images (use Next.js Image component)
- [ ] Run Lighthouse audit, target >90 mobile score
- [ ] Test on low-end Android device (Android 8)

**Files to Modify:**
```
next.config.js (add code splitting)
src/components/dashboard/CashFlowWaterfall.tsx (lazy load Recharts)
tailwind.config.js (purge unused)
```

**Acceptance Criteria:**
- ✅ Bundle size <500KB (gzipped)
- ✅ Lighthouse mobile score >90
- ✅ Works on Android 8+
- ✅ 3G page load <5s

---

### Day 5: Logic Agent + Integration Agent

**TASK-TEST-001: Load Testing & 5-Pass Verification (4 hours)**
- [ ] Write Artillery.io load test script
- [ ] Run STRESS-001: 500 concurrent forecast computations
- [ ] Run STRESS-002: 50MB Excel import
- [ ] Run STRESS-003: CA firm view with 100 companies
- [ ] Run STRESS-004: Concurrent value rule edits
- [ ] Run all edge case torture tests
- [ ] Document results in test report

**Files to Create:**
```
tests/load/artillery-config.yml
tests/edge-cases/torture-tests.spec.ts
```

**Acceptance Criteria:**
- ✅ p95 latency <2s under load
- ✅ No DB deadlocks
- ✅ All edge cases pass
- ✅ 5-pass verification complete

---

## Agent Communication Protocol

### Daily Standup (Async)
Each agent posts to `DAILY_STANDUP.md`:
- ✅ Completed tasks
- 🚧 In-progress tasks
- 🚫 Blockers
- 📊 Metrics (test coverage, performance, security score)

### Handoff Protocol
When Agent A completes a task that Agent B depends on:
1. Agent A updates task status: ✅ COMPLETE
2. Agent A notifies Orchestrator
3. Orchestrator assigns dependent task to Agent B
4. Agent B verifies handoff (runs smoke test)

### Blocker Escalation
If any agent is blocked >2 hours:
1. Agent posts blocker to `BLOCKERS.md`
2. Orchestrator triages within 1 hour
3. Orchestrator reassigns or provides guidance

---

## Success Metrics Dashboard

### Security Score (Target: 100%)
- [ ] OAuth tokens encrypted
- [ ] Rate limiting distributed
- [ ] CSRF protection active
- [ ] File upload validated
- [ ] Sentry monitoring live

### Performance Score (Target: 95%)
- [ ] p95 latency <2s
- [ ] Bundle size <500KB
- [ ] Lighthouse >90
- [ ] 3G load <5s

### Feature Completeness (Target: 100%)
- [ ] 8/8 Fathom features
- [ ] GST tracker
- [ ] Bank reconciliation
- [ ] CA firm view
- [ ] PDF reports

### Data Integrity Score (Target: 100%)
- [ ] Balance sheet identity holds
- [ ] Cash flow continuity verified
- [ ] No floating-point arithmetic
- [ ] Forecast results persist

---

## Final Readiness Gate

**Orchestrator Agent** conducts final review:
1. ✅ All critical tasks complete
2. ✅ 5-pass verification passed
3. ✅ Load testing passed
4. ✅ Security audit passed
5. ✅ Production environment configured

**Go/No-Go Decision:** Orchestrator signs off on production deployment

---

**Execution Start Date:** April 14, 2026  
**Target Completion:** May 12, 2026 (4 weeks)  
**Estimated Effort:** 160 hours (distributed across 6 agents)
