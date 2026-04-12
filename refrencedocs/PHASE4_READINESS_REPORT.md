# CashFlowIQ Phase 4 Readiness Report

Generated: 2026-04-08

## 1. Codebase Readiness

### Finished in this pass

- Micro-forecast persistence is now wired end to end:
  - UI wizards save through the API instead of only writing local Zustand state.
  - Forecast sidebar reloads persisted events and shows loading/error states.
  - A default company context is auto-created for the signed-in user so Phase 3 can work without a full onboarding flow.
- TypeScript is now clean for the current repo:
  - `node node_modules/typescript/bin/tsc --noEmit` passes.
- Engine tests are green:
  - `npm test` passes with 23/23 tests.

### Practical Phase 3 status after this pass

- Phase 3 is much closer to complete and no longer has the biggest implementation gap.
- The project is ready to begin Phase 4 work without the micro-forecast stack blocking us.

### Still worth tightening before calling Phases 0-3 "perfect"

- PWA icons referenced in `public/manifest.json` are still missing.
- Import validation logic exists, but the current import page does not yet enforce validator results before mutating demo data.
- Account mapping is still a small hardcoded subset, not a serious India-facing chart-of-accounts library yet.

These are important polish/completeness gaps, but they are not blockers for starting Phase 4 compliance/scenario work.

## 2. Syft Analysis

### What Syft appears strong at

Based on the local screenshots in `/syft`, Syft is strongest in these areas:

- Dashboard variety:
  - Multiple dashboard contexts such as cash, P&L, and themed dashboards.
  - Flexible card layouts with save/share actions.
- Cash operations workflow:
  - Cash manager overview with near-term cash windows, runway/buffer signals, and forecasted inflows/outflows.
  - Separate `Cash In` and `Cash Out` operational tables with due buckets and include/exclude toggles.
- Operational drilldowns:
  - Customer activity, sales metrics, receivables, supplier and product-level views.
  - "Top customers by balance outstanding" style collections intelligence.
- Reporting distribution:
  - Template report packs, schedules, live views, and download actions.
- Executive oversight:
  - A compact scorecard/grid view with health score and key KPIs for entities.

### Best ideas to borrow from Syft

#### 1. Cash manager as a dedicated operating surface

Most useful screenshots:

- `syft/Screenshot 2026-04-08 at 11.35.25 AM.png`
- `syft/Screenshot 2026-04-08 at 11.35.34 AM.png`
- `syft/Screenshot 2026-04-08 at 11.35.42 AM.png`

What to borrow:

- A dedicated `Cash Manager` area, not just a generic forecast grid.
- Near-term windows like:
  - Today
  - Next 1-7 days
  - Next 8-30 days
  - Current balance
- A right-side operational summary:
  - runway
  - cash buffer
  - account balances
  - next-30-day inflow/outflow totals
- Operational tables for invoices and bills with:
  - due-date buckets
  - include/exclude toggles
  - overdue emphasis

How CashFlowIQ should adapt it:

- Replace generic "cash in / cash out" with Indian SME wording:
  - receipts due
  - payments due
  - GST due
  - payroll due
  - vendor payments due
- Add compliance due dates directly into this surface.

#### 2. KPI + account drilldown library

Most useful screenshots:

- `syft/Screenshot 2026-04-08 at 11.33.30 AM.png`
- `syft/Screenshot 2026-04-08 at 11.33.36 AM.png`
- `syft/Screenshot 2026-04-08 at 11.34.30 AM.png`
- `syft/Screenshot 2026-04-08 at 11.34.32 AM.png`

What to borrow:

- Dedicated analysis pages for:
  - profit & loss trends
  - income vs expenses
  - receivables concentration
  - customer growth/activity
- Strong drilldown framing:
  - headline metric
  - chart
  - right-side legend or breakdown
  - explanatory insights text

How CashFlowIQ should adapt it:

- Keep the same analytical structure, but focus on:
  - DSO / DPO
  - working capital gap
  - GST cash burden
  - customer concentration risk
  - salary + compliance outflow calendar

#### 3. Reusable report templates and schedules

Most useful screenshot:

- `syft/Screenshot 2026-04-08 at 11.29.09 AM.png`

What to borrow:

- Template-first reporting
- tags/frequency/ownership metadata
- downloadable packs
- live views

How CashFlowIQ should adapt it:

- Offer opinionated templates:
  - lender pack
  - founder monthly review
  - CA advisory pack
  - cash survival pack
- Later add schedule-based emailing/export.

### What not to copy from Syft

- Too many left-nav destinations too early.
- A generic multi-domain analytics tree before the core forecast workflow is rock solid.
- Decorative dashboard cards with weak financial signal.
- Overly broad entity management for MVP.

For CashFlowIQ, the product should stay centered on:

- import actuals
- build integrated forecast
- add business events
- watch cash + compliance impact

## 3. Jirav Research

### Current product strengths from official sources

Official sources used:

- [Jirav homepage](https://www.jirav.com/)
- [Planning, Budgeting & Forecasting](https://www.jirav.com/business-planning-budgeting-forecasting)
- [Financial Reporting & Dashboards](https://www.jirav.com/business-reporting-and-dashboards)
- [Scenario Planning](https://www.jirav.com/scenario-planning)
- [Workforce Planning](https://www.jirav.com/workforce-planning)
- [Plan Drivers help](https://help.jirav.com/plans/drivers)
- [Drivers, Assumptions & Subitems](https://help.jirav.com/intro-to-opex)
- [Workforce Planning Guide](https://help.jirav.com/workforce-planning-guide)
- [Integrations help](https://help.jirav.com/integrations)
- [Share your Dashboard](https://help.jirav.com/share-dashboard)

Key capabilities Jirav emphasizes:

- Driver-based 3-statement modeling:
  - P&L, balance sheet, and cash flow update together.
- Scenario planning:
  - best case / worst case / strategic decision modeling.
- Assumptions + drivers + subitems:
  - reusable variables and additive planning logic.
- Workforce planning:
  - planned hires, raises, terminations, fully burdened headcount.
- Rolling forecasts:
  - forward-looking plans updated with actuals.
- Strong reporting/distribution:
  - dashboards, templates, variance reporting, commentary/footnotes, sharing.
- Broad integrations:
  - QuickBooks, Xero, NetSuite, Sage Intacct, workforce systems, spreadsheets.

### Best ideas to borrow from Jirav

#### 1. A real assumptions layer

CashFlowIQ should add an explicit assumptions layer in Phase 4-5:

- inflation
- revenue growth
- collection days
- payment terms
- GST rates/config
- hiring cost assumptions
- salary escalation

This should become the control center for scenarios.

#### 2. Driver library beyond direct edits

Jirav’s driver model suggests CashFlowIQ should eventually support:

- `% of another account`
- `$ per employee`
- `units x price`
- annual targets
- allocations
- capex / prepaid / balance-sheet drivers

This is more powerful than a pure editable grid.

#### 3. Commentary and stakeholder outputs

Jirav clearly treats reporting as communication, not just calculation.

CashFlowIQ should add:

- inline commentary on key metrics
- variance explanations
- lender/founder/CA-ready views
- shareable or exportable review packs

#### 4. Workforce planning depth

Jirav’s workforce model is deeper than our current hire wizard.

CashFlowIQ should eventually support:

- role-based hiring plans
- salary raise schedules
- termination dates
- burdens:
  - PF
  - ESI
  - payroll taxes
  - equipment / onboarding costs

### What not to copy from Jirav

- Integration-first positioning before import-led MVP is dominant.
- A very broad driver system too early, if it slows the core workflow.
- Heavy enterprise navigation and model-administration surface for small Indian SMEs.

CashFlowIQ should keep Jirav’s depth, but present it with much simpler UX.

## 4. Recommended Additions for CashFlowIQ

### Highest-value features to add next

#### Phase 4 priority

1. Scenario engine
   - baseline vs optimistic vs stress
   - micro-forecast toggles by scenario
   - side-by-side variance

2. Compliance-aware cash manager
   - GST/TDS/PF-ESI/advance tax due dates
   - near-term cash windows
   - red/yellow/green alerting

3. Oversight scorecard
   - cash runway
   - min cash
   - GST due next 30 days
   - receivables risk
   - vendor pressure

#### Phase 5 priority

1. Report templates
   - founder pack
   - CA pack
   - bank/lender pack

2. Assumptions center
   - reusable business assumptions
   - one-click scenario recalculation

3. Drilldown analytics pages
   - income vs expense
   - receivables
   - payables
   - customer concentration

## 5. UI Direction

### Syft/Jirav patterns worth adapting

- clean left-nav with focused modules
- strong page-level filters at top
- scorecards above analysis
- chart + table + breakdown combinations
- share/export actions in the page chrome
- dedicated cash workspace, not only financial statements

### CashFlowIQ-specific UI guidance

- Keep the emotional center on cash confidence, not generic BI.
- Use Indian compliance moments as first-class visual elements.
- Make every page answer:
  - what is happening?
  - what is due soon?
  - what changed?
  - what decision should the user take?

## 6. Summary

If we keep the core of CashFlowIQ as:

- integrated forecast math
- event-driven planning
- compliance-aware cash visibility

and then borrow from Syft/Jirav:

- cash manager
- drilldown scorecards
- assumptions + scenario layer
- report templates

we can build something that feels more focused than Syft and more SME-friendly than Jirav while still looking like a serious FP&A product.
