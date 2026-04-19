# Requirements Document

## Introduction

This feature adds two major capabilities to CashFlowIQ:

1. **Schedule III Annual Statements** — a full statutory-compliant annual view of P&L, Balance Sheet, and Cash Flow across the entire app (Forecast page, Reports page, and PDF export), alongside the existing monthly operational forecasting. This is the "compliance/auditor half" of the product.

2. **Notes / MD&A (Management Discussion & Analysis)** — a commentary system where CAs and editors can add plain-English explanations below each financial statement, bridging the gap between raw numbers and client understanding.

The engine (`three-way/builder.ts`) is already fully Schedule III compliant. The existing `ForecastGrid.tsx` already renders Schedule III P&L, Balance Sheet, and AS 3 Cash Flow in monthly columns. This feature surfaces that data in an annual two-column format, fixes field-name inconsistencies on the Dashboard, rewrites the PDF generator to use Schedule III fields, and adds the Notes/MD&A persistence layer.

---

## Glossary

- **Schedule III**: The format prescribed under the Companies Act 2013 (Division I) for presentation of financial statements by Indian companies. Mandates specific line items and ordering for P&L, Balance Sheet, and Cash Flow.
- **AS 3**: Accounting Standard 3 — Cash Flow Statements (Indirect Method) as issued by ICAI.
- **AnnualStatement**: An aggregated view of a full financial year derived from 12 monthly `ThreeWayMonth` results — P&L and CF are summed; Balance Sheet is the closing month's point-in-time balances.
- **FY (Financial Year)**: April 1 to March 31 (configurable via `fyStartMonth` on the `companies` table).
- **Current Year**: The 12-month forecast period being modelled.
- **Prior Year**: The 12 months immediately preceding the Current Year.
- **Hybrid Prior Year**: A prior-year column assembled from `monthlyActuals` where available, falling back to the forecast engine for months without actuals.
- **PAT**: Profit After Tax — Schedule III Line X (`profitAfterTax`).
- **PBT**: Profit Before Tax — Schedule III Line VIII (`profitBeforeTax`).
- **Revenue from Operations**: Schedule III Line I (`revenueFromOps`) — revenue from core business activities.
- **Other Income**: Schedule III Line II (`otherIncome`) — interest received, dividends, miscellaneous.
- **Total Revenue**: Schedule III Line III (`totalRevenue`) = Revenue from Operations + Other Income.
- **EBITDA**: Earnings Before Interest, Tax, Depreciation, and Amortisation — a management metric derived from Schedule III fields.
- **MD&A**: Management Discussion & Analysis — narrative commentary explaining financial results.
- **Auto-Summary**: A rule-based (non-LLM) bullet-point summary generated on demand from `EngineResult` data.
- **Stale Warning**: A UI indicator shown when forecast numbers have changed since the last auto-summary was generated.
- **periodKey**: A string identifier for a financial year period, e.g. `"FY25-26"`, used as a soft reference in `scenario_notes`.
- **Editor**: A `companyMembers` row with `role = 'editor'` or `role = 'owner'`.
- **Viewer**: A `companyMembers` row with `role = 'viewer'`.
- **AnnualStatementView**: A reusable React component that renders the two-column Schedule III annual layout (Current Year | Prior Year).
- **ForecastGrid**: The existing `src/components/forecast/ForecastGrid.tsx` component.
- **ViewSwitcher**: The existing `src/components/forecast/ViewSwitcher.tsx` tab bar.
- **ThreeWayMonth**: The per-month output type from `src/lib/engine/three-way/builder.ts`.
- **EngineResult**: The full output of `runForecastEngine`, containing `rawIntegrationResults: ThreeWayMonth[]`.
- **monthlyActuals**: The `monthly_actuals` database table storing historical account-level amounts in paise.
- **scenario_notes**: The new database table storing MD&A notes per statement, period, and scenario.

---

## Requirements

### Requirement 1: Annual Aggregation Function

**User Story:** As a CA or business owner, I want to view a full-year summary of P&L, Balance Sheet, and Cash Flow, so that I can present statutory-compliant annual financial statements to auditors and stakeholders.

#### Acceptance Criteria

1. THE `AggregationEngine` SHALL expose a pure function `aggregateAnnual(months: ThreeWayMonth[]) → AnnualStatement` that accepts exactly 12 `ThreeWayMonth` objects.
2. WHEN `aggregateAnnual` is called, THE `AggregationEngine` SHALL compute P&L annual figures by summing all 12 months for every flow field (`revenueFromOps`, `otherIncome`, `totalRevenue`, `employeeBenefits`, `financeCosts`, `depreciation`, `amortisation`, `otherExpenses`, `totalExpenses`, `profitBeforeExceptional`, `exceptionalItems`, `profitBeforeTax`, `taxExpense`, `profitAfterTax`).
3. WHEN `aggregateAnnual` is called, THE `AggregationEngine` SHALL compute Balance Sheet annual figures by taking the closing values from the 12th (last) month for every stock field (`cash`, `tradeReceivables`, `netPPE`, `netIntangibles`, `inventories`, `stLoansAdvances`, `otherCurrentAssets`, `totalCurrentAssets`, `totalNonCurrentAssets`, `totalAssets`, `shareCapital`, `securitiesPremium`, `generalReserve`, `retainedEarnings`, `totalShareholdersEquity`, `ltBorrowings`, `stBorrowings`, `otherCurrentLiabilities`, `stProvisions`, `totalNonCurrentLiabilities`, `totalCurrentLiabilities`, `totalEquity`, `totalLiabilities`).
4. WHEN `aggregateAnnual` is called, THE `AggregationEngine` SHALL compute Cash Flow annual figures by summing all 12 months for every flow field (`netOperatingCF`, `netInvestingCF`, `netFinancingCF`, `netCashFlow`, and all `operatingIndirect` sub-fields).
5. WHEN `aggregateAnnual` is called with fewer than 12 months, THE `AggregationEngine` SHALL aggregate the available months without error and SHALL include the actual month count in the returned `AnnualStatement` metadata.
6. FOR ALL valid arrays of 12 `ThreeWayMonth` objects, `aggregateAnnual(months).pl.totalRevenue` SHALL equal the sum of `month.pl.totalRevenue` for each month in the array (round-trip summation property).
7. FOR ALL valid arrays of 12 `ThreeWayMonth` objects, `aggregateAnnual(months).bs.cash` SHALL equal `months[11].bs.cash` (last-month point-in-time property).

---

### Requirement 2: Prior Year Column — Hybrid Fetch Strategy

**User Story:** As a CA, I want the annual statements to show a prior-year comparison column, so that I can present year-over-year analysis to clients and auditors.

#### Acceptance Criteria

1. WHEN the Prior Year column is requested, THE `PriorYearResolver` SHALL query the `monthlyActuals` table for the 12 months immediately preceding the current forecast start date.
2. WHEN 12 months of actuals exist for the prior year, THE `PriorYearResolver` SHALL use those actuals exclusively to build the prior-year `ThreeWayMonth` array.
3. WHEN fewer than 12 months of actuals exist for the prior year, THE `PriorYearResolver` SHALL combine available actuals months with forecast-engine months for the remaining periods to produce a complete 12-month array.
4. WHEN no actuals exist for the prior year, THE `PriorYearResolver` SHALL fall back to the forecast engine for all 12 prior-year months.
5. WHEN the prior-year column is assembled from a mix of actuals and forecast months, THE `AnnualStatementView` SHALL display a badge on the prior-year column header indicating the data composition (e.g. "FY 24-25 (Actuals + Forecast)").
6. WHEN the prior-year column is assembled from actuals only, THE `AnnualStatementView` SHALL display a badge indicating "FY 24-25 (Actuals)".
7. WHEN the prior-year column is assembled from forecast only, THE `AnnualStatementView` SHALL display a badge indicating "FY 24-25 (Forecast)".
8. IF the `monthlyActuals` query fails, THEN THE `PriorYearResolver` SHALL fall back to the forecast engine and SHALL log the error without surfacing it to the user as a blocking error.

---

### Requirement 3: Forecast Page — Annual Tab

**User Story:** As a CA or business owner, I want an "Annual" tab on the Forecast page, so that I can view the full-year Schedule III statements without leaving the forecasting workflow.

#### Acceptance Criteria

1. THE `ViewSwitcher` SHALL include an `'annual'` tab with label "Annual" and description "Full-year Schedule III statements".
2. WHEN the Annual tab is active, THE `ForecastClient` SHALL render the `AnnualStatementView` component in place of the `ForecastGrid`.
3. THE `AnnualStatementView` SHALL display three sections in sequence: P&L Statement, Balance Sheet, and Cash Flow Statement.
4. WHEN rendering the P&L section, THE `AnnualStatementView` SHALL use Roman numeral line items matching the Schedule III format rendered by `buildPLRows` in `ForecastGrid.tsx` (I. Revenue from Operations, II. Other Income, III. Total Revenue, IV. Expenses with sub-items (a)–(g), V. Total Expenses, VI. Profit Before Exceptional Items & Tax, VII. Exceptional Items (if non-zero), VIII. Profit Before Tax, IX. Tax Expense (if non-zero), X. Profit After Tax).
5. WHEN rendering the Cash Flow section, THE `AnnualStatementView` SHALL use lettered sections matching AS 3 format (A. Operating Activities, B. Investing Activities, C. Financing Activities) with the same indirect-method line items as `buildCFRows` in `ForecastGrid.tsx`.
6. THE `AnnualStatementView` SHALL display two columns: Current Year (labelled with the FY period, e.g. "FY 25-26") and Prior Year (labelled with the prior FY period, e.g. "FY 24-25") with the appropriate data-source badge from Requirement 2.
7. WHEN a user presses the keyboard shortcut `'a'` or `'A'` on the Forecast page, THE `ForecastClient` SHALL switch the active view to `'annual'`.
8. THE `AnnualStatementView` SHALL display amounts in the company's configured number format (lakhs/crores) using the existing `formatAuto` utility.

---

### Requirement 4: Dashboard — Schedule III Field Name Correction

**User Story:** As a business owner viewing the Dashboard, I want the financial metrics to use correct Schedule III terminology, so that the numbers are consistent with the statutory statements.

#### Acceptance Criteria

1. THE `DashboardPage` SHALL compute `netIncome` using `m?.pl?.profitAfterTax ?? m?.pl?.netIncome ?? 0` instead of `m?.pl?.netIncome ?? 0` for all monthly aggregations.
2. THE `DashboardPage` SHALL compute `totalRevenue` using `m?.pl?.revenueFromOps ?? m?.pl?.revenue ?? 0` instead of `m?.pl?.revenue ?? 0` for all monthly aggregations.
3. THE `QuickMetricsGrid` SHALL label the net income metric as "PAT" (Profit After Tax) in its display.
4. THE monthly forecast table on the Dashboard SHALL display the column header "PAT" instead of "Net Income".
5. THE monthly forecast table on the Dashboard SHALL compute each row's net value using `m?.pl?.profitAfterTax ?? m?.pl?.netIncome ?? 0`.
6. WHEN `profitAfterTax` is not available on a month (e.g. older cached results), THE `DashboardPage` SHALL fall back to `netIncome` without error.

---

### Requirement 5: Reports Page — On-Screen Annual Statements

**User Story:** As a CA, I want to view the annual statements on-screen in the Reports page, so that I can review them before exporting to PDF.

#### Acceptance Criteria

1. THE `ReportsPage` SHALL include an "Annual Statements" tab alongside the existing PDF export functionality.
2. WHEN the "Annual Statements" tab is active, THE `ReportsPage` SHALL render the `AnnualStatementView` component with the same data as the Forecast page Annual tab.
3. THE `AnnualStatementView` on the Reports page SHALL include the Notes/MD&A panel below each statement section (as defined in Requirement 7).
4. THE `ReportsPage` SHALL provide an "Export to PDF" button within the Annual Statements tab that triggers PDF generation using the Schedule III PDF generator (Requirement 6).
5. WHEN the "Export to PDF" button is clicked, THE `ReportsPage` SHALL pass the current notes content to the PDF generator.

---

### Requirement 6: PDF Generator — Schedule III Rewrite

**User Story:** As a CA, I want the exported PDF to use correct Schedule III field names and include MD&A notes, so that the PDF is suitable for statutory filing and client presentation.

#### Acceptance Criteria

1. THE `PDFGenerator` SHALL replace all references to `m?.pl?.netIncome` with `m?.pl?.profitAfterTax ?? m?.pl?.netIncome` in the P&L section.
2. THE `PDFGenerator` SHALL replace all references to `m?.pl?.revenue` with `m?.pl?.revenueFromOps ?? m?.pl?.revenue` in the P&L section.
3. THE `PDFGenerator` SHALL render the P&L section using Schedule III Roman numeral line items (I through X) matching the format in `buildPLRows`.
4. THE `PDFGenerator` SHALL render the Balance Sheet section using the full Schedule III structure (Equity & Liabilities first, then Assets) matching `buildBSRows`.
5. THE `PDFGenerator` SHALL render the Cash Flow section using AS 3 indirect method with lettered sections (A, B, C) matching `buildCFRows`.
6. THE `PDFGenerator` SHALL render the cover page key metrics using `profitAfterTax` (labelled "PAT") and `revenueFromOps` (labelled "Revenue from Operations") instead of `netIncome` and `revenue`.
7. WHEN notes are provided for a statement section, THE `PDFGenerator` SHALL render a "Financial Commentary" box with a gray tint after that statement section.
8. WHEN notes are not provided for a statement section, THE `PDFGenerator` SHALL omit the "Financial Commentary" box for that section.
9. WHEN rendering a "Financial Commentary" box, THE `PDFGenerator` SHALL check the remaining vertical space on the current page before rendering; IF the remaining space is less than the estimated box height, THEN THE `PDFGenerator` SHALL start a new page before rendering the box.
10. THE `PDFGenerator` SHALL accept an optional `notes` parameter of type `{ pl?: string; bs?: string; cf?: string }` in `ReportParams`.

---

### Requirement 7: Notes / MD&A — Data Model

**User Story:** As a CA, I want to persist commentary notes for each financial statement and period, so that the notes are saved and available for future sessions and PDF exports.

#### Acceptance Criteria

1. THE `Database` SHALL contain a `scenario_notes` table with columns: `id` (UUID primary key), `companyId` (FK → `companies.id`, cascade delete), `scenarioId` (nullable FK → `scenarios.id`, cascade set null — null means base case), `statementType` (text, one of `'PL'`, `'BS'`, `'CF'`), `periodKey` (text, e.g. `"FY25-26"` — soft reference, no FK), `autoSummary` (text, JSON array of bullet strings), `autoSummaryGeneratedAt` (text, ISO timestamp), `userNotes` (text, free-form markdown), `updatedAt` (text, ISO timestamp), `updatedBy` (text, Clerk user ID — audit trail).
2. THE `Database` SHALL enforce a unique constraint on `(companyId, scenarioId, statementType, periodKey)` in the `scenario_notes` table.
3. THE `Database` SHALL index `scenario_notes` on `(companyId, periodKey)` for efficient period-based queries.
4. WHEN a `scenario_notes` row is created or updated, THE `Database` SHALL set `updatedAt` to the current UTC timestamp.
5. THE `scenario_notes` table SHALL be included in the Drizzle ORM schema with full relations to `companies` and `scenarios`.

---

### Requirement 8: Notes / MD&A — Auto-Summary Generation

**User Story:** As a CA, I want to generate a rule-based bullet-point summary of the financial statements on demand, so that I have a starting point for client commentary without manual calculation.

#### Acceptance Criteria

1. THE `AutoSummaryEngine` SHALL generate summaries strictly on demand — only when the user explicitly clicks a "Generate Summary" button; THE `AutoSummaryEngine` SHALL NOT run automatically on page load or on forecast changes.
2. THE `AutoSummaryEngine` SHALL generate summaries using rule-based templates applied to `EngineResult` data; THE `AutoSummaryEngine` SHALL NOT use any LLM or external AI service.
3. WHEN generating a P&L summary, THE `AutoSummaryEngine` SHALL produce bullet strings including: year-over-year revenue growth percentage (if prior year data is available), gross margin percentage, PAT margin percentage, and whether operating cash flow is positive in each month of the period.
4. WHEN generating a Balance Sheet summary, THE `AutoSummaryEngine` SHALL produce bullet strings including: closing cash position, total debt, debt-to-equity ratio, and working capital (current assets minus current liabilities).
5. WHEN generating a Cash Flow summary, THE `AutoSummaryEngine` SHALL produce bullet strings including: net operating cash flow, net investing cash flow, net financing cash flow, and the number of months with positive operating cash flow.
6. WHEN a summary is generated, THE `NotesService` SHALL persist the bullet array to `scenario_notes.autoSummary` and set `autoSummaryGeneratedAt` to the current UTC timestamp.
7. WHEN the forecast numbers change after a summary was generated (detected by comparing `forecastResults.updatedAt` with `scenario_notes.autoSummaryGeneratedAt`), THE `NotesPanel` SHALL display a stale warning: "⚠️ Forecast numbers have changed since this summary was generated."
8. WHEN the stale warning is displayed, THE `NotesPanel` SHALL show a "Regenerate" button and a warning that regenerating will overwrite manual edits.
9. IF the `AutoSummaryEngine` encounters a division-by-zero condition (e.g. zero revenue), THEN THE `AutoSummaryEngine` SHALL omit that metric from the bullet list rather than producing an error or `NaN` value.

---

### Requirement 9: Notes / MD&A — Role-Gated Editing

**User Story:** As a CA or owner, I want to edit the MD&A notes, and as a viewer I want to read them, so that commentary is controlled by appropriate access levels.

#### Acceptance Criteria

1. WHEN a user with `companyMembers.role` of `'editor'` or `'owner'` views the `NotesPanel`, THE `NotesPanel` SHALL render the user notes section as an editable textarea.
2. WHEN a user with `companyMembers.role` of `'viewer'` views the `NotesPanel`, THE `NotesPanel` SHALL render the user notes section as read-only text.
3. WHEN a user with `companyMembers.role` of `'viewer'` views the `NotesPanel`, THE `NotesPanel` SHALL hide the "Generate Summary" button.
4. WHEN an unauthenticated request is made to the notes save API endpoint, THE `NotesAPI` SHALL return HTTP 401.
5. WHEN a request is made to the notes save API endpoint by a user who is not a member of the company, THE `NotesAPI` SHALL return HTTP 403.
6. WHEN a request is made to the notes save API endpoint by a user with `role = 'viewer'`, THE `NotesAPI` SHALL return HTTP 403.

---

### Requirement 10: Notes / MD&A — UI Behaviour

**User Story:** As a CA, I want the notes panel to be unobtrusive when empty and easy to expand when needed, so that the financial statements remain the primary focus.

#### Acceptance Criteria

1. WHEN a statement section has no saved notes, THE `NotesPanel` SHALL render in a collapsed state showing only a subtle footer: "💬 Add Commentary [+]".
2. WHEN a statement section has saved notes, THE `NotesPanel` SHALL auto-expand when the user scrolls to the bottom of the statement table.
3. WHEN the user clicks the "[+]" control, THE `NotesPanel` SHALL expand to show the full notes interface.
4. WHEN expanded, THE `NotesPanel` SHALL display: left side — auto-generated key metrics as read-only chips; right side — editable textarea for user notes (role-gated per Requirement 9).
5. WHEN the user saves notes, THE `NotesPanel` SHALL optimistically update the UI and persist to the `scenario_notes` table via the API.
6. WHEN a save fails, THE `NotesPanel` SHALL display an inline error message and SHALL NOT discard the user's unsaved text.
7. WHEN the user collapses the panel, THE `NotesPanel` SHALL preserve any unsaved text in local state until the user navigates away.

---

### Requirement 11: Notes / MD&A — PDF Integration

**User Story:** As a CA, I want the PDF export to include the MD&A notes, so that the exported document is a complete management report suitable for client delivery.

#### Acceptance Criteria

1. WHEN notes exist for a statement section, THE `PDFGenerator` SHALL include a "Financial Commentary" section after that statement in the PDF (as specified in Requirement 6, criteria 7–9).
2. WHEN notes do not exist for a statement section, THE `PDFGenerator` SHALL omit the "Financial Commentary" section for that statement.
3. THE `PDFGenerator` SHALL render the auto-summary bullets as a bulleted list within the "Financial Commentary" box.
4. WHEN both auto-summary bullets and user notes exist, THE `PDFGenerator` SHALL render the auto-summary bullets first, followed by the user notes text.
5. THE `PDFGenerator` SHALL apply a gray tint (`[248, 250, 252]` fill) to the "Financial Commentary" box background to visually distinguish it from the financial data tables.

---

### Requirement 12: Annual Statements — Accessibility and Formatting

**User Story:** As a CA or business owner, I want the annual statements to be clearly formatted and accessible, so that I can read and share them with confidence.

#### Acceptance Criteria

1. THE `AnnualStatementView` SHALL use semantic HTML table elements (`<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`) for all financial data.
2. THE `AnnualStatementView` SHALL apply `scope="col"` to column header cells and `scope="row"` to row header cells.
3. THE `AnnualStatementView` SHALL visually distinguish row types: header rows (section labels), account rows (indented line items), subtotal rows (lightly highlighted), and total rows (bold, strongly highlighted) — matching the visual hierarchy in `ForecastGrid.tsx`.
4. THE `AnnualStatementView` SHALL display negative values in parentheses (e.g. `(12.3L)`) consistent with the existing `formatNum` convention in `ForecastGrid.tsx`.
5. WHEN the screen width is below 640px, THE `AnnualStatementView` SHALL allow horizontal scrolling of the table rather than truncating column content.
6. THE `AnnualStatementView` SHALL include an `aria-label` on the table element identifying the statement type (e.g. `"Schedule III Profit & Loss Statement"`).
