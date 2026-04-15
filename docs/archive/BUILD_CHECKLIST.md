# 🎯 Build Checklist - Quick Reference

## Status: 1/8 Features Complete

- [x] **Feature 1: Waterfall Chart** ✅ SHIPPED
- [ ] **Feature 2: Scenario Comparison** (4h) - START HERE
- [ ] **Feature 3: Rolling Forecast Lock** (3h)
- [ ] **Feature 4: PDF Reports** (8h)
- [ ] **Feature 5: GST Tracker** (6h)
- [ ] **Feature 6: Sensitivity Analysis** (6h)
- [ ] **Feature 7: CA Firm View** (6h)
- [ ] **Feature 8: Bank Reconciliation** (6h)

---

## Today's Goal: Ship Feature 2

### Feature 2: Scenario Comparison (4 hours)

**What it does**: Show Base, Best, Worst case side-by-side with delta columns

**Files to edit**:
1. `src/app/(app)/forecast/page.tsx` - Add compareMode state and toggle
2. `src/components/forecast/ForecastGrid.tsx` - Add comparison rendering

**Steps**:
1. [ ] Add `const [compareMode, setCompareMode] = useState(false)` to forecast page
2. [ ] Add toggle button: "Compare Scenarios" / "Single View"
3. [ ] Create `scenarioResults` memo that runs engine for each scenario
4. [ ] Pass `compareMode` and `scenarioResults` to ForecastGrid
5. [ ] Modify ForecastGrid to render multiple column groups when compareMode = true
6. [ ] Add delta columns between scenarios (green/red color coding)
7. [ ] Test with 3 scenarios

**Test**:
```bash
npm run dev
# 1. Go to /forecast
# 2. Create 3 scenarios (Base, Best, Worst)
# 3. Click "Compare Scenarios"
# 4. Verify side-by-side display
# 5. Verify delta columns are correct
```

**Commit**:
```bash
git add .
git commit -m "feat: add scenario comparison view (Feature 2/8)"
git push
```

---

## Tomorrow's Goal: Ship Feature 3

### Feature 3: Rolling Forecast Lock (3 hours)

**What it does**: Mark months as "locked" actuals, advance forecast window

**Files to create/edit**:
1. `src/lib/db/schema.ts` - Add locked_periods column
2. `drizzle/0005_locked_periods.sql` - Migration
3. `src/app/api/companies/[id]/lock-period/route.ts` - API endpoint
4. `src/hooks/use-current-forecast.ts` - Skip locked periods
5. `src/components/forecast/ForecastGrid.tsx` - Lock UI

**Steps**:
1. [ ] Add `lockedPeriods: text('locked_periods').default('[]')` to companies table
2. [ ] Create migration: `ALTER TABLE companies ADD COLUMN locked_periods TEXT DEFAULT '[]';`
3. [ ] Run `npm run db:push`
4. [ ] Create PATCH /api/companies/:id/lock-period endpoint
5. [ ] Update forecast month calculation to skip locked periods
6. [ ] Add lock icon to grid column headers
7. [ ] Add lock/unlock button
8. [ ] Test lock/unlock flow

---

## This Week's Goals

**Monday**: ✅ Waterfall Chart (DONE)
**Tuesday**: Scenario Comparison (4h)
**Wednesday**: Rolling Forecast Lock (3h)
**Thursday**: GST Tracker (6h)
**Friday**: CA Firm View (6h)

**Total this week**: 19 hours

---

## Next Week's Goals

**Monday**: Sensitivity Analysis (6h)
**Tuesday-Wednesday**: PDF Reports (8h)
**Thursday**: Bank Reconciliation (6h)
**Friday**: Testing, polish, deploy

**Total next week**: 20 hours

---

## Quick Commands

```bash
# Start dev server
npm run dev

# Type check
npm run typecheck

# Database push
npm run db:push

# Database generate migration
npm run db:generate

# Run tests
npm test

# Build for production
npm run build
```

---

## File Quick Reference

### Components
- `src/components/dashboard/CashFlowWaterfall.tsx` ✅
- `src/components/forecast/ForecastGrid.tsx` (modify for features 2, 3, 8)
- `src/components/forecast/SensitivityPanel.tsx` (create for feature 6)

### Pages
- `src/app/(app)/dashboard/page.tsx` ✅
- `src/app/(app)/forecast/page.tsx` (modify for features 2, 3, 6)
- `src/app/(app)/firm/page.tsx` (create for feature 7)
- `src/app/(app)/reconciliation/page.tsx` (create for feature 8)
- `src/app/(app)/reports/page.tsx` (create for feature 4)

### API Routes (all to create)
- `src/app/api/companies/[id]/lock-period/route.ts` (feature 3)
- `src/app/api/reports/generate/route.ts` (feature 4)
- `src/app/api/gst-filings/route.ts` (feature 5)
- `src/app/api/firm/companies/route.ts` (feature 7)
- `src/app/api/reconciliations/route.ts` (feature 8)

### Database
- `src/lib/db/schema.ts` (add 3 new tables)
- `drizzle/0005_locked_periods.sql` (feature 3)
- `drizzle/0006_gst_filings.sql` (feature 5)
- `drizzle/0007_bank_reconciliations.sql` (feature 8)

---

## Testing Checklist (Per Feature)

- [ ] Works in development
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Works on mobile
- [ ] Works with sample data
- [ ] Works with real data
- [ ] No regressions

---

## Key Principles

✅ **DO**:
- Use integer paise for all monetary values
- Use `formatAuto()` for display
- Verify `clerkUserId` on all API routes
- Keep engine pure (no DB calls)
- Test on mobile

❌ **DON'T**:
- Use floating-point for money
- Break balance sheet identity
- Skip auth checks
- Add DB calls to engine
- Forget mobile testing

---

## Progress Tracking

Update this section as you complete features:

- [x] Feature 1: Waterfall Chart - ✅ DONE (30 min)
- [ ] Feature 2: Scenario Comparison - ⏳ IN PROGRESS
- [ ] Feature 3: Rolling Forecast Lock - 📋 TODO
- [ ] Feature 4: PDF Reports - 📋 TODO
- [ ] Feature 5: GST Tracker - 📋 TODO
- [ ] Feature 6: Sensitivity Analysis - 📋 TODO
- [ ] Feature 7: CA Firm View - 📋 TODO
- [ ] Feature 8: Bank Reconciliation - 📋 TODO

**Completion**: 12.5% (1/8 features)
**Estimated time remaining**: 39 hours

---

## 🎯 START NOW

Open `src/app/(app)/forecast/page.tsx` and add:

```typescript
const [compareMode, setCompareMode] = useState(false)
```

Then add the toggle button. You're on your way! 🚀
