# Technical Design Document: Fathom-Level Features

## Overview

This document specifies the technical design for eight Fathom-level cashflow intelligence features for CashFlowIQ. Complete design for all features with implementation details.

### Design Principles

1. **Paise Integrity**: All monetary values stored and computed as integer paise
2. **Pure Engine**: `runForecastEngine()` remains side-effect free
3. **Balance Sheet Invariant**: `totalAssets === totalLiabilities + totalEquity`
4. **Auth First**: Every API route verifies `clerkUserId` ownership
5. **Indian UX**: Optimized for mobile, intermittent connectivity
6. **Performance**: <2s response times on 3G

---

## Feature 1: Cash Flow Waterfall Chart ✅ COMPLETE

**Status**: Implemented in `src/components/dashboard/CashFlowWaterfall.tsx`

**Implementation**: Pure frontend component using Recharts, derives data from engineResult, Fathom colors, mobile responsive.

---

## Feature 2: Scenario Comparison View

### State Management
```typescript
const [compareMode, setCompareMode] = useState(false)
const scenarioResults = useMemo(() => {
  if (!compareMode) return null
  return scenarios.slice(0, 3).map(s => ({
    id: s.id,
    name: s.name,
    result: runScenarioForecastEngine(/* with s.overrides */)
  }))
}, [compareMode, scenarios, /* deps */])
```

### UI: Add toggle button, modify ForecastGrid to show multiple column groups, add delta columns

---

## Feature 3: Rolling Forecast Lock

### DB Schema
```sql
ALTER TABLE companies ADD COLUMN locked_periods TEXT DEFAULT '[]';
```

### API: PATCH /api/companies/:id/lock-period
### UI: Lock icon in grid headers, lock/unlock button

---

## Feature 4: PDF Report Generation

### Tech: jspdf + html2canvas
### API: POST /api/reports/generate
### Content: Cover, P&L, BS, CF, Waterfall chart, Key metrics

---

## Feature 5: GST Filing Tracker

### DB Schema
```sql
CREATE TABLE gst_filings (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  period TEXT NOT NULL,
  return_type TEXT NOT NULL,
  status TEXT NOT NULL,
  due_date TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  filed_at TEXT,
  UNIQUE(company_id, period, return_type)
);
```

### Auto-populate from compliance engine output
### UI: Filing status grid with mark-as-filed action

---

## Feature 6: Sensitivity Analysis

### Component: SensitivityPanel with sliders for revenue growth %, expense growth %, collection days, payment days
### Computation: Re-run engine with adjusted params, show impact on cash and runway
### Performance: <500ms re-compute

---

## Feature 7: CA Firm View

### Query: Get all companies where user is owner or member
### Metrics: Cash runway, net income, compliance health from cached forecast results
### UI: Card grid with sorting and filtering

---

## Feature 8: Bank Reconciliation

### DB Schema
```sql
CREATE TABLE bank_reconciliations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  period TEXT NOT NULL,
  status TEXT NOT NULL,
  bank_closing_balance_paise INTEGER,
  book_closing_balance_paise INTEGER,
  variance_paise INTEGER,
  UNIQUE(company_id, period)
);
```

### Auto-create records when actuals imported
### UI: Reconciliation grid with bank balance input and mark-reconciled action

---

## Implementation Order

1. ✅ Waterfall Chart (DONE)
2. Scenario Comparison (4 hours)
3. Rolling Forecast Lock (3 hours)
4. PDF Reports (8 hours)
5. GST Tracker (6 hours)
6. Sensitivity Analysis (6 hours)
7. CA Firm View (6 hours)
8. Bank Reconciliation (6 hours)

**Total**: ~40 hours
