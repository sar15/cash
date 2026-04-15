# Requirements Document

## Introduction

This document specifies requirements for eight Fathom-level cashflow intelligence features for CashFlowIQ — a Next.js financial forecasting platform targeting Indian SMEs and Chartered Accountants (CAs). These features close the gap between CashFlowIQ and Fathom HQ's cashflow product, with additional India-specific capabilities (GST filing tracker, Indian number formats, paise-integer arithmetic). Features are ordered by priority: visual impact first, then forecasting depth, then CA workflow, then data quality.

All monetary values remain integer paise throughout. The forecast engine (`runForecastEngine()`) remains pure with no DB calls. The balance sheet invariant `totalAssets === totalLiabilities + totalEquity` must hold after every computation. Period keys are always `YYYY-MM-01`. Every DB write verifies `clerkUserId` ownership.

---

## Glossary

- **CashFlowIQ**: The forecasting platform being built.
- **Forecast_Engine**: The pure function `runForecastEngine()` in `src/lib/engine/index.ts`.
- **Three_Way_Model**: The integrated P&L, Balance Sheet, and Cash Flow statement produced by the Forecast_Engine.
- **Paise**: Integer unit of Indian currency (1 INR = 100 paise). All monetary storage and computation uses paise.
- **Period**: A calendar month stored as `YYYY-MM-01` (e.g., `2025-04-01`).
- **Scenario**: A named set of forecast overrides (Base, Best, Worst case) stored in the `scenarios` table.
- **Locked_Period**: A Period that has been marked as historical actuals, causing the forecast window to advance past it.
- **Waterfall_Chart**: A visual bridge chart showing opening cash → inflows → outflows → closing cash per month.
- **Sensitivity_Slider**: A UI control that adjusts a single forecast assumption (e.g., revenue growth %) and triggers real-time engine re-evaluation.
- **CA**: Chartered Accountant — a professional who manages financial reporting for multiple client companies.
- **CA_Firm_View**: A portfolio dashboard showing all companies a CA manages, with key metrics per company.
- **GSTR_1**: Monthly/quarterly GST return for outward supplies, due by the 11th of the following month.
- **GSTR_3B**: Monthly GST summary return with tax payment, due by the 20th of the following month.
- **Reconciliation_Status**: Whether a given month's actuals have been verified against a bank statement.
- **PDF_Report**: A branded, downloadable PDF containing P&L, Balance Sheet, Cash Flow, key metrics, and charts.
- **Indian_Number_Format**: Display convention using lakhs (1,00,000) and crores (1,00,00,000) with ₹ prefix.
- **Runway**: Number of months of cash remaining at the current average monthly burn rate.
- **Delta_Column**: A column in the Scenario_Comparison_View showing the arithmetic difference between two scenario values.
- **Sensitivity_Analysis**: A what-if analysis showing how changes to key assumptions affect the cash position.
- **Report_Generator**: The subsystem responsible for producing PDF_Reports on demand.
- **Reconciliation_Engine**: The subsystem that compares monthly actuals against bank statement data to produce Reconciliation_Status.
- **GST_Tracker**: The subsystem that tracks GSTR-1 and GSTR-3B filing status, due dates, and amounts.
- **Waterfall_Builder**: The subsystem that derives opening cash, inflows, outflows, and closing cash from Three_Way_Model output.
- **Scenario_Comparator**: The subsystem that runs the Forecast_Engine for each Scenario and aligns results into a side-by-side grid.

---

## Requirements

### Requirement 1: Cash Flow Waterfall Chart

**User Story:** As an SME owner, I want to see a visual cash bridge chart on my dashboard showing how cash moves from opening balance through inflows and outflows to closing balance each month, so that I can immediately understand where cash is being created or consumed without reading a table.

#### Acceptance Criteria

1. WHEN the Dashboard page loads and the Forecast_Engine has produced results, THE Waterfall_Builder SHALL derive, for each forecast month: opening cash balance (paise), total cash inflows (paise), total cash outflows (paise), and closing cash balance (paise) — all sourced from `rawIntegrationResults[n].cf` and `rawIntegrationResults[n].bs.cash`.

2. THE Waterfall_Chart SHALL render a stacked bar/waterfall chart with four segments per month: opening balance (neutral), inflows (green `#059669`), outflows (red `#DC2626`), and closing balance (neutral `#0F172A`), using Recharts or a compatible charting library already present in the project.

3. WHEN a month's closing cash balance is negative, THE Waterfall_Chart SHALL render that month's closing segment in red (`#DC2626`) and display a warning indicator.

4. THE Waterfall_Chart SHALL display all monetary values in Indian_Number_Format (lakhs/crores with ₹ prefix) using the existing `formatAuto` utility.

5. WHEN the user hovers over any bar segment, THE Waterfall_Chart SHALL display a tooltip showing: month label, segment name, value in Indian_Number_Format, and the running cash position.

6. THE Waterfall_Chart SHALL be responsive and render correctly on screens as narrow as 360px (Indian mobile baseline), collapsing to a scrollable horizontal view when the chart width exceeds the viewport.

7. WHEN the Forecast_Engine result is null or contains zero months, THE Waterfall_Chart SHALL render an empty-state placeholder with the message "Import financial data to see your cash flow waterfall."

8. THE Waterfall_Builder SHALL compute `closingCash[n] = openingCash[n] + inflows[n] - outflows[n]` for all n, and THE Waterfall_Chart SHALL verify this identity holds before rendering; IF the identity fails for any month, THEN THE Waterfall_Chart SHALL log a console error and skip that month's bar.

9. FOR ALL valid Three_Way_Model outputs, the Waterfall_Builder's closing cash for month n SHALL equal the opening cash for month n+1 (round-trip continuity property).

---

### Requirement 2: Scenario Comparison View

**User Story:** As an SME owner or CA, I want to see Base, Best, and Worst case scenarios side-by-side in a single grid with delta columns, so that I can understand the range of outcomes and make informed decisions without switching between scenario tabs.

#### Acceptance Criteria

1. WHEN the user navigates to the Forecast page and at least two Scenarios exist, THE Scenario_Comparator SHALL offer a "Compare Scenarios" toggle in the top bar.

2. WHEN the user activates the Compare Scenarios toggle, THE Scenario_Comparator SHALL run the Forecast_Engine independently for each active Scenario (up to 3) using that Scenario's overrides, producing a separate `EngineResult` per Scenario — without mutating global state.

3. THE Scenario_Comparison_View SHALL render a grid with: a frozen left column for account/metric names, one column group per Scenario (showing monthly values), and one Delta_Column between each adjacent Scenario pair showing `scenarioB[month] - scenarioA[month]` in paise.

4. WHEN a Delta_Column value is positive (scenario B is better), THE Scenario_Comparison_View SHALL render it in green (`#059669`); WHEN negative, in red (`#DC2626`); WHEN zero, in muted grey (`#CBD5E1`).

5. THE Scenario_Comparison_View SHALL display the same row structure as the existing ForecastGrid P&L view: Revenue, COGS, Gross Profit, Operating Expenses, Net Income — plus a Cash row sourced from `bs.cash`.

6. WHEN the user clicks a Scenario column header, THE Scenario_Comparison_View SHALL highlight that Scenario's columns and allow the user to set it as the active Scenario.

7. THE Scenario_Comparator SHALL complete all Scenario engine runs within 2 seconds on a device with 2GB RAM and a 3G connection (computation is client-side; network latency does not apply to the engine run itself).

8. IF a Scenario has no overrides defined, THEN THE Scenario_Comparator SHALL use the baseline forecast values for that Scenario and display a "(Baseline)" label in the column header.

9. FOR ALL Scenario pairs (A, B), the Delta_Column value for any metric SHALL equal `B_value - A_value` for every month — this identity must hold for all valid engine inputs (metamorphic property).

10. THE Scenario_Comparison_View SHALL display monetary values in Indian_Number_Format and percentage metrics (gross margin, net margin) as percentages rounded to one decimal place.

---

### Requirement 3: Rolling Forecast Lock

**User Story:** As an SME owner, I want to mark a month as "locked" (historical actual), so that the forecast window automatically advances forward and I always see a rolling 12-month forward view rather than a fixed window that goes stale.

#### Acceptance Criteria

1. THE Forecast_Engine SHALL accept a `lockedPeriods` array of Period strings in its options; WHEN a Period is locked, THE Forecast_Engine SHALL treat that month's values as fixed actuals sourced from `monthlyActuals` rather than computed forecasts.

2. WHEN the user clicks "Lock as Actual" on a month column in the Forecast page, THE CashFlowIQ system SHALL write the Period to a `locked_periods` column (JSON array of `YYYY-MM-01` strings) on the `companies` table via `PATCH /api/companies/:id/lock-period`, verifying `clerkUserId` ownership before writing.

3. WHEN a Period is locked, THE CashFlowIQ system SHALL advance the forecast start month to the first unlocked Period, maintaining a rolling 12-month forward window from that point.

4. WHEN the user locks a Period that has no actuals in `monthly_actuals`, THE CashFlowIQ system SHALL display an inline warning: "No actuals found for [Month]. Lock anyway?" and require explicit confirmation before proceeding.

5. THE CashFlowIQ system SHALL allow the user to unlock a previously locked Period via "Unlock" action, which removes the Period from `locked_periods` and restores the forecast computation for that month.

6. WHEN a Period is locked, THE Forecast_Engine SHALL use the actual `monthly_actuals` values for that Period's accounts as the basis for subsequent forecast months' rolling average and growth rule calculations.

7. THE CashFlowIQ system SHALL display locked months in the ForecastGrid with a distinct visual treatment: a lock icon (🔒) in the column header and a light grey background (`#F8FAFC`) on all cells in that column.

8. IF the user attempts to lock a Period that is in the future (no actuals exist and the Period is after today), THEN THE CashFlowIQ system SHALL reject the lock with the message "Cannot lock a future period with no actuals."

9. FOR ALL sequences of lock operations, the forecast window start SHALL always equal the Period immediately following the latest locked Period — this invariant must hold regardless of the order in which periods are locked or unlocked.

10. WHEN all 12 months of the current forecast window are locked, THE CashFlowIQ system SHALL automatically extend the forecast window by 12 additional months.

---

### Requirement 4: On-Demand PDF Report Generation

**User Story:** As a CA or SME owner, I want to generate and download a branded PDF report containing P&L, Balance Sheet, Cash Flow, key metrics, and charts on demand from the Reports page, so that I can share professional financial reports with stakeholders without manual formatting.

#### Acceptance Criteria

1. THE Report_Generator SHALL expose a "Generate Report" button on the `/reports` page that, when clicked, triggers server-side PDF generation via `POST /api/reports/generate` with `{ companyId, scenarioId?, periodStart, periodEnd }`.

2. THE Report_Generator SHALL produce a PDF containing: company name and logo (if set), report generation date, selected period range, P&L statement (monthly columns), Balance Sheet (end-of-period snapshot), Cash Flow statement, key metrics summary (cash runway, net income, gross margin %, working capital days), and the Cash Flow Waterfall Chart as an embedded image.

3. WHEN the user submits a report generation request, THE Report_Generator SHALL respond within 10 seconds for a 12-month report on a standard Vercel serverless function; IF generation exceeds 10 seconds, THEN THE Report_Generator SHALL return a job ID and notify the user via the existing notification feed when the PDF is ready.

4. THE Report_Generator SHALL format all monetary values in Indian_Number_Format (₹ lakhs/crores) in the PDF output.

5. THE Report_Generator SHALL apply the company's branding: company name in the header, logo image (from `companies.logoUrl`) if available, and a footer with "Generated by CashFlowIQ" and the generation timestamp.

6. THE Report_Generator SHALL produce a valid, non-corrupted PDF file that can be opened by standard PDF readers (Adobe Acrobat, browser PDF viewer, mobile PDF apps).

7. WHEN the PDF is ready, THE Report_Generator SHALL return a signed download URL valid for 1 hour; IF the URL expires, THEN THE Report_Generator SHALL allow the user to regenerate the report.

8. THE Report_Generator SHALL verify `clerkUserId` ownership of the `companyId` before generating any report.

9. WHERE the company has multiple Scenarios defined, THE Report_Generator SHALL allow the user to select which Scenario's forecast data to include in the report.

10. THE Report_Generator SHALL include a "Scenario Comparison" section in the PDF when the user selects "Include all scenarios" — showing the side-by-side comparison table for Net Income and Cash Position across all Scenarios.

11. FOR ALL valid `EngineResult` inputs, the P&L totals in the generated PDF SHALL match the values displayed in the ForecastGrid for the same period and Scenario (round-trip consistency property).

---

### Requirement 5: GST Filing Status Tracker

**User Story:** As an Indian SME owner or CA, I want to track which GST returns (GSTR-1, GSTR-3B) have been filed vs pending for each month, with due dates and amounts, so that I never miss a filing deadline and can see my GST compliance health at a glance.

#### Acceptance Criteria

1. THE GST_Tracker SHALL maintain a `gst_filings` table with columns: `id`, `company_id`, `period` (YYYY-MM-01), `return_type` (`GSTR-1` | `GSTR-3B`), `status` (`pending` | `filed` | `overdue`), `due_date` (text, ISO date), `amount_paise` (integer), `filed_at` (text, nullable), `reference_number` (text, nullable), `created_at`.

2. THE GST_Tracker SHALL auto-populate `gst_filings` rows for each month when the Forecast_Engine produces compliance output, deriving `amount_paise` from `compliance.gst.months[n].netPayable` (already in paise).

3. THE GST_Tracker SHALL compute due dates as: GSTR-1 due on the 11th of the month following the Period; GSTR-3B due on the 20th of the month following the Period.

4. WHEN today's date is past the due date and the filing `status` is still `pending`, THE GST_Tracker SHALL automatically update the `status` to `overdue`.

5. WHEN the user marks a filing as "Filed" via `PATCH /api/gst-filings/:id`, THE GST_Tracker SHALL update `status` to `filed`, set `filed_at` to the current timestamp, and optionally store a `reference_number` provided by the user — verifying `clerkUserId` ownership before writing.

6. THE GST_Tracker SHALL render a filing status grid on the `/compliance` page showing: month, GSTR-1 status (with due date and amount), GSTR-3B status (with due date and amount), and a "Mark as Filed" action for pending/overdue rows.

7. THE GST_Tracker SHALL display status badges: green "Filed" for filed returns, amber "Pending" for upcoming returns, red "Overdue" for past-due unfiled returns.

8. WHEN a GSTR-3B filing is overdue, THE GST_Tracker SHALL display the number of days overdue and an estimated late fee (₹50/day for nil returns, ₹100/day for returns with tax liability, capped at ₹10,000 per the GST Act) — all amounts in paise.

9. THE GST_Tracker SHALL display a summary card showing: total GST liability for the current financial year (paise), total filed, total pending, and total overdue count.

10. WHERE the company's `complianceConfig.gstFrequency` is `quarterly`, THE GST_Tracker SHALL group filings into quarters (Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar) and adjust due dates accordingly (QRMP scheme: GSTR-3B due on 22nd/24th depending on state category).

11. FOR ALL periods where `status = filed`, the `filed_at` timestamp SHALL be non-null and the `amount_paise` SHALL be a non-negative integer — these invariants must hold for all valid filing records.

---

### Requirement 6: Cash Flow Sensitivity Analysis

**User Story:** As a power user (SME owner or CA), I want to adjust key forecast assumptions using sliders (revenue growth %, expense growth %, collection days) and see the impact on cash position in real-time, so that I can understand which levers have the most impact on my cash runway.

#### Acceptance Criteria

1. THE CashFlowIQ system SHALL provide a Sensitivity Analysis panel accessible from the Forecast page, containing sliders for: Revenue Growth % (range: -50% to +100%, step: 1%), Expense Growth % (range: -50% to +100%, step: 1%), Collection Days / AR Days (range: 0 to 180 days, step: 1 day), and Payment Days / AP Days (range: 0 to 180 days, step: 1 day).

2. WHEN the user moves any Sensitivity_Slider, THE CashFlowIQ system SHALL re-run the Forecast_Engine with the adjusted parameters within 500ms and update the displayed cash position, runway, and net income metrics without a full page reload.

3. THE Sensitivity Analysis panel SHALL display the impact of the current slider settings as: absolute change in 12-month closing cash (paise, shown in Indian_Number_Format), change in cash runway (months, one decimal place), and change in net income (paise, shown in Indian_Number_Format) — all relative to the baseline (sliders at zero/default).

4. THE CashFlowIQ system SHALL apply Revenue Growth % as a multiplicative adjustment to all Revenue account forecasts: `adjustedRevenue[n] = baseRevenue[n] * (1 + growthPct/100)`, rounding to the nearest integer paise.

5. THE CashFlowIQ system SHALL apply Expense Growth % as a multiplicative adjustment to all COGS and Operating Expense account forecasts: `adjustedExpense[n] = baseExpense[n] * (1 + growthPct/100)`, rounding to the nearest integer paise.

6. THE CashFlowIQ system SHALL apply Collection Days as an override to the AR timing profile, recomputing cash inflows using the formula: `cashInflow[n] = revenue[n] * (30 / collectionDays)` clamped to `[0, revenue[n]]`, in integer paise.

7. WHEN all sliders are at their default/zero positions, THE Sensitivity Analysis panel SHALL display values identical to the baseline Forecast_Engine output — no drift from repeated slider resets (idempotence property).

8. THE Sensitivity Analysis panel SHALL display a "Reset to Baseline" button that returns all sliders to their default positions and restores the baseline engine output.

9. THE Sensitivity Analysis panel SHALL NOT persist slider positions to the database — sensitivity analysis is a read-only what-if tool and must not modify `value_rules`, `timing_profiles`, or any other persisted forecast configuration.

10. WHERE the device screen width is less than 768px, THE Sensitivity Analysis panel SHALL render as a bottom sheet drawer rather than a side panel, to accommodate Indian mobile users on smaller screens.

11. FOR ALL slider positions (r, e, c, p), the Sensitivity Analysis output SHALL satisfy: IF r=0 AND e=0 AND c=default AND p=default, THEN output === baseline engine output (identity property). IF r > 0, THEN closing cash SHALL be >= baseline closing cash, all else equal (monotonicity property for revenue growth).

---

### Requirement 7: Multi-Company Dashboard (CA Firm View)

**User Story:** As a CA managing multiple client companies, I want a portfolio dashboard showing all my companies with key metrics (cash runway, net income, compliance status) in a card grid, so that I can monitor all clients at a glance and quickly identify which ones need attention.

#### Acceptance Criteria

1. THE CashFlowIQ system SHALL render a CA Firm View at `/firm` that is accessible to any authenticated user who is an `owner` or `editor` member of two or more companies.

2. THE CA Firm View SHALL display one card per company showing: company name, industry, cash runway (months), current month net income (paise in Indian_Number_Format), compliance health indicator (green/amber/red based on overdue obligations), and a "Open" link to that company's dashboard.

3. THE CA Firm View SHALL derive cash runway and net income from the cached `forecast_results` table for each company, falling back to zero if no cached result exists — without running the Forecast_Engine for all companies on page load.

4. WHEN a company has one or more overdue compliance obligations (GST, TDS, PF/ESI), THE CA Firm View SHALL display a red compliance badge on that company's card; WHEN all obligations are current, a green badge; WHEN any obligation is due within 7 days, an amber badge.

5. THE CA Firm View SHALL support sorting the company card grid by: company name (alphabetical), cash runway (ascending — most at-risk first), net income (descending), and compliance status (red first).

6. THE CA Firm View SHALL support filtering the company card grid by: industry, compliance status (all / at-risk / healthy), and a text search on company name.

7. WHEN the CA Firm View loads, THE CashFlowIQ system SHALL fetch all company summaries in a single API call to `GET /api/firm/companies` rather than N individual company API calls, to minimise latency on Indian mobile networks.

8. THE CA Firm View SHALL display a summary row at the top showing: total companies, total companies with cash runway < 3 months (at-risk count), and total overdue compliance obligations across all companies.

9. IF a user is a member of only one company, THEN THE CashFlowIQ system SHALL redirect `/firm` to that company's dashboard rather than showing a single-card firm view.

10. THE CA Firm View SHALL refresh company metrics automatically every 5 minutes while the page is open, using polling (not WebSockets), to reflect newly cached forecast results.

11. FOR ALL companies in the firm view, the displayed cash runway SHALL be derived from the same formula used on the individual company dashboard: `runway = closingCash / avgMonthlyBurn`, capped at 36 months — ensuring consistency between views (model-based consistency property).

---

### Requirement 8: Bank Reconciliation Status

**User Story:** As an SME owner or CA, I want to see which months have been reconciled (actuals match bank statement) vs unreconciled, so that I know which months are reliable for forecasting and which are still being updated.

#### Acceptance Criteria

1. THE Reconciliation_Engine SHALL maintain a `bank_reconciliations` table with columns: `id`, `company_id`, `period` (YYYY-MM-01), `status` (`unreconciled` | `in_progress` | `reconciled`), `reconciled_by` (clerkUserId), `reconciled_at` (text, nullable), `bank_closing_balance_paise` (integer, nullable), `book_closing_balance_paise` (integer, nullable), `variance_paise` (integer, computed as `bank - book`, nullable), `notes` (text, nullable), `created_at`.

2. THE Reconciliation_Engine SHALL auto-create an `unreconciled` row for each Period when actuals are imported for that Period, using the closing cash from `rawIntegrationResults[n].bs.cash` as `book_closing_balance_paise`.

3. WHEN the user marks a month as reconciled via `PATCH /api/reconciliations/:id`, THE Reconciliation_Engine SHALL update `status` to `reconciled`, set `reconciled_by` and `reconciled_at`, and store the `bank_closing_balance_paise` provided by the user — verifying `clerkUserId` ownership before writing.

4. THE Reconciliation_Engine SHALL compute `variance_paise = bank_closing_balance_paise - book_closing_balance_paise` and store it as an integer; WHEN `variance_paise !== 0` and `status = reconciled`, THE Reconciliation_Engine SHALL flag the record with a `has_variance` boolean.

5. THE CashFlowIQ system SHALL render a reconciliation status grid on the `/data` page (or a dedicated `/reconciliation` sub-page) showing: month, book closing balance (paise in Indian_Number_Format), bank closing balance (paise, editable), variance (paise, colour-coded), status badge, and a "Mark Reconciled" action.

6. THE CashFlowIQ system SHALL display status badges: green "Reconciled" for reconciled months, amber "In Progress" for in-progress months, grey "Unreconciled" for unreconciled months.

7. WHEN a month is reconciled with zero variance, THE CashFlowIQ system SHALL display a green checkmark and the message "Balanced" next to the month in the ForecastGrid column header.

8. WHEN a month is reconciled with non-zero variance, THE CashFlowIQ system SHALL display an amber warning icon and the variance amount in Indian_Number_Format in the ForecastGrid column header.

9. THE Reconciliation_Engine SHALL prevent marking a month as reconciled if `bank_closing_balance_paise` has not been provided — returning HTTP 422 with the message "Bank closing balance is required to reconcile."

10. FOR ALL reconciled records, `variance_paise = bank_closing_balance_paise - book_closing_balance_paise` SHALL hold as a stored invariant; IF this identity is violated in any read, THE Reconciliation_Engine SHALL recompute and correct the stored value.

11. THE CashFlowIQ system SHALL display a reconciliation health summary showing: total months with actuals, reconciled count, unreconciled count, and total variance across all reconciled months (sum of absolute `variance_paise` values).

---

## Cross-Cutting Requirements

### Requirement 9: Indian Number Format Consistency

**User Story:** As an Indian SME user, I want all monetary values across all new features to display in Indian number format (lakhs/crores), so that the numbers are immediately readable without mental conversion.

#### Acceptance Criteria

1. THE CashFlowIQ system SHALL use the existing `formatAuto` utility from `src/lib/utils/indian-format.ts` for all monetary display in the Waterfall Chart, Scenario Comparison View, PDF Report, GST Tracker, Sensitivity Analysis, CA Firm View, and Reconciliation Status features.

2. WHEN a value is >= 1,00,00,000 paise (₹1 crore), THE CashFlowIQ system SHALL display it as `₹X.XCr`; WHEN >= 1,00,000 paise (₹1 lakh), as `₹X.XL`; WHEN >= 1,000 paise (₹1 thousand), as `₹X.XK`; otherwise as `₹X`.

3. THE CashFlowIQ system SHALL never display raw paise values to the user — all user-facing monetary display SHALL be in Indian_Number_Format.

### Requirement 10: Paise Arithmetic Integrity

**User Story:** As a developer maintaining CashFlowIQ, I want all new features to preserve the integer paise constraint, so that floating-point rounding errors never corrupt financial data.

#### Acceptance Criteria

1. THE CashFlowIQ system SHALL store all monetary values in all new database tables as `integer` columns (not `real` or `float`), representing paise.

2. WHEN any new feature performs arithmetic on monetary values, THE CashFlowIQ system SHALL use `Math.round()` to convert back to integer paise after any division or multiplication, never storing intermediate floating-point results.

3. FOR ALL monetary computations in new features, the following invariant SHALL hold: `typeof value === 'number' && Number.isInteger(value) && value >= 0` for all stored amounts (negative values are represented as positive integers with a sign convention in the column name or a separate sign field).

### Requirement 11: Auth and Ownership Verification

**User Story:** As a security-conscious developer, I want every new API route to verify clerkUserId ownership before reading or writing data, so that no user can access another company's data.

#### Acceptance Criteria

1. EVERY new API route introduced by these features SHALL verify that the authenticated `clerkUserId` (from Clerk) is either the `companies.clerkUserId` owner or a member in `company_members` with role `owner` or `editor` before performing any DB write.

2. EVERY new API route that reads sensitive data SHALL verify that the authenticated `clerkUserId` has at least `viewer` access to the requested `companyId` before returning data.

3. IF ownership verification fails, THEN THE CashFlowIQ system SHALL return HTTP 403 with body `{ error: "Forbidden" }` and SHALL NOT return any company data in the response.
