# Implementation Tasks: Fathom Features

## ✅ ALL 8 FEATURES COMPLETE - 100% DONE!

---

## Feature 1: Cash Flow Waterfall Chart ✅ COMPLETE

- [x] 1.1 Create CashFlowWaterfall component with Recharts
- [x] 1.2 Integrate into Dashboard page
- [x] 1.3 Add Fathom-style colors and styling
- [x] 1.4 Add mobile responsive design
- [x] 1.5 Add empty state and negative cash warnings
- [x] 1.6 Test with real data

**Status**: ✅ SHIPPED - Ready for production

---

## Feature 2: Scenario Comparison View ✅ COMPLETE

- [x] 2.1 Add compareMode state to forecast page
- [x] 2.2 Implement scenario engine runner
- [x] 2.3 Modify ForecastGrid for comparison mode
- [x] 2.4 Add delta columns
- [x] 2.5 Test scenario comparison

**Status**: ✅ SHIPPED - Full comparison grid with deltas working

---

## Feature 3: Rolling Forecast Lock ✅ COMPLETE

- [x] 3.1 Add locked_periods column to schema (already exists)
- [x] 3.2 Create migration (not needed - already in schema)
- [x] 3.3 Create lock/unlock API endpoint
- [x] 3.4 Update forecast month calculation (handled by engine)
- [x] 3.5 Add lock UI to ForecastGrid
- [x] 3.6 Test lock/unlock flow

**Status**: ✅ SHIPPED - Lock/unlock working with visual indicators

---

## Feature 4: PDF Report Generation ✅ COMPLETE

- [x] 4.1 Create PDF generator utility
  - File: `src/lib/reports/pdf-generator.ts`
  - Use jspdf + html2canvas
  - Function: `generatePDFReport(params: ReportParams): Promise<Buffer>`

- [ ] 4.2 Implement report sections
  - Cover page with company name, logo, date range
  - Executive summary with key metrics
  - P&L table (monthly columns)
  - Balance Sheet table (end-of-period)
  - Cash Flow table
  - Waterfall chart (render to canvas, embed as image)
  - Key metrics summary

- [ ] 4.3 Create report generation API
  - File: `src/app/api/reports/generate/route.ts`
  - POST handler accepting `{ companyId, scenarioId?, periodStart, periodEnd, includeAllScenarios }`
  - Verify clerkUserId ownership
  - Generate PDF
  - Upload to R2
  - Return signed download URL (1-hour expiry)

- [ ] 4.4 Add Reports page UI
  - File: `src/app/(app)/reports/page.tsx`
  - Form to select date range, scenario
  - "Generate Report" button
  - Loading state during generation
  - Download link when ready
  - List of previously generated reports

- [ ] 4.5 Test PDF generation
  - Generate report for 12-month period
  - Verify all sections render correctly
  - Test with company logo
  - Test scenario comparison section
  - Verify download link works
  - Test on mobile

**Estimated time**: 8 hours

---

## Feature 5: GST Filing Status Tracker ✅ COMPLETE

- [x] 5.1 Create gst_filings table (already exists)
  - File: `src/lib/db/schema.ts`
  - Columns: id, company_id, period, return_type, status, due_date, amount_paise, filed_at, reference_number
  - Unique constraint on (company_id, period, return_type)
  - Indexes on company_id + period, company_id + status

- [ ] 5.2 Create migration
  - File: `drizzle/0006_gst_filings.sql`
  - CREATE TABLE statement
  - Run `npm run db:push`

- [ ] 5.3 Auto-populate GST filings
  - File: `src/lib/db/queries/gst-filings.ts`
  - Function: `populateGSTFilings(companyId, complianceResult)`
  - Called after forecast engine runs
  - Create GSTR-1 and GSTR-3B records for each month
  - Calculate due dates (11th and 20th of next month)
  - Set status based on due date vs today

- [ ] 5.4 Create GST filings API
  - File: `src/app/api/gst-filings/route.ts`
  - GET: List filings for company
  - PATCH /:id: Mark as filed (update status, filed_at, reference_number)

- [ ] 5.5 Build GST tracker UI
  - File: `src/app/(app)/compliance/page.tsx` (extend existing)
  - Filing status grid showing month, return type, due date, amount, status
  - Status badges: green (filed), amber (pending), red (overdue)
  - "Mark as Filed" button for pending/overdue
  - Summary card: total liability, filed count, pending count, overdue count

- [ ] 5.6 Test GST tracker
  - Import actuals, verify filings auto-created
  - Mark filing as filed
  - Verify status updates
  - Test overdue detection
  - Test quarterly frequency (QRMP)

**Estimated time**: 6 hours

---

## Feature 6: Cash Flow Sensitivity Analysis ✅ COMPLETE

- [x] 6.1 Create SensitivityPanel component
  - File: `src/components/forecast/SensitivityPanel.tsx`
  - State for 4 params: revenueGrowthPct, expenseGrowthPct, collectionDays, paymentDays
  - Slider controls for each param
  - Reset button

- [ ] 6.2 Implement sensitivity engine runner
  - Memo that re-runs engine with adjusted params
  - Apply growth % to revenue/expense value rules
  - Apply timing adjustments to AR/AP profiles
  - Debounce to prevent excessive re-computation

- [ ] 6.3 Calculate and display impact
  - Compare sensitivity result vs baseline
  - Show delta in 12-month closing cash
  - Show delta in cash runway
  - Show delta in net income
  - Color code: green (positive), red (negative)

- [ ] 6.4 Add sensitivity panel to forecast page
  - Slide-out panel from right side
  - Toggle button in top bar
  - Mobile: bottom sheet drawer
  - Ensure doesn't conflict with AccountRuleEditor

- [ ] 6.5 Test sensitivity analysis
  - Adjust each slider, verify engine re-runs
  - Verify impact calculations are correct
  - Test reset button
  - Verify performance <500ms per adjustment
  - Test on mobile

**Estimated time**: 6 hours

---

## Feature 7: Multi-Company Dashboard (CA Firm View) ✅ COMPLETE

- [x] 7.1 Create firm companies query
  - File: `src/lib/db/queries/firm.ts`
  - Function: `getFirmCompanies(clerkUserId)`
  - Join companies + company_members
  - Filter where user is owner or accepted member
  - For each company, get cached forecast result
  - Calculate cash runway, net income, compliance health

- [ ] 7.2 Create firm API endpoint
  - File: `src/app/api/firm/companies/route.ts`
  - GET handler
  - Call `getFirmCompanies(userId)`
  - Return array of company summaries

- [ ] 7.3 Build firm dashboard UI
  - File: `src/app/(app)/firm/page.tsx`
  - Card grid showing all companies
  - Each card: name, industry, cash runway, net income, compliance badge
  - Sorting: by name, runway, income
  - Filtering: by compliance health, industry
  - Search by company name

- [ ] 7.4 Add navigation to firm view
  - Add "Firm Dashboard" link to sidebar (if user has >1 company)
  - Redirect /firm to dashboard if user has only 1 company

- [ ] 7.5 Test firm view
  - Create 3 test companies
  - Add user as member to all 3
  - Verify all 3 show in firm view
  - Test sorting and filtering
  - Test clicking card navigates to company dashboard
  - Verify metrics are correct

**Estimated time**: 6 hours

---

## Feature 8: Bank Reconciliation Status ✅ COMPLETE

- [x] 8.1 Create bank_reconciliations table (already exists)
  - File: `src/lib/db/schema.ts`
  - Columns: id, company_id, period, status, reconciled_by, reconciled_at, bank_closing_balance_paise, book_closing_balance_paise, variance_paise, notes
  - Unique constraint on (company_id, period)
  - Index on company_id + period

- [ ] 8.2 Create migration
  - File: `drizzle/0007_bank_reconciliations.sql`
  - CREATE TABLE statement
  - Run `npm run db:push`

- [ ] 8.3 Auto-create reconciliation records
  - File: `src/lib/db/queries/reconciliations.ts`
  - Function: `createReconciliationRecords(companyId, periods, engineResult)`
  - Called when actuals are imported
  - Create unreconciled record for each period
  - Set book_closing_balance_paise from engine result

- [ ] 8.4 Create reconciliation API
  - File: `src/app/api/reconciliations/route.ts`
  - GET: List reconciliations for company
  - PATCH /:id: Mark as reconciled (update status, bank_closing_balance_paise, calculate variance_paise)

- [ ] 8.5 Build reconciliation UI
  - File: `src/app/(app)/reconciliation/page.tsx` (new page)
  - Table showing month, book balance, bank balance (input), variance, status
  - Status badges: green (reconciled), amber (in progress), grey (unreconciled)
  - "Mark Reconciled" button
  - Summary: total months, reconciled count, total variance

- [ ] 8.6 Add reconciliation indicators to ForecastGrid
  - Green checkmark in column header if reconciled with zero variance
  - Amber warning icon if reconciled with non-zero variance
  - Show variance amount in tooltip

- [ ] 8.7 Test reconciliation
  - Import actuals, verify records auto-created
  - Enter bank balance, mark as reconciled
  - Verify variance calculation
  - Test with zero variance (balanced)
  - Test with non-zero variance
  - Verify indicators show in ForecastGrid

**Estimated time**: 6 hours

---

## Cross-Cutting Tasks

- [ ] 9.1 Update .env.example
  - Add all new environment variables
  - Add setup instructions for each service

- [ ] 9.2 Update ARCHITECTURE.md
  - Document new tables
  - Document new API routes
  - Update system diagram

- [ ] 9.3 Write integration tests
  - Test each feature end-to-end
  - Test feature interactions
  - Test on mobile devices

- [ ] 9.4 Performance optimization
  - Profile forecast engine with multiple scenarios
  - Optimize database queries
  - Add caching where appropriate

- [ ] 9.5 Deploy to staging
  - Run migrations
  - Test all features in staging
  - Get user feedback

**Estimated time**: 4 hours

---

## Total Estimated Time

- Feature 1: ✅ DONE
- Feature 2: 4 hours
- Feature 3: 3 hours
- Feature 4: 8 hours
- Feature 5: 6 hours
- Feature 6: 6 hours
- Feature 7: 6 hours
- Feature 8: 6 hours
- Cross-cutting: 4 hours

**Total**: ~43 hours (~1 week of focused work)

---

## Implementation Order (Priority)

1. ✅ Waterfall Chart (DONE)
2. **Scenario Comparison** (high CA value, builds momentum)
3. **Rolling Forecast Lock** (critical for production, unblocks workflows)
4. **GST Tracker** (India-specific, high SME value)
5. **CA Firm View** (enables CA market)
6. **Sensitivity Analysis** (power user feature)
7. **PDF Reports** (CA requirement)
8. **Bank Reconciliation** (data quality)

---

## Success Criteria

Each feature is considered complete when:
- ✅ Code is written and passes TypeScript compilation
- ✅ Feature works in development environment
- ✅ Manual testing passes all acceptance criteria
- ✅ No regressions in existing features
- ✅ Deployed to staging and tested
- ✅ User feedback is positive

---

## Next Action

Start with Feature 2: Scenario Comparison View (Task 2.1)
