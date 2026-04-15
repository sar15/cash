# CashFlowIQ — Product Requirements

## What It Is

Event-driven, three-way integrated financial forecasting for Indian SMEs, startups, and Chartered Accountants. Transforms historical P&L + Balance Sheet into actionable 12-month cash flow projections with GST/TDS-aware compliance timing.

**Not** an accounting tool, bank aggregator, ERP, or tax filing tool.

---

## Users

**CA Rajesh (primary — distribution channel)**  
Manages 85 SME clients. Spends 3–4 hours per client building Excel projections. Needs: upload client Tally data → baseline in 2 minutes → add events → 3 scenarios → branded PDF. Goal: ₹3–5K/month retainer per client.

**Amit (SME owner)**  
Checks bank balance daily. Got a shock when he couldn't pay ₹8L GST because receivables were delayed. Needs: red/yellow/green dashboard, "GST ₹12L due in 5 days, cash ₹14.5L — SAFE", simple what-if scenarios.

**Priya (startup founder)**  
₹45L ARR, 22 people, ₹3Cr seed. Investor asked for 3-year 3-statement model. Her Excel doesn't balance. Needs: three-way integrated forecast that ties, hiring scenario planner, investor-ready PDF.

---

## Features

### Core Forecast
- Upload Excel/CSV → auto-map to Indian Chart of Accounts → 12-month baseline
- Three-way integrated P&L + Balance Sheet + Cash Flow (indirect method)
- 5 views: P&L, Balance Sheet, Cash Flow, Drivers (8 KPIs), Variance (actual vs forecast)
- Cell editing with direct-entry override
- Keyboard shortcuts: P/B/C/D/V/S/N

### Business Events (Micro-Forecasts)
Model events that layer on the baseline:
- **New Hire** — salary + employer PF/ESI + TDS timing
- **Asset Purchase** — capex + depreciation schedule
- **New Loan** — principal drawdown + interest + repayment
- **New Revenue** — new client/stream with GST and collection timing
- **Expense** — one-time or recurring
- **Price Change** — % change on existing revenue

### Scenarios
Named sets of overrides (Base/Best/Worst). Compare up to 3 side-by-side with delta columns. Each scenario runs the full engine independently.

### Sensitivity Analysis
Sliders for revenue growth %, expense growth %, collection days, payment days. Re-runs engine in real-time. Shows impact on closing cash, net income, runway. Read-only — never persists to DB.

### Rolling Forecast Lock
Lock a month as "actual" → forecast window advances. Lock icon in grid header. Locked months show grey background.

### India Compliance
Auto-derived from forecast:
- **GST** — output tax on revenue, ITC on expenses, net payable. GSTR-1 (due 11th) + GSTR-3B (due 20th) filing tracker with mark-as-filed.
- **TDS** — salary (192), contractor (194C), professional (194J). Due 7th.
- **PF/ESI** — employer PF 12%, employee PF 12%, ESI 3.25%/0.75%. Due 15th.
- **Advance Tax** — quarterly installments (15% Jun, 45% Sep, 75% Dec, 100% Mar).

### PDF Reports
Generate P&L + Balance Sheet + Cash Flow + GST compliance summary as PDF. Fetches from cached forecast result. Downloads via R2 (or local fallback in dev).

### CA Firm View (`/firm`)
Portfolio dashboard for CAs managing multiple companies. Shows cash runway, net income, compliance health (good/warning/critical) per company. Data from cached `forecast_results` — no engine re-run on load.

### Bank Reconciliation
Match book closing balance vs bank statement per month. Track variance. Status: unreconciled / reconciled / variance.

---

## Indian-Specific Requirements

- All monetary values in **integer paise** throughout (₹1 = 100 paise)
- Display in Indian number format: ₹1.2Cr, ₹45.6L, ₹12.3K
- Financial year starts April (configurable)
- Period keys always `YYYY-MM-01`
- GST/TDS/PF/ESI compliance built-in, not an add-on
- Mobile-first for Indian users (360px baseline)

---

## Non-Functional

- Forecast engine runs client-side (pure function, no DB calls)
- Engine result cached to DB (debounced 800ms) — next load is instant
- GST filings auto-populated when forecast saves
- Firm view reads from cache — no N+1 engine runs
- All API routes verify `clerkUserId` ownership before any DB write
- Rate limiting: 100 req/min general, 10/hr import, 3/hr seed
- PDF generation uses jsPDF (server-side, no DOM dependency)
