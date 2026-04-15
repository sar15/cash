# CashFlowIQ Production Readiness - Execution Plan

## Current Status Analysis

**What's Working:**
- ✅ Forecast engine (pure, tested)
- ✅ Basic CRUD APIs
- ✅ Frontend components (ForecastGrid, Dashboard)
- ✅ Two specs completed: production-fixes (21/21 tasks ✓), final-gaps (7/7 tasks ✓)

**What's Blocking:**
- ❌ Fathom features spec stuck at design phase (0/8 features implemented)
- ❌ No tasks.md file created yet
- ❌ Trying to design all 8 features at once (analysis paralysis)

**Root Cause:** Attempting to design 8 complex features simultaneously instead of implementing incrementally.

---

## Strategy: Incremental Delivery

Instead of designing all 8 features upfront, we'll use a **build-measure-learn** approach:

1. Pick the highest-value feature
2. Design ONLY that feature (minimal design doc)
3. Implement it completely
4. Verify it works
5. Move to next feature

This gets you to production faster and provides real feedback loops.

---

## Phase 1: Quick Wins (Week 1) - Get to Production

### Priority 1: Cash Flow Waterfall Chart (Req 1)
**Why first:** Pure frontend, no backend changes, immediate visual impact

**Design (Minimal):**
```typescript
// New component: src/components/dashboard/CashFlowWaterfall.tsx
interface WaterfallData {
  month: string
  opening: number  // paise
  inflows: number  // paise
  outflows: number // paise
  closing: number  // paise
}

function buildWaterfallData(engineResult: EngineResult): WaterfallData[] {
  return engineResult.integrationResults.map((m, i) => ({
    month: forecastMonths[i],
    opening: i === 0 ? m.bs.cash : engineResult.integrationResults[i-1].bs.cash,
    inflows: m.cf.operatingCashFlow > 0 ? m.cf.operatingCashFlow : 0,
    outflows: m.cf.operatingCashFlow < 0 ? Math.abs(m.cf.operatingCashFlow) : 0,
    closing: m.bs.cash
  }))
}
```

**Implementation Steps:**
1. Create `CashFlowWaterfall.tsx` component using Recharts
2. Add to Dashboard page below key metrics
3. Style with Fathom colors (green #059669, red #DC2626)
4. Test with sample data

**Time:** 1 day

---

### Priority 2: Scenario Comparison View (Req 2)
**Why second:** Leverages existing scenario infrastructure, high CA value

**Design (Minimal):**
```typescript
// Extend src/app/(app)/forecast/page.tsx
const [compareMode, setCompareMode] = useState(false)

// When compareMode = true:
// - Run engine for each scenario (baseline, best, worst)
// - Display side-by-side in ForecastGrid
// - Add delta columns between scenarios

interface ScenarioComparison {
  baseline: EngineResult
  scenarios: Array<{ id: string; name: string; result: EngineResult }>
  deltas: Array<{ scenarioId: string; values: number[][] }> // paise
}
```

**Implementation Steps:**
1. Add "Compare Scenarios" toggle to forecast page
2. Run engine for each active scenario
3. Modify ForecastGrid to accept multiple results
4. Add delta columns with color coding
5. Test with 3 scenarios

**Time:** 2 days

---

### Priority 3: Rolling Forecast Lock (Req 3)
**Why third:** Critical for production use, enables rolling window

**Design (Minimal):**
```sql
-- Add to companies table
ALTER TABLE companies ADD COLUMN locked_periods TEXT DEFAULT '[]';
-- JSON array of YYYY-MM-01 strings

-- API: PATCH /api/companies/:id/lock-period
{
  "period": "2025-03-01",
  "action": "lock" | "unlock"
}
```

**Implementation Steps:**
1. Add `locked_periods` column to schema
2. Create migration
3. Add lock/unlock API endpoint
4. Update `buildForecastMonthLabels` to skip locked periods
5. Add lock icon to ForecastGrid column headers
6. Test lock/unlock flow

**Time:** 1 day

---

## Phase 2: Backend Infrastructure (Week 2)

### Priority 4: Forecast Result Caching (from BACKEND_PLAN.md Phase 2)
**Why:** Performance - stop recomputing on every render

**Implementation:**
1. Fix forecast result persistence (already in final-gaps spec)
2. Add cache invalidation on config changes
3. Add `config_version` to companies table
4. Update `useCurrentForecast` to check cache first

**Time:** 2 days

---

### Priority 5: Background Jobs with Inngest (from BACKEND_PLAN.md Phase 3)
**Why:** Enables compliance reminders, scheduled reports

**Implementation:**
1. Install Inngest
2. Create compliance reminder function
3. Create forecast pre-computation function
4. Wire into API routes

**Time:** 2 days

---

## Phase 3: CA Features (Week 3)

### Priority 6: Multi-Company Dashboard (Req 7)
**Why:** Critical for CA market, high differentiation

**Implementation:**
1. Create `/firm` route
2. Add company summary API
3. Build card grid UI
4. Add sorting/filtering

**Time:** 2 days

---

### Priority 7: PDF Report Generation (Req 4)
**Why:** CA requirement, enables client sharing

**Implementation:**
1. Install PDF library (react-pdf or puppeteer)
2. Create report template
3. Add generation endpoint
4. Wire into Reports page

**Time:** 3 days

---

## Phase 4: Indian Market Features (Week 4)

### Priority 8: GST Filing Tracker (Req 5)
**Why:** India-specific, compliance critical

**Implementation:**
1. Create `gst_filings` table
2. Auto-populate from engine compliance output
3. Build filing status UI
4. Add mark-as-filed action

**Time:** 2 days

---

### Priority 9: Bank Reconciliation (Req 8)
**Why:** Data quality, forecast accuracy

**Implementation:**
1. Create `bank_reconciliations` table
2. Add reconciliation status API
3. Build reconciliation UI
4. Add variance tracking

**Time:** 2 days

---

## Phase 5: Advanced Features (Week 5)

### Priority 10: Sensitivity Analysis (Req 6)
**Why:** Power user feature, high engagement

**Implementation:**
1. Create sensitivity panel component
2. Add slider controls
3. Re-run engine with adjusted params
4. Display impact metrics

**Time:** 2 days

---

## Deferred to Post-Launch

These are valuable but not blocking production:

- **Zoho Books Integration** (BACKEND_PLAN Phase 8) - 2 weeks
- **Tally Integration** - 2 weeks
- **Scheduled Report Delivery** - 1 week
- **Audit Trail** (BACKEND_PLAN Phase 6) - 1 week

---

## Immediate Next Steps (Today)

1. **Complete Waterfall Chart** (4 hours)
   - Create component
   - Wire into Dashboard
   - Test with real data

2. **Start Scenario Comparison** (4 hours)
   - Add compare toggle
   - Run engine for multiple scenarios
   - Display side-by-side

3. **Deploy to Staging** (End of day)
   - Verify waterfall works in production
   - Get user feedback

---

## Success Metrics

**Week 1 Goals:**
- ✅ Waterfall chart live
- ✅ Scenario comparison working
- ✅ Rolling forecast lock functional
- ✅ Deployed to staging

**Week 2 Goals:**
- ✅ Forecast caching working (2s → 200ms load time)
- ✅ Compliance reminders sending
- ✅ Background jobs running

**Week 3 Goals:**
- ✅ CA firm view live
- ✅ PDF reports generating
- ✅ 3 CA firms onboarded

**Production Ready Checklist:**
- [ ] All Phase 1 features complete
- [ ] Forecast caching working
- [ ] Background jobs running
- [ ] Error monitoring (Sentry) configured
- [ ] Rate limiting active
- [ ] 5 CA firms using in production

---

## Key Principles

1. **Ship incrementally** - Don't wait for all 8 features
2. **Test in production** - Deploy to staging after each feature
3. **Get feedback early** - Show CAs the waterfall chart tomorrow
4. **No analysis paralysis** - Design just enough, then build
5. **Preserve invariants** - Paise arithmetic, pure engine, balance sheet identity

---

## What NOT to Do

❌ Don't design all 8 features before implementing any
❌ Don't build Zoho integration before core features work
❌ Don't add GraphQL, microservices, or other complexity
❌ Don't break the forecast engine purity
❌ Don't introduce floating-point monetary arithmetic

---

## Questions to Answer Before Starting

1. **Do you have Recharts installed?** (for waterfall chart)
2. **Do you have a staging environment?** (for testing)
3. **Do you have 1-2 CA firms ready to test?** (for feedback)

Let's start with the waterfall chart RIGHT NOW. It's pure frontend, high impact, and will get you unstuck.
