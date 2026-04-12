# CashFlowIQ — Complete System Design & PRD

## Version 1.0 | Confidential

---

# TABLE OF CONTENTS

```
1.  PRODUCT VISION & POSITIONING
2.  USER PERSONAS & USE CASES
3.  INFORMATION ARCHITECTURE
4.  APPLICATION FLOW (SCREEN-BY-SCREEN)
5.  FRONTEND ARCHITECTURE
6.  BACKEND ARCHITECTURE
7.  DATABASE SCHEMA DESIGN
8.  THE FORECAST ENGINE (COMPLETE LOGIC)
9.  INDIA-SPECIFIC ENGINES (GST/TDS/ADVANCE TAX/PF-ESI)
10. API DESIGN (REST CONTRACTS)
11. DATA IMPORT PIPELINE
12. REPORTING ENGINE
13. MULTI-TENANCY & SECURITY
14. DEPLOYMENT ARCHITECTURE
15. TECHNICAL STACK
16. PHASED BUILD PLAN WITH MILESTONES
17. OPEN QUESTIONS & DECISIONS LOG
```

---

# 1. PRODUCT VISION & POSITIONING

## 1.1 One-Line Description

CashFlowIQ is an event-driven, three-way integrated financial forecasting platform built for Indian SMEs, startups, and Chartered Accountants that transforms historical P&L and Balance Sheet data into actionable 12-month cash flow projections with GST/TDS-aware compliance timing.

## 1.2 What It Is

- A forecasting engine that generates integrated Projected P&L, Projected Balance Sheet, and Projected Cash Flow Statement (Indirect Method)
- An event-driven planning tool where business decisions (hires, capex, new clients, loans) are modeled as modular "micro-forecasts" layered on a baseline
- A scenario comparison tool for what-if analysis with automatic inheritance from baseline
- A compliance-aware cash flow tool that knows when GST is due (20th), TDS is due (7th), Advance Tax is due (quarterly), PF/ESI is due (15th)
- A CA practice tool that enables white-labeled advisory reports for 25-500+ clients

## 1.3 What It Is NOT

- NOT an accounting software (no journal entries, no ledger, no GST return filing)
- NOT a bank statement aggregator (no Plaid-like bank feed)
- NOT a budgeting tool for employees (no department-level budget ownership)
- NOT an ERP system (no inventory management, no order processing)
- NOT a tax filing tool (no ITR preparation, no GSTR filing)

## 1.4 Core Value Proposition

| For SME Owner | For Startup Founder | For CA |
|---|---|---|
| "Will I have enough cash to pay salary and GST next week?" | "How many months of runway do we have if we hire 2 more engineers?" | "I need to generate a projected cash flow for 15 clients before their bank loan meetings next week" |
| "What happens to my cash if my top client delays payment by 60 days?" | "What's our projected burn rate if we launch in 3 more cities?" | "Client X is expanding — I need a 12-month forecast with 3 scenarios for their board" |
| "Can I afford to buy that ₹15L machine or should I take a loan?" | "Show me the cash bridge between now and our Series A close" | "I want to white-label this as my firm's advisory service and charge ₹5,000/month per client" |

## 1.5 Competitive Moat vs Alternatives

| Alternative | Limitation | CashFlowIQ Advantage |
|---|---|---|
| Tally | No forecasting, no scenarios, no visual dashboards | Full three-way forecasting with visual output |
| Excel (CA's current method) | Error-prone, no automation, hours per client | 5-minute forecast generation from uploaded data |
| Fathom | No India compliance, no Tally, no ₹ format, no GST/TDS awareness | Built for India from day one |
| Zoho Books | Basic projections, no three-way integration, no micro-forecasts | Event-driven architecture with full three-way linkage |
| Float app | Cash-only forecast, no P&L/BS projection, no India features | Three-way integrated with Indian compliance |

---

# 2. USER PERSONAS & USE CASES

## 2.1 Persona 1: CA Rajesh Sharma (Primary — Distribution Channel)

```
DEMOGRAPHICS:
  Age: 38
  Location: Jaipur
  Firm: Sharma & Associates (3 CAs, 5 staff)
  Clients: 85 SMEs (₹50L-₹50Cr turnover), 12 startups
  Tech stack: Tally Prime for all clients, Excel for projections, WhatsApp for communication

BEHAVIOR:
  Spends 3-4 hours per client building annual projections in Excel during loan season (Oct-Feb)
  Uses a standard Excel template he built 8 years ago
  Template has hardcoded formulas — when tax rates change, he updates 40+ cells manually
  Never does monthly rolling forecasts — only annual static projections
  Charges ₹15,000-₹50,000 per projection report (one-time)
  Loses clients to bigger firms that offer "advisory services"

PAIN POINTS:
  1. Building a 3-statement projection takes 3-4 hours per client
  2. Client asks "what if we buy this machine?" — means rebuilding the entire model
  3. GST payment impact on cash flow is never shown (he doesn't model it)
  4. When interest rates change, updating loan schedules across 85 clients is a weekend task
  5. He knows 20 clients are heading toward cash crunch but has no systematic way to identify them

WHAT HE NEEDS:
  - Upload client's Tally data (or Excel) → get baseline forecast in 2 minutes
  - Add events (new client won, machine purchase, loan) → see updated projection instantly
  - Generate 3 scenarios with one click → export branded PDF
  - Dashboard showing ALL 85 clients' cash health → identify who needs attention
  - Charge ₹3,000-5,000/month per client as retainer for ongoing forecast updates

SUCCESS CRITERIA:
  - Time per client projection: from 4 hours → 15 minutes
  - Can handle 85 clients without additional staff
  - Revenue from advisory retainers: ₹2.5-4L/month (new revenue stream)
```

## 2.2 Persona 2: Amit Patel — SME Owner (Secondary — End User)

```
DEMOGRAPHICS:
  Age: 45
  Business: Patel Engineering Works Pvt Ltd (manufacturing)
  Turnover: ₹18Cr
  Employees: 65
  Location: Rajkot, Gujarat
  Tech stack: Tally Prime, WhatsApp, personal CA for compliance

BEHAVIOR:
  Looks at bank balance daily on phone
  Checks Tally once a week (asks accountant to show "kitna aaya, kitna gaya")
  Has no idea about working capital cycle
  Got a shock last Diwali when he couldn't pay ₹8L GST because receivables were delayed
  Took an emergency OD at 14% interest because he didn't plan for festive stock purchase

PAIN POINTS:
  1. "I have ₹25L in bank — can I pay everything this month?" (he doesn't know)
  2. "My biggest customer Reliance pays in 75 days — how does this affect me 3 months from now?"
  3. "GST payment of ₹12L is due on 20th — will I have enough cash?"
  4. "I want to buy a ₹20L CNC machine — should I pay cash or take a loan?"
  5. His CA shows him P&L once a quarter — he doesn't understand accrual vs cash

WHAT HE NEEDS:
  - Red/yellow/green dashboard (not financial statements)
  - Simple alerts: "GST payment ₹12L due in 5 days, projected cash ₹14.5L — SAFE"
  - Simple scenario: "What if Reliance pays 30 days late?" → shows cash impact
  - Monthly 15-minute review with CA using the tool
  - Hindi language option

SUCCESS CRITERIA:
  - No more surprise cash crunches
  - Can make capex decisions with confidence
  - Reduces emergency borrowing by 60%
```

## 2.3 Persona 3: Priya Reddy — Startup Founder (Tertiary — End User)

```
DEMOGRAPHICS:
  Age: 29
  Startup: SaaS B2B product, 18 months old
  Revenue: ₹45L ARR, growing 15% MoM
  Team: 22 people
  Funding: ₹3Cr seed raised 6 months ago
  Burn rate: ₹8.5L/month
  Tech stack: Zoho Books, Google Sheets, Notion

BEHAVIOR:
  Tracks MRR, churn, CAC in a Google Sheet
  Has a "runway calculator" spreadsheet from a template
  Investor asked for 3-year projected P&L, BS, CF — she stayed up 3 nights building it in Excel
  Doesn't know Ind AS format — made up balance sheet items
  Investor's CA said the projections "don't tie up" (P&L ≠ BS ≠ CF)

PAIN POINTS:
  1. Her Excel projections don't balance — P&L net profit doesn't flow to BS retained earnings
  2. No idea how to project balance sheet (she only thinks in P&L terms)
  3. "If we hire 5 more people, what happens to runway?" — her spreadsheet can't answer this cleanly
  4. Needs investor-ready reports that look professional
  5. Advance tax planning is non-existent — CA files but she has no visibility

WHAT HE NEEDS:
  - Three-way integrated forecast (P&L=BS=CF, no manual tying)
  - Hiring scenario planner with runway impact
  - Fundraise scenario: "Series A of ₹15Cr in 6 months — show bridge"
  - Investor-ready PDF with professional formatting
  - Zoho Books integration (not Tally)

SUCCESS CRITERIA:
  - Investor's CA validates the projections without changes
  - Can model hiring decisions in minutes
  - Raise Series A with credible financial model
```

---

# 3. INFORMATION ARCHITECTURE

## 3.1 Navigation Structure

```
CASHFLOWIQ
├── DASHBOARD (Landing page after login)
│   ├── Client Overview (for CA) / Business Overview (for SME)
│   ├── Cash Health Score
│   ├── Alerts & Notifications
│   └── Quick Actions
│
├── FORECAST (Core product)
│   ├── Forecast Grid
│   │   ├── P&L View
│   │   ├── Balance Sheet View
│   │   └── Cash Flow View
│   ├── Baseline Settings
│   │   ├── Value Rules (per account)
│   │   ├── Timing Profiles (AR, AP, Deferred, Prepaid)
│   │   ├── Drivers (headcount, units, custom)
│   │   └── Schedules (depreciation, loans, tax)
│   ├── Micro-Forecasts (Event Builder)
│   │   ├── List of all micro-forecasts
│   │   ├── Wizard: New Hire
│   │   ├── Wizard: Asset Purchase
│   │   ├── Wizard: New Loan
│   │   ├── Wizard: New Client/Revenue
│   │   ├── Wizard: Marketing Campaign
│   │   ├── Wizard: Equity Raise
│   │   └── Custom (build from scratch)
│   ├── Business Roadmap (Visual Timeline)
│   ├── Scenarios
│   │   ├── Scenario List
│   │   ├── Scenario Builder
│   │   └── Scenario Comparison
│   └── Quick Metrics Bar (persistent bottom)
│
├── COMPLIANCE (India-specific)
│   ├── GST Forecast
│   │   ├── Output GST (auto from revenue)
│   │   ├── Input GST (auto from purchases)
│   │   ├── Net GST Payable
│   │   └── Payment Schedule
│   ├── TDS Forecast
│   │   ├── TDS on Salaries (auto from salary events)
│   │   ├── TDS on Contractors
│   │   ├── TDS on Rent
│   │   └── Payment Schedule
│   ├── Advance Tax Forecast
│   │   ├── Estimated Tax (auto from projected PBT)
│   │   ├── Quarterly Installments
│   │   └── Interest on Shortfall
│   └── PF/ESI Forecast
│       ├── PF (auto from salary events)
│       ├── ESI (auto from salary events)
│       └── Payment Schedule
│
├── ANALYSIS
│   ├── Working Capital Analysis
│   │   ├── DSO/DPO/DIO Trends
│   │   ├── Cash Conversion Cycle
│   │   └── Working Capital Gap
│   ├── Breakeven Analysis
│   ├── Ratio Analysis
│   └── Historical Trends
│
├── REPORTS
│   ├── Management Report (Fathom-style)
│   │   ├── Notes to Management (AI-generated or manual)
│   │   ├── Key Metrics
│   │   ├── Financials (P&L, BS, CF)
│   │   ├── Cash Flow Analysis
│   │   ├── Breakeven Analysis
│   │   └── Forecast Projection
│   ├── Bank Loan Proposal Report
│   │   ├── Projected P&L (3 years)
│   │   ├── Projected Balance Sheet (3 years)
│   │   ├── Projected Cash Flow (3 years)
│   │   ├── Key Ratios
│   │   └── DSCR Calculation
│   ├── Scenario Comparison Report
│   ├── Snapshot Variance Report
│   └── Custom Report Builder
│
├── DATA (For CA / Admin)
│   ├── Data Sources
│   │   ├── Upload Excel/CSV
│   │   ├── Tally Import
│   │   ├── Zoho Books Connect
│   │   └── Manual Entry
│   ├── Chart of Accounts
│   ├── Historical Data Viewer
│   └── Data Mapping
│
├── SNAPSHOTS (Phase 3)
│   ├── Save Snapshot
│   ├── Snapshot List
│   └── Variance Analysis (Snapshot vs Actuals)
│
├── PORTFOLIO (CA-only)
│   ├── Client List with Health Scores
│   ├── Client Comparison Dashboard
│   ├── Engagement Opportunities
│   └── Bulk Actions
│
└── SETTINGS
    ├── Company Profile
    ├── Branding (for CA white-label)
    ├── User Management & Roles
    ├── Subscription & Billing
    ├── Preferences (₹ format, FY start, language)
    └── Integrations
```

## 3.2 Permission Matrix

| Feature | SME Owner | Startup Founder | CA (Own Firm) | CA Staff | CA Client Viewer |
|---|---|---|---|---|---|
| Dashboard | Full | Full | Full (all clients) | Full (assigned) | Read-only |
| Forecast Grid | Edit | Edit | Edit (all) | Edit (assigned) | Read-only |
| Baseline Settings | Edit | Edit | Edit | Edit (assigned) | Hidden |
| Micro-Forecasts | Add/Edit Own | Add/Edit Own | Add/Edit (all) | Add/Edit (assigned) | Hidden |
| Scenarios | Create/Compare | Create/Compare | Create/Compare | Create/Compare | Read-only |
| Compliance | View | View | Edit | Edit (assigned) | Hidden |
| Reports | Generate/PDF | Generate/PDF | Generate/PDF (all) | Generate (assigned) | View only |
| Data Import | Upload | Upload | Upload (all) | Upload (assigned) | Hidden |
| Snapshots | Save/View | Save/View | Save/View | Save/View | Hidden |
| Portfolio | Hidden | Hidden | Full | Assigned list | Hidden |
| Settings | Own Company | Own Company | Firm + Clients | Own profile | Hidden |
| Branding | Hidden | Hidden | Full | Hidden | Hidden |

---

# 4. APPLICATION FLOW (SCREEN-BY-SCREEN)

## 4.1 Flow 1: CA Onboards New Client

```
STEP 1: CA clicks "Add Client" from Portfolio
  ↓
STEP 2: Client Setup Screen
  - Company Name: "Patel Engineering Works Pvt Ltd"
  - PAN: ABCDE1234F
  - GSTIN: 24ABCDE1234F1Z5
  - Industry: Manufacturing
  - Financial Year Start: April (default for India)
  - Base Currency: INR (default)
  - Number Format: Lakhs/Crores (default)
  ↓
STEP 3: Data Import Screen
  - Option A: "Upload from Tally" → select XML/JSON file
  - Option B: "Upload Excel" → download template, fill, upload
  - Option C: "Connect Zoho Books" → OAuth flow
  - Option D: "Manual Entry" → enter monthly P&L + BS
  ↓
STEP 4: Data Mapping Screen (if Excel/manual)
  - Left column: User's account names from their file
  - Right column: Map to CashFlowIQ standard categories
    "Sales - Domestic"  → [Revenue - Domestic Sales ▼]
    "Purchase of RM"    → [COGS - Raw Materials ▼]
    "Staff Cost"        → [Expenses - Salaries & Wages ▼]
  - Auto-suggest based on keyword matching
  - "Auto-map all recognizable accounts" button
  ↓
STEP 5: Data Validation Screen
  - Shows imported data in table format
  - Flags:
    🔴 P&L doesn't balance (total debits ≠ total credits)
    🔴 Balance Sheet doesn't balance (Assets ≠ Liabilities + Equity)
    🟡 Missing months (only 9 months of data, need 12)
    🟡 Duplicate account names detected
    🟢 All checks passed
  - User fixes issues or confirms exceptions
  ↓
STEP 6: Chart of Accounts Finalized
  - Shows final mapped CoA in tree structure
  - User can:
    - Merge accounts ("Office Rent" + "Factory Rent" → "Rent")
    - Split accounts ("Staff Cost" → "Salaries" + "PF" + "ESI")
    - Add accounts not in historical data
    - Reorder hierarchy
  - "Confirm & Proceed" button
  ↓
STEP 7: Quick Start Baseline Generation
  - Loading animation: "Analyzing 12 months of historical data..."
  - Progress indicators:
    ✓ Identifying revenue trends... 
    ✓ Calculating cost ratios...
    ✓ Deriving timing profiles from AR/AP patterns...
    ✓ Building depreciation schedules...
    ✓ Setting up loan amortization...
    ✓ Generating 12-month baseline forecast...
  - "Baseline Ready! Review your forecast →" button
  ↓
STEP 8: Forecast Grid (first view)
  - Opens to P&L view, 12 historical + 12 projected months
  - Actual months have white background
  - Projected months have light blue background
  - Quick Metrics bar at bottom:
    Cash on Hand: ₹24.5L | Net Income: ₹8.2L | Gross Margin: 38.2%
  - Tooltip popup: "Welcome! Click any cell to adjust, or add business events
    using the Micro-Forecast panel on the left"
  ↓
STEP 9: CA reviews, adjusts, adds events (ongoing use)
```

## 4.2 Flow 2: SME Owner Views Dashboard

```
STEP 1: SME logs in (simplified view — not full forecast grid)
  ↓
STEP 2: Business Health Dashboard
  ┌─────────────────────────────────────────────────┐
  │  Cash Health: 🟡 MODERATE                        │
  │                                                   │
  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
  │  │Cash on │ │This    │ │Next GST│ │Working │   │
  │  │Hand    │ │Month CF│ │Payment │ │Capital │   │
  │  │₹24.5L  │ │-₹3.2L  │ │₹8.2L   │ │Gap     │   │
  │  │        │ │⚠ NEG  │ │Due 20th│ │-₹5.2L  │   │
  │  └────────┘ └────────┘ └────────┘ └────────┘   │
  │                                                   │
  │  ⚠️ ALERTS:                                       │
  │  🔴 Cash projected ₹1.2L on Oct 18 — before GST  │
  │     payment of ₹8.2L on Oct 20                   │
  │  🟡 Tata Motors invoice ₹12L overdue 15 days     │
  │  🟡 OD utilization at 85%                        │
  │                                                   │
  │  12-Month Cash Projection (Waterfall Chart)       │
  │  ▓▓▓▓▓▓▓▓░░░░░░░░                               │
  │  ▓▓▓▓▓▓▓▓▓▓░░░░░                               │
  │  ▓▓▓▓▓▓▓▓▓▓▓▓░░░                               │
  │  ─ ─ ─ ─ Minimum balance ₹5L                    │
  │                                                   │
  │  [Ask CA a Question] [View Full Forecast]         │
  └─────────────────────────────────────────────────┘
```

## 4.3 Flow 3: Adding a Micro-Forecast (New Hire)

```
STEP 1: User clicks "+ Add Event" from left sidebar in Forecast view
  ↓
STEP 2: Event Type Selection
  ┌─────────────────────────────────────────┐
  │  What do you want to model?             │
  │                                          │
  │  👤 New Hire                             │
  │  🏭 Asset Purchase                      │
  │  🏦 New Loan                            │
  │  📈 New Revenue / Client                │
  │  📢 Marketing Campaign                  │
  │  💰 Equity Raise / Fundraise            │
  │  📉 Client Loss / Revenue Reduction     │
  │  🔧 Custom Event                        │
  └─────────────────────────────────────────┘
  ↓ User selects "New Hire"
STEP 3: New Hire Wizard - Step 1: Basic Info
  ┌─────────────────────────────────────────┐
  │  New Hire: Employee Details             │
  │                                          │
  │  Role:       [Senior Developer     ]    │
  │  Department: [Engineering          ]    │
  │  Start Date: [August 1, 2025      📅]   │
  │  Monthly CTC: [₹80,000             💰]   │
  │                                          │
  │  Expected Revenue Contribution:          │
  │  [ ] This hire will generate revenue    │
  │  Monthly Revenue: [₹0                ]   │
  │                                          │
  │                    [Cancel] [Next →]     │
  └─────────────────────────────────────────┘
  ↓
STEP 4: New Hire Wizard - Step 2: Benefits & Compliance
  ┌─────────────────────────────────────────┐
  │  New Hire: Benefits & Statutory         │
  │                                          │
  │  Basic Salary (% of CTC): [50%  ]       │
  │    → Basic: ₹40,000                     │
  │                                          │
  │  PF Applicable: [✓]                      │
  │    Employer PF (12% of basic): ₹4,800   │
  │    Employee PF (12% of basic): ₹4,800   │
  │                                          │
  │  ESI Applicable: [✓] (CTC ≤ ₹21,000)    │
  │    Employer ESI (3.25%): ₹2,600         │
  │    Employee ESI (0.75%): ₹600           │
  │                                          │
  │  TDS Regime: [New Regime ▼]             │
  │    Estimated TDS/month: ₹2,333          │
  │                                          │
  │  Other Benefits:                         │
  │    Insurance: [₹0  ]                     │
  │    Transport: [₹0  ]                     │
  │                                          │
  │  ─────────────────────────────           │
  │  Total Monthly Cost to Company: ₹92,200 │
  │  (CTC ₹80K + Employer PF ₹4.8K + ESI ₹2.6K + Benefits)│
  │                                          │
  │                    [← Back] [Next →]     │
  └─────────────────────────────────────────┘
  ↓
STEP 5: New Hire Wizard - Step 3: Cash Timing
  ┌─────────────────────────────────────────┐
  │  New Hire: Cash Flow Timing              │
  │                                          │
  │  When is salary paid?                    │
  │  (●) Same month (paid by month-end)     │
  │  ( ) Next month (paid on 5th/7th)       │
  │                                          │
  │  When is PF deposited?                   │
  │  ( ) Same month                          │
  │  (●) Next month 15th (standard)         │
  │                                          │
  │  When is ESI deposited?                  │
  │  ( ) Same month                          │
  │  (●) Next month 15th (standard)         │
  │                                          │
  │  When is TDS deposited?                  │
  │  (●) Next month 7th (standard)          │
  │  ( ) Quarterly                           │
  │                                          │
  │                    [← Back] [Save]       │
  └─────────────────────────────────────────┘
  ↓
STEP 6: Confirmation + Impact Preview
  ┌─────────────────────────────────────────┐
  │  ✓ Micro-Forecast Created:               │
  │    "Senior Developer - Aug 2025"         │
  │                                          │
  │  IMPACT PREVIEW:                         │
  │  ┌──────────┬────────┬────────┬────────┐│
  │  │          │ Aug    │ Sep    │ Oct    ││
  │  ├──────────┼────────┼────────┼────────┤│
  │  │ P&L Hit  │ ₹87.4K │ ₹87.4K │ ₹87.4K ││
  │  │ Cash Out │ ₹80K   │ ₹92.2K │ ₹92.2K ││
  │  │ (net of  │(salary)│(salary+│(salary+││
  │  │  timing) │        │PF+ESI) │PF+ESI) ││
  │  │ Cash on  │ ₹23.7L │ ₹22.8L │ ₹21.8L ││
  │  │ Hand     │        │        │        ││
  │  └──────────┴────────┴────────┴────────┘│
  │                                          │
  │  [Add to Roadmap] [View in Grid]        │
  └─────────────────────────────────────────┘
```

## 4.4 Flow 4: Scenario Comparison

```
STEP 1: User clicks "Scenarios" in left sidebar
  ↓
STEP 2: Scenario List
  ┌─────────────────────────────────────────────┐
  │  SCENARIOS                                   │
  │                                               │
  │  ● Base Case (main forecast)                 │
  │  ○ Pessimistic                               │
  │  ○ Optimistic                                │
  │  ○ No Funding                                │
  │  ○ Expansion Plan                            │
  │                                               │
  │  [+ New Scenario]  [Compare Selected →]      │
  └─────────────────────────────────────────────┘
  ↓ User clicks "Pessimistic" then "Compare Selected"
STEP 3: Scenario Comparison View
  ┌─────────────────────────────────────────────────┐
  │  SCENARIO COMPARISON                            │
  │  [Base Case] vs [Pessimistic]                   │
  │                                                   │
  │  ┌───────────────────────────────────────────┐ │
  │  │ Cash on Hand Projection                    │ │
  │  │                                            │ │
  │  │ ₹60L ─┤          ╭───╮                     │ │
  │  │ ₹40L ─┤     ╭────╯   ╰────╮  BASE         │ │
  │  │ ₹20L ─┤ ╭───╯              ╰──╮            │ │
  │  │  ₹0  ─┤╯    ╭──╮              ╰── PESSIMISTIC│ │
  │  │-₹20L ─┤  ╭─╯  ╰─╮                    │ │
  │  │        └──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──│ │
  │  │          M4 M5 M6 M7 M8 M9 M10 M11 M12│ │
  │  │  ─ ─ ─ ─ Minimum cash ₹5L              │ │
  │  └───────────────────────────────────────────┘ │
  │                                                   │
  │  KEY DIFFERENCES (Pessimistic overrides):        │
  │  • Revenue: -15% baseline adjustment             │
  │  • Collection timing: 30/40/20 → 20/30/30/15     │
  │  • COGS: +5% inflation adjustment                │
  │  • Equity Raise micro-forecast: DISABLED         │
  │  • OD Limit: ₹20L → ₹15L                        │
  │                                                   │
  │  IMPACT SUMMARY:                                 │
  │  ┌─────────────┬──────────┬──────────┐           │
  │  │ Metric      │ Base     │ Pessim.  │           │
  │  ├─────────────┼──────────┼──────────┤           │
  │  │ End Cash    │ ₹18.2L   │ -₹8.4L   │           │
  │  │ Months Neg  │ 0        │ 4        │           │
  │  │ Max Shortfall│ ₹0      │ ₹13.2L   │           │
  │  │ Need Loan?  │ No       │ YES ₹15L │           │
  │  └─────────────┴──────────┴──────────┘           │
  │                                                   │
  │  [Export to PDF] [Edit Pessimistic] [Back]        │
  └─────────────────────────────────────────────────┘
```

---

# 5. FRONTEND ARCHITECTURE

## 5.1 Technology Choice

```
FRAMEWORK: Next.js 14+ (App Router)
  Why: SSR for initial load performance, API routes for backend,
       file-based routing, React Server Components for data-heavy grids
  
LANGUAGE: TypeScript (strict mode)
  Why: Type safety across complex forecast data structures,
       better IDE support, fewer runtime errors in calculation engine
  
STATE MANAGEMENT: Zustand + React Query (TanStack Query)
  Why: 
    - Zustand: Lightweight client state (selected scenario, UI toggles)
    - React Query: Server state caching, optimistic updates,
      background refetch when forecast recalculates
  
STYLING: Tailwind CSS + shadcn/ui components
  Why: Rapid prototyping, consistent design system, accessible by default
  
CHARTS: Recharts (primary) + D3.js (complex custom charts)
  Why: Recharts is React-native, good enough for 90% of charts
       D3 for the waterfall chart and custom roadmap Gantt chart
  
GRID: AG Grid Community (for forecast grid) or TanStack Table
  Why: The forecast grid is essentially a complex spreadsheet
       AG Grid handles: frozen columns, cell editing, custom cell renderers,
       column grouping, excel-like navigation, virtual scrolling for large CoA
  
FORMS: React Hook Form + Zod validation
  Why: Type-safe form validation, micro-forecast wizards need complex multi-step forms
```

## 5.2 Frontend Module Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Auth group (login, signup, forgot)
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/                   # Main app group (authenticated)
│   │   ├── layout.tsx           # Sidebar + topbar shell
│   │   ├── dashboard/page.tsx
│   │   ├── forecast/
│   │   │   ├── page.tsx         # Main forecast grid
│   │   │   ├── baseline/
│   │   │   │   ├── page.tsx     # Baseline settings
│   │   │   │   ├── value-rules/page.tsx
│   │   │   │   ├── timing-profiles/page.tsx
│   │   │   │   ├── drivers/page.tsx
│   │   │   │   └── schedules/page.tsx
│   │   │   ├── micro-forecasts/
│   │   │   │   ├── page.tsx     # List view
│   │   │   │   ├── new/page.tsx # Event type selector
│   │   │   │   ├── new-hire/page.tsx
│   │   │   │   ├── asset/page.tsx
│   │   │   │   ├── loan/page.tsx
│   │   │   │   ├── revenue/page.tsx
│   │   │   │   ├── marketing/page.tsx
│   │   │   │   ├── equity/page.tsx
│   │   │   │   └── custom/page.tsx
│   │   │   ├── roadmap/page.tsx # Visual Gantt timeline
│   │   │   └── scenarios/
│   │   │       ├── page.tsx
│   │   │       ├── [id]/page.tsx
│   │   │       └── compare/page.tsx
│   │   ├── compliance/
│   │   │   ├── gst/page.tsx
│   │   │   ├── tds/page.tsx
│   │   │   ├── advance-tax/page.tsx
│   │   │   └── pf-esi/page.tsx
│   │   ├── analysis/
│   │   │   ├── working-capital/page.tsx
│   │   │   ├── breakeven/page.tsx
│   │   │   └── ratios/page.tsx
│   │   ├── reports/
│   │   │   ├── management/page.tsx
│   │   │   ├── bank-loan/page.tsx
│   │   │   └── custom/page.tsx
│   │   ├── data/
│   │   │   ├── import/page.tsx
│   │   │   ├── chart-of-accounts/page.tsx
│   │   │   └── history/page.tsx
│   │   ├── portfolio/           # CA-only
│   │   │   ├── page.tsx
│   │   │   └── [clientId]/page.tsx
│   │   └── settings/
│   │       ├── company/page.tsx
│   │       ├── branding/page.tsx
│   │       ├── users/page.tsx
│   │       └── integrations/page.tsx
│   └── api/                     # Next.js API Routes (BFF layer)
│       ├── forecast/
│       │   ├── generate/route.ts
│       │   ├── cell-update/route.ts
│       │   └── quick-metrics/route.ts
│       ├── micro-forecasts/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── scenarios/
│       │   ├── route.ts
│       │   └── compare/route.ts
│       ├── data/
│       │   ├── upload/route.ts
│       │   ├── tally-import/route.ts
│       │   └── map-accounts/route.ts
│       └── reports/
│           └── generate-pdf/route.ts
│
├── components/
│   ├── ui/                      # shadcn/ui base components
│   ├── forecast/
│   │   ├── ForecastGrid.tsx      # Main grid (AG Grid wrapper)
│   │   ├── ForecastCell.tsx      # Individual cell with rule tooltip
│   │   ├── PeriodHeader.tsx      # Month columns with actual/forecast labels
│   │   ├── AccountRow.tsx        # Single account row with expand/collapse
│   │   ├── SubtotalRow.tsx       # GP, OP, NP summary rows
│   │   ├── QuickMetricsBar.tsx   # Bottom metrics strip
│   │   └── ViewSwitcher.tsx      # P&L / BS / CF tab switcher
│   ├── micro-forecasts/
│   │   ├── MicroForecastCard.tsx
│   │   ├── WizardStepper.tsx
│   │   ├── NewHireWizard.tsx
│   │   ├── AssetWizard.tsx
│   │   ├── LoanWizard.tsx
│   │   └── ImpactPreview.tsx
│   ├── roadmap/
│   │   ├── GanttTimeline.tsx     # D3-based Gantt chart
│   │   ├── EventBar.tsx          # Draggable event bar
│   │   └── CashOnHandLine.tsx    # Running cash projection overlay
│   ├── scenarios/
│   │   ├── ScenarioCard.tsx
│   │   ├── ComparisonChart.tsx
│   │   └── OverrideEditor.tsx
│   ├── compliance/
│   │   ├── GSTSchedule.tsx
│   │   ├── TDSSchedule.tsx
│   │   ├── AdvanceTaxSchedule.tsx
│   │   └── ComplianceCalendar.tsx # All due dates on calendar
│   ├── charts/
│   │   ├── CashWaterfall.tsx
│   │   ├── ScenarioComparison.tsx
│   │   ├── WCGapChart.tsx
│   │   └── RevenueExpenseTrend.tsx
│   ├── data-import/
│   │   ├── FileUploader.tsx
│   │   ├── MappingTable.tsx
│   │   ├── ValidationResults.tsx
│   │   └── CoATree.tsx
│   └── reports/
│       ├── ReportPreview.tsx
│       ├── PDFExportButton.tsx
│       └── BrandingSettings.tsx
│
├── lib/
│   ├── engine/                   # FORECAST ENGINE (runs on server)
│   │   ├── index.ts              # Main orchestration
│   │   ├── baseline.ts           # Baseline generation
│   │   ├── value-rules.ts        # Value rule calculators
│   │   ├── timing-profiles.ts    # Cash conversion logic
│   │   ├── three-way.ts          # P&L → BS → CF integration
│   │   ├── micro-forecasts.ts    # Event overlay logic
│   │   ├── scenarios.ts          # Scenario inheritance + override
│   │   └── types.ts              # Engine type definitions
│   ├── compliance/
│   │   ├── gst-engine.ts
│   │   ├── tds-engine.ts
│   │   ├── advance-tax-engine.ts
│   │   └── pf-esi-engine.ts
│   ├── import/
│   │   ├── excel-parser.ts       # XLSX → standardized format
│   │   ├── tally-parser.ts       # Tally XML → standardized format
│   │   ├── account-mapper.ts    # Fuzzy match to standard CoA
│   │   └── validator.ts          # Balance checks, gap detection
│   ├── reports/
│   │   ├── pdf-generator.ts      # HTML → PDF using Puppeteer
│   │   ├── management-report.ts  # Fathom-style report builder
│   │   └── bank-loan-report.ts   # Indian bank format
│   ├── utils/
│   │   ├── indian-format.ts      # ₹, lakhs, crores formatting
│   │   ├── date-utils.ts         # Indian FY, month handling
│   │   └── math-utils.ts         # Safe arithmetic (no floating point)
│   └── validations/
│       ├── forecast-rules.ts     # Zod schemas for forecast data
│       └── import-rules.ts       # Zod schemas for import data
│
├── stores/
│   ├── forecast-store.ts         # Zustand: selected period, view, scenario
│   ├── ui-store.ts               # Zustand: sidebar state, modals, toasts
│   └── auth-store.ts             # Zustand: user session, permissions
│
├── hooks/
│   ├── useForecast.ts            # React Query: fetch + cache forecast
│   ├── useQuickMetrics.ts        # React Query: fetch metrics
│   ├── useMicroForecasts.ts      # React Query: CRUD micro-forecasts
│   ├── useScenarios.ts           # React Query: CRUD scenarios
│   └── useCellEdit.ts            # Optimistic cell editing
│
└── types/
    ├── forecast.ts               # All forecast-related types
    ├── company.ts
    ├── user.ts
    ├── compliance.ts
    └── api.ts                    # API request/response types
```

## 5.3 Critical Frontend Component: ForecastGrid

This is the most complex UI component. Here's its internal architecture:

```
ForecastGrid
├── Container (handles scrolling, resize)
│   ├── Frozen Left Panel (Account names + codes, always visible)
│   │   ├── AccountRow (level 0 - group header, e.g., "Revenue")
│   │   │   └── AccountRow (level 1 - account, e.g., "Domestic Sales")
│   │   │       └── AccountRow (level 2 - sub-account, if any)
│   │   ├── SubtotalRow ("Gross Profit") - bold, colored
│   │   ├── SubtotalRow ("Operating Profit")
│   │   └── SubtotalRow ("Net Income")
│   │
│   ├── Scrollable Right Panel (month columns)
│   │   ├── PeriodHeader
│   │   │   ├── Actual Month (white bg, "Apr 2024 ✓")
│   │   │   ├── Actual Month (white bg, "May 2024 ✓")
│   │   │   ├── ... (12 actual months)
│   │   │   ├── Forecast Month (blue bg, "Apr 2025")
│   │   │   ├── Forecast Month (blue bg, "May 2025")
│   │   │   └── ... (12 forecast months)
│   │   │
│   │   └── DataRows
│   │       ├── ForecastCell (actual month - readonly, dimmed)
│   │       ├── ForecastCell (forecast month - editable)
│   │       │   ├── Display value: "₹12,34,567"
│   │       │   ├── On hover: show underlying rule tooltip
│   │       │   │   "Rule: Rolling Average (6 months)"
│   │       │   │   "Micro-forecast contribution: +₹80,000 (New Hire)"
│   │       │   │   "Scenario override: -15% (Pessimistic)"
│   │       │   ├── On click: enter edit mode (input field)
│   │       │   │   → On blur: save via API, update grid
│   │       │   │   → Creates "Direct Entry" override for this cell
│   │       │   └── Color coding:
│   │       │       - Blue text: baseline value
│   │       │       - Green text: micro-forecast contribution added
│   │       │       - Orange text: scenario override applied
│   │       │       - Red text: below threshold (cash on hand)
│   │       │       - Gray bg: actual month (not editable)
│   │       └── VarianceCell (optional column: forecast vs last year %)
│   │
│   └── Quick Metrics Bar (fixed at bottom of grid)
│       ├── Metric 1: Cash on Hand [₹24.5L] [mini chart] [threshold line]
│       ├── Metric 2: Net Income [₹8.2L] [mini chart]
│       ├── Metric 3: Gross Margin % [38.2%] [mini chart]
│       ├── Metric 4: [user selected] [mini chart]
│       └── Metric 5: [user selected] [mini chart]
│
├── Toolbar (above grid)
│   ├── View Switcher: [P&L] [Balance Sheet] [Cash Flow]
│   ├── Scenario Selector: [Base Case ▼]
│   ├── Period Toggle: [Monthly] [Quarterly]
│   ├── Subtotals Toggle: [Show GP/OP/NP ✓]
│   ├── Account Codes Toggle: [Show ✓]
│   ├── Expand/Collapse All
│   ├── Undo / Redo
│   └── Export: [Excel] [PDF]
│
└── Left Sidebar Panel (toggleable)
    ├── Baseline Section
    │   └── [Configure Baseline →]
    ├── Micro-Forecasts Section
    │   ├── Micro-Forecast 1: "Senior Developer" [🔴 ON] [drag handle]
    │   ├── Micro-Forecast 2: "CNC Machine" [🟢 ON] [drag handle]
    │   ├── Micro-Forecast 3: "LinkedIn Campaign" [⚪ OFF] [drag handle]
    │   └── [+ Add Micro-Forecast]
    └── Roadmap Button: [Open Timeline View →]
```

---

# 6. BACKEND ARCHITECTURE

## 6.1 Technology Choice

```
RUNTIME: Node.js 20+ LTS
  Why: TypeScript ecosystem shared with frontend, 
       non-blocking I/O for import processing,
       large npm ecosystem

FRAMEWORK: NestJS
  Why: 
    - Modular architecture (each domain is a module)
    - Dependency injection (clean engine composition)
    - Built-in guards/pipes/interceptors (validation, auth)
    - OpenAPI/Swagger auto-generation
    - Queue support via BullMQ for heavy jobs
    - Testable (easy to unit test engine logic)

LANGUAGE: TypeScript (strict mode, shared types with frontend)

DATABASE: PostgreSQL 16
  Why:
    - Relational data (companies, accounts, periods, values)
    - JSONB columns for flexible engine configuration
    - Excellent tooling (Drizzle ORM, pgAdmin)
    - Row-level security for multi-tenancy
    - Mature, reliable, free

ORM: Drizzle ORM
  Why: Type-safe queries, zero runtime overhead,
       migrations, excellent PostgreSQL support,
       simpler than Prisma for complex queries

CACHE: Redis
  Why: Cache computed forecast results (expensive to recalculate),
       session storage, rate limiting, BullMQ backing store

QUEUE: BullMQ (Redis-backed)
  Why: Heavy operations should be async:
    - Data import + parsing (10-30 seconds)
    - Baseline generation (5-15 seconds)
    - Full forecast recalculation (2-5 seconds)
    - PDF report generation (3-10 seconds)

FILE STORAGE: AWS S3 (or compatible: Cloudflare R2, MinIO)
  Why: Store uploaded Excel/Tally files, generated PDFs,
       exported reports

PDF GENERATION: Puppeteer (headless Chrome)
  Why: HTML/CSS → PDF with pixel-perfect control,
       supports charts (rendered server-side),
       supports Indian fonts (Hindi reports)

EMAIL: Resend (or AWS SES)
  Why: Transactional emails (report delivery, alerts),
       simple API, good deliverability
```

## 6.2 Backend Module Structure

```
src/
├── main.ts                          # NestJS bootstrap
├── app.module.ts                    # Root module
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts       # POST /auth/login, /auth/register
│   │   ├── auth.service.ts          # JWT generation, password hashing
│   │   ├── jwt.strategy.ts          # Passport JWT strategy
│   │   ├── guards/
│   │   │   ├── jwt.guard.ts
│   │   │   └── roles.guard.ts       # Role-based access
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       └── register.dto.ts
│   │
│   ├── companies/
│   │   ├── companies.module.ts
│   │   ├── companies.controller.ts  # CRUD /companies
│   │   ├── companies.service.ts
│   │   └── dto/
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts      # CRUD /users
│   │   ├── users.service.ts
│   │   └── dto/
│   │
│   ├── chart-of-accounts/
│   │   ├── coa.module.ts
│   │   ├── coa.controller.ts        # GET /coa/:companyId
│   │   ├── coa.service.ts           # Tree structure, mapping
│   │   └── entities/
│   │       └── account.entity.ts
│   │
│   ├── historical-data/
│   │   ├── historical.module.ts
│   │   ├── historical.controller.ts # GET/POST /historical/:companyId
│   │   ├── historical.service.ts    # Monthly actuals storage
│   │   └── entities/
│   │       └── monthly-actual.entity.ts
│   │
│   ├── data-import/
│   │   ├── import.module.ts
│   │   ├── import.controller.ts     # POST /import/upload
│   │   ├── import.service.ts        # Orchestrates parsing + mapping + validation
│   │   ├── processors/
│   │   │   ├── excel.processor.ts   # XLSX parsing
│   │   │   ├── tally.processor.ts   # XML parsing
│   │   │   └── zoho.processor.ts    # API fetch
│   │   ├── mappers/
│   │   │   ├── account-mapper.ts    # Fuzzy match accounts
│   │   │   └── period-mapper.ts     # Detect month columns
│   │   ├── validators/
│   │   │   ├── balance-validator.ts # P&L/BS balance check
│   │   │   └── gap-validator.ts     # Missing month detection
│   │   └── dto/
│   │       └── upload.dto.ts
│   │
│   ├── forecast/
│   │   ├── forecast.module.ts
│   │   ├── forecast.controller.ts
│   │   │   ├── POST /forecast/generate         # Trigger full generation
│   │   │   ├── GET  /forecast/:companyId        # Get forecast data
│   │   │   ├── PATCH /forecast/cell             # Update single cell
│   │   │   ├── GET  /forecast/quick-metrics     # Get metric values
│   │   │   └── GET  /forecast/periods           # Get period list
│   │   ├── forecast.service.ts      # Orchestrates engine
│   │   ├── forecast.cache.ts        # Redis caching strategy
│   │   ├── entities/
│   │   │   ├── forecast-snapshot.entity.ts  # Stored forecast result
│   │   │   ├── value-rule.entity.ts
│   │   │   ├── timing-profile.entity.ts
│   │   │   ├── driver.entity.ts
│   │   │   └── schedule.entity.ts
│   │   └── dto/
│   │
│   ├── engine/                      # ★ CORE FORECAST ENGINE ★
│   │   ├── engine.module.ts
│   │   ├── engine.service.ts        # Public API for forecast module
│   │   ├── baseline/
│   │   │   ├── baseline-generator.ts
│   │   │   ├── value-rules/
│   │   │   │   ├── rule.interface.ts
│   │   │   │   ├── rolling-average.rule.ts
│   │   │   │   ├── smart-prediction.rule.ts
│   │   │   │   ├── growth.rule.ts
│   │   │   │   ├── same-as-last-year.rule.ts
│   │   │   │   ├── link-to-previous.rule.ts
│   │   │   │   ├── formula.rule.ts
│   │   │   │   ├── direct-entry.rule.ts
│   │   │   │   └── baseline-adjustment.rule.ts  # For scenarios
│   │   │   ├── timing-profiles/
│   │   │   │   ├── profile.interface.ts
│   │   │   │   ├── receivables.profile.ts
│   │   │   │   ├── payables.profile.ts
│   │   │   │   ├── deferred-revenue.profile.ts
│   │   │   │   └── prepaid-expense.profile.ts
│   │   │   ├── drivers/
│   │   │   │   ├── driver.interface.ts
│   │   │   │   └── driver-calculator.ts
│   │   │   └── schedules/
│   │   │       ├── depreciation.schedule.ts
│   │   │       ├── loan-amortization.schedule.ts
│   │   │       └── tax-provision.schedule.ts
│   │   ├── three-way/
│   │   │   ├── three-way-integrator.ts  # P&L → BS → CF linkage
│   │   │   ├── balance-sheet-builder.ts
│   │   │   └── cash-flow-builder.ts     # Indirect method
│   │   ├── micro-forecasts/
│   │   │   ├── micro-forecast-engine.ts
│   │   │   ├── overlay-calculator.ts
│   │   │   └── wizards/
│   │   │       ├── new-hire.wizard.ts
│   │   │       ├── asset-purchase.wizard.ts
│   │   │       ├── new-loan.wizard.ts
│   │   │       ├── new-revenue.wizard.ts
│   │   │       ├── marketing.wizard.ts
│   │   │       └── equity-raise.wizard.ts
│   │   ├── scenarios/
│   │   │   ├── scenario-engine.ts
│   │   │   ├── inheritance-resolver.ts
│   │   │   └── comparison-calculator.ts
│   │   └── types/
│   │       ├── forecast.types.ts
│   │       ├── value-rule.types.ts
│   │       ├── timing-profile.types.ts
│   │       ├── micro-forecast.types.ts
│   │       └── scenario.types.ts
│   │
│   ├── compliance/
│   │   ├── compliance.module.ts
│   │   ├── compliance.controller.ts
│   │   ├── compliance.service.ts
│   │   ├── engines/
│   │   │   ├── gst.engine.ts
│   │   │   ├── tds.engine.ts
│   │   │   ├── advance-tax.engine.ts
│   │   │   └── pf-esi.engine.ts
│   │   └── entities/
│   │       ├── gst-config.entity.ts
│   │       ├── tds-config.entity.ts
│   │       └── compliance-result.entity.ts
│   │
│   ├── micro-forecasts/
│   │   ├── micro-forecasts.module.ts
│   │   ├── micro-forecasts.controller.ts  # CRUD /micro-forecasts
│   │   ├── micro-forecasts.service.ts
│   │   └── entities/
│   │       └── micro-forecast.entity.ts
│   │
│   ├── scenarios/
│   │   ├── scenarios.module.ts
│   │   ├── scenarios.controller.ts  # CRUD /scenarios
│   │   ├── scenarios.service.ts
│   │   └── entities/
│   │       └── scenario.entity.ts
│   │
│   ├── snapshots/
│   │   ├── snapshots.module.ts
│   │   ├── snapshots.controller.ts
│   │   ├── snapshots.service.ts
│   │   └── entities/
│   │       └── snapshot.entity.ts
│   │
│   ├── reports/
│   │   ├── reports.module.ts
│   │   ├── reports.controller.ts  # GET /reports/generate
│   │   ├── reports.service.ts
│   │   ├── templates/
│   │   │   ├── management-report.ts
│   │   │   ├── bank-loan-report.ts
│   │   │   └── scenario-report.ts
│   │   └── generators/
│   │       └── pdf.generator.ts    # Puppeteer-based
│   │
│   ├── portfolio/                    # CA-only
│   │   ├── portfolio.module.ts
│   │   ├── portfolio.controller.ts
│   │   ├── portfolio.service.ts     # Cross-client aggregation
│   │   └── dto/
│   │
│   └── notifications/
│       ├── notifications.module.ts
│       ├── notifications.controller.ts
│       ├── notifications.service.ts  # Email alerts, in-app alerts
│       └── templates/
│           ├── cash-alert.template.ts
│           └── gst-due.template.ts
│
├── common/
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── company-access.decorator.ts
│   ├── filters/
│   │   └── exception.filter.ts
│   ├── interceptors/
│   │   └── logging.interceptor.ts
│   ├── pipes/
│   │   └── validation.pipe.ts
│   └── guards/
│       ├── company-access.guard.ts   # User can only access their companies
│       └── subscription.guard.ts     # Feature gating by plan
│
├── database/
│   ├── connection.ts                 # Drizzle + PostgreSQL connection
│   ├── migrations/                   # Drizzle migrations
│   └── seeds/
│       ├── standard-coa.seed.ts      # Indian Schedule III chart of accounts
│       └── demo-company.seed.ts      # Sample data for testing
│
└── jobs/                             # BullMQ job processors
    ├── import.processor.ts           # Process uploaded file
    ├── forecast.generator.ts         # Generate baseline forecast
    ├── forecast.updater.ts           # Recalculate after change
    └── report.generator.ts           # Generate PDF report
```

## 6.3 Request Lifecycle for Forecast Generation

```
USER CLICKS "Generate Baseline"
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  FRONTEND                                                │
│  1. POST /api/forecast/generate                          │
│     Body: { companyId: "uuid", historicalMonths: 12,     │
│             forecastMonths: 12 }                         │
│  2. Show loading state with progress steps               │
│  3. Poll GET /api/forecast/status/:jobId every 1s        │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  API LAYER (NestJS Controller)                           │
│  1. Validate request (DTO + Zod)                         │
│  2. Check auth (JWT guard)                               │
│  3. Check company access (user owns/has access)          │
│  4. Check subscription (plan allows forecasting)         │
│  5. Enqueue job: forecast.generate                       │
│  6. Return { jobId: "uuid" }                             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  BULLMQ QUEUE: forecast_queue                             │
│  Job: { id: "uuid", data: { companyId, ... } }           │
│  Status: waiting → active → completed                     │
│  Progress events emitted via Redis pub/sub               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  FORECAST ENGINE (Core computation)                      │
│                                                          │
│  STEP 1: LOAD DATA (emit progress: 10%)                  │
│  ├── Fetch 12 months historical P&L from DB               │
│  ├── Fetch 12 months historical BS from DB                │
│  ├── Fetch Chart of Accounts                              │
│  └── Fetch existing value rules, timing profiles          │
│                                                          │
│  STEP 2: ANALYZE HISTORICAL (emit progress: 25%)         │
│  ├── Calculate trends per account (CAGR, moving avg)     │
│  ├── Calculate cost ratios (COGS/Revenue, etc.)          │
│  ├── Derive timing profiles from AR/AP patterns          │
│  │   ├── For each historical month:                      │
│  │   │   ratio = Receivables_end / Revenue_month         │
│  │   │   → pattern across 12 months → timing profile     │
│  ├── Identify seasonality indices                         │
│  └── Calculate working capital metrics (DSO, DPO, DIO)   │
│                                                          │
│  STEP 3: GENERATE BASELINE P&L (emit progress: 40%)      │
│  ├── For each P&L account:                               │
│  │   ├── Get value rule (default or user-set)             │
│  │   ├── Apply rule to generate 12 forecast months        │
│  │   │   Rolling Average: avg(last N months) → forward   │
│  │   │   Growth: last_month × (1 + growth_rate)          │
│  │   │   Smart Prediction: trend × seasonal_index        │
│  │   │   Link to Revenue: revenue_forecast × ratio       │
│  │   │   Formula: evaluate custom expression             │
│  │   │   Direct Entry: use manually entered values       │
│  │   └── Store in forecast P&L matrix                    │
│  ├── Calculate subtotals: GP, OP, PBT, PAT               │
│  └── Apply tax provision: PBT × tax_rate                 │
│                                                          │
│  STEP 4: GENERATE BASELINE BS (emit progress: 60%)       │
│  ├── Opening BS = last actual month's closing BS          │
│  ├── For each forecast month:                             │
│  │   ├── Retained Earnings = prev_RE + Net Profit        │
│  │   ├── Receivables = f(Revenue, AR timing profile)     │
│  │   ├── Payables = f(COGS+Expenses, AP timing profile)  │
│  │   ├── Inventory = f(COGS, DIO or historical pattern)  │
│  │   ├── Fixed Assets = prev_FA + additions - depreciation│
│  │   ├── Accumulated Depreciation += depreciation_exp     │
│  │   ├── Loans = prev_loans - principal_repayment         │
│  │   ├── Cash = Total Assets - Non-Cash Assets            │
│  │   │   (cash is the PLUG — calculated last)            │
│  │   └── Verify: Assets = Liabilities + Equity           │
│  └── Store in forecast BS matrix                          │
│                                                          │
│  STEP 5: GENERATE BASELINE CF (emit progress: 75%)       │
│  ├── For each forecast month (Indirect Method):          │
│  │   ├── Operating CF:                                    │
│  │   │   ├── Start: Net Profit                            │
│  │   │   ├── + Depreciation (non-cash P&L item)          │
│  │   │   ├── + Other non-cash adjustments                │
│  │   │   ├── - Increase in Receivables (Δ AR)            │
│  │   │   ├── - Increase in Inventory (Δ Inv)             │
│  │   │   ├── + Increase in Payables (Δ AP)               │
│  │   │   ├── + Increase in Other CL (Δ OCL)              │
│  │   │   ├── - Increase in Other CA (Δ OCA)              │
│  │   │   └── = Net Operating Cash Flow                   │
│  │   ├── Investing CF:                                    │
│  │   │   ├── - Purchase of Fixed Assets (CapEx)          │
│  │   │   ├── + Sale of Fixed Assets                      │
│  │   │   └── = Net Investing Cash Flow                   │
│  │   ├── Financing CF:                                    │
│  │   │   ├── + New Borrowings                             │
│  │   │   ├── - Loan Repayments (principal)               │
│  │   │   ├── - Interest Paid (or in Operating)           │
│  │   │   ├── + Equity Raised                             │
│  │   │   ├── - Dividends Paid                            │
│  │   │   └── = Net Financing Cash Flow                   │
│  │   ├── Net Cash Flow = Operating + Investing + Financing│
│  │   └── Closing Cash = Opening Cash + Net Cash Flow     │
│  │       ├── Cross-check: Closing Cash should match      │
│  │       │   the Cash calculated in BS (step 4)          │
│  │       └── If mismatch: adjust (circular reference     │
│  │           handling — iterate until convergence)        │
│  └── Store in forecast CF matrix                          │
│                                                          │
│  STEP 6: RUN COMPLIANCE ENGINES (emit progress: 85%)     │
│  ├── GST Engine: calculate net GST per month              │
│  ├── TDS Engine: calculate TDS per month                  │
│  ├── Advance Tax Engine: quarterly installments           │
│  ├── PF/ESI Engine: monthly statutory costs               │
│  └── Add compliance cash flows to CF (separate lines)    │
│                                                          │
│  STEP 7: APPLY MICRO-FORECASTS (emit progress: 92%)      │
│  ├── For each active micro-forecast:                      │
│  │   ├── Get its P&L impacts per month                    │
│  │   ├── Get its BS impacts per month                     │
│  │   ├── Get its timing profiles (may differ from baseline│
│  │   ├── Get its schedules (e.g., new loan EMI)          │
│  │   ├── Run three-way integration for this micro-FC     │
│  │   └── Overlay results onto baseline matrices           │
│  └── Re-run three-way integration to ensure balance      │
│                                                          │
│  STEP 8: CALCULATE QUICK METRICS (emit progress: 96%)    │
│  ├── Cash on Hand per month                               │
│  ├── Net Income per month                                 │
│  ├── Gross Margin % per month                             │
│  ├── User-selected KPIs per month                         │
│  └── Threshold checks (flag months below minimum)        │
│                                                          │
│  STEP 9: STORE RESULTS (emit progress: 100%)             │
│  ├── Save forecast_snapshot to DB (all values)           │
│  ├── Cache in Redis (keyed by companyId + scenarioId)    │
│  └── Emit completion event                                │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  FRONTEND receives completion                             │
│  1. Fetch forecast data from cache/DB                     │
│  2. Populate ForecastGrid                                 │
│  3. Populate QuickMetricsBar                              │
│  4. Show success toast                                    │
└─────────────────────────────────────────────────────────┘
```

---

# 7. DATABASE SCHEMA DESIGN

## 7.1 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐
│   users      │       │   companies      │
├──────────────┤       ├──────────────────┤
│ id (PK)      │──┐    │ id (PK)          │
│ email        │  │    │ name             │
│ password_hash│  │    │ pan              │
│ name         │  ├───►│ gstin            │
│ phone        │  │    │ industry         │
│ role         │  │    │ fy_start_month   │
│ firm_id (FK) │  │    │ currency         │
│ created_at   │  │    │ number_format    │
│ updated_at   │  │    │ language         │
└──────────────┘  │    │ branding_json    │
                  │    │ subscription_tier│
┌──────────────┐  │    │ created_at       │
│   firms      │  │    └────────┬─────────┘
├──────────────┤  │             │
│ id (PK)      │  │             │
│ name         │  │             │
│ logo_url     │  │             │
│ address      │  │             │
│ subscription │  │             │
│ created_at   │  │             │
└──────┬───────┘  │             │
       │          │             │
       │  ┌───────┘             │
       │  │                     │
       ▼  ▼                     ▼
┌─────────────────────────────────────┐
│       company_users (junction)      │
├─────────────────────────────────────┤
│ user_id (FK) → users               │
│ company_id (FK) → companies        │
│ role (owner/viewer/editor/ca)      │
│ granted_at                         │
└─────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   chart_of_accounts   │
        ├───────────────────────┤
        │ id (PK)               │
        │ company_id (FK)       │
        │ code                  │
        │ name                  │
        │ parent_id (FK, self)  │◄── Tree structure
        │ level (0-4)           │
        │ account_type          │◄── revenue/expense/asset/liability/equity
        │ standard_mapping      │◄── maps to our standard categories
        │ is_group (boolean)    │
        │ sort_order            │
        │ created_at            │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   monthly_actuals     │
        ├───────────────────────┤
        │ id (PK)               │
        │ company_id (FK)       │
        │ account_id (FK)       │
        │ period (date)         │◄── first day of month
        │ amount (numeric)      │◄── stored in PAISE (integer)
        │ amount_debit (numeric)│
        │ amount_credit (numeric)│
        │ is_actual (boolean)   │◄── true = actual, false = budget
        │ source (string)       │◄── 'tally'/'excel'/'manual'
        │ imported_at           │
        └───────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────┐
│                  FORECAST CONFIGURATION                │
├───────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────────┐  ┌─────────────────────────┐    │
│  │  value_rules    │  │  timing_profiles        │    │
│  ├─────────────────┤  ├─────────────────────────┤    │
│  │ id              │  │ id                      │    │
│  │ company_id (FK) │  │ company_id (FK)         │    │
│  │ account_id (FK) │  │ name                    │    │
│  │ scenario_id(FK) │  │ type                    │    │
│  │   NULL=baseline │  │   receivables/payables/ │    │
│  │ rule_type       │  │   deferred/prepaid      │    │
│  │   rolling_avg/  │  │ config_json             │    │
│  │   growth/       │  │   {                     │    │
│  │   smart_pred/   │  │     "month_0": 0.30,    │    │
│  │   same_last_yr/ │  │     "month_1": 0.40,    │    │
│  │   formula/      │  │     "month_2": 0.20,    │    │
│  │   direct_entry/ │  │     "month_3": 0.08,    │    │
│  │   baseline_adj  │  │     "never": 0.02       │    │
│  │ config_json     │  │   }                     │    │
│  │   {             │  │ auto_derived (boolean)  │    │
│  │     "months": 6,│  │ derived_from_actuals   │    │
│  │     "rate": 0.02│  │   (boolean)             │    │
│  │   }             │  │ created_at              │    │
│  │ sort_order      │  └─────────────────────────┘    │
│  │ created_at      │                                  │
│  └─────────────────┘                                  │
│                                                       │
│  ┌─────────────────┐  ┌─────────────────────────┐    │
│  │  drivers        │  │  schedules              │    │
│  ├─────────────────┤  ├─────────────────────────┤    │
│  │ id              │  │ id                      │    │
│  │ company_id (FK) │  │ company_id (FK)         │    │
│  │ name            │  │ type                    │    │
│  │   headcount/    │  │   depreciation/loan/    │    │
│  │   units/        │  │   tax                    │    │
│  │   custom        │  │ linked_account_id (FK)  │    │
│  │ unit            │  │ config_json             │    │
│  │ values_json     │  │   {                     │    │
│  │   {             │  │     "method": "SLM",    │    │
│  │     "Apr": 22,  │  │     "rate": 10,         │    │
│  │     "May": 22,  │  │     "life_years": 10    │    │
│  │     ...         │  │   }                     │    │
│  │   }             │  │ start_date              │    │
│  │ forecast_values │  │ created_at              │    │
│  │   (jsonb)       │  └─────────────────────────┘    │
│  │ created_at      │                                  │
│  └─────────────────┘                                  │
└───────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────┐
│              MICRO-FORECASTS                           │
├───────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐    │
│  │  micro_forecasts                               │    │
│  ├───────────────────────────────────────────────┤    │
│  │ id (PK)                                       │    │
│  │ company_id (FK)                               │    │
│  │ name (string)                                 │    │
│  │ category (string)                             │    │
│  │   hire/asset/loan/revenue/marketing/equity/   │    │
│  │   custom                                      │    │
│  │ is_active (boolean)                           │    │
│  │ start_date (date)                             │    │
│  │ end_date (date, nullable)                     │    │
│  │ wizard_type (string, nullable)                │    │
│  │ wizard_config_json (jsonb)                    │    │
│  │   { "role": "Developer", "ctc": 80000, ... } │    │
│  │ sort_order (int)                              │    │
│  │ created_at                                    │    │
│  │ updated_at                                    │    │
│  └───────────────────┬───────────────────────────┘    │
│                      │                                │
│                      ▼                                │
│  ┌───────────────────────────────────────────────┐    │
│  │  micro_forecast_accounts                      │    │
│  ├───────────────────────────────────────────────┤    │
│  │ id (PK)                                       │    │
│  │ micro_forecast_id (FK)                        │    │
│  │ account_id (FK, nullable)                     │    │
│  │   → null means "future account" not in CoA    │    │
│  │ future_account_name (string, nullable)        │    │
│  │ future_account_type (string, nullable)        │    │
│  │ account_category                              │    │
│  │   pl/bs                                       │    │
│  │ value_rule_type (string)                      │    │
│  │   direct_entry/growth/formula                 │    │
│  │ values_json (jsonb)                           │    │
│  │   { "flat": 80000 }                           │    │
│  │   { "growth_rate": 0.02, "base": 50000 }      │    │
│  │ timing_profile_id (FK, nullable)              │    │
│  │   → can have its own timing profile           │    │
│  │ schedule_id (FK, nullable)                    │    │
│  │   → e.g., new loan amortization schedule      │    │
│  │ sort_order (int)                              │    │
│  └───────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────┐
│              SCENARIOS                                 │
├───────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐    │
│  │  scenarios                                     │    │
│  ├───────────────────────────────────────────────┤    │
│  │ id (PK)                                       │    │
│  │ company_id (FK)                               │    │
│  │ name (string)                                 │    │
│  │   "Pessimistic" / "Optimistic" / etc.         │    │
│  │ parent_scenario_id (FK, nullable)             │    │
│  │   → null means inherits from baseline         │    │
│  │   → non-null means inherits from parent       │    │
│  │ description (text)                            │    │
│  │ is_active (boolean)                           │    │
│  │ created_at                                    │    │
│  └───────────────────┬───────────────────────────┘    │
│                      │                                │
│                      ▼                                │
│  ┌───────────────────────────────────────────────┐    │
│  │  scenario_overrides                           │    │
│  │  (stores only the DIFFS from parent)          │    │
│  ├───────────────────────────────────────────────┤    │
│  │ id (PK)                                       │    │
│  │ scenario_id (FK)                              │    │
│  │ target_type                                   │    │
│  │   value_rule / timing_profile / driver /      │    │
│  │   micro_forecast_toggle                       │    │
│  │ target_id (nullable)                          │    │
│  │   → value_rule.id / timing_profile.id / etc.  │    │
│  │ override_type                                 │    │
│  │   replace / adjust / toggle                   │    │
│  │ override_config_json (jsonb)                  │    │
│  │   For value_rule: { "rule_type": "baseline_adj│    │
│  │     "adjustment_percent": -15 }               │    │
│  │   For timing_profile: { new percentages... }  │    │
│  │   For micro_toggle: { "is_active": false }    │    │
│  └───────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────┐
│              FORECAST RESULTS (Computed)               │
├───────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐    │
│  │  forecast_snapshots (stored computation)       │    │
│  ├───────────────────────────────────────────────┤    │
│  │ id (PK)                                       │    │
│  │ company_id (FK)                               │    │
│  │ scenario_id (FK, nullable)                    │    │
│  │   → null = baseline                           │    │
│  │ snapshot_type                                 │    │
│  │   auto / manual                               │    │
│  │ period_start (date)                           │    │
│  │ period_end (date)                             │    │
│  │ pl_data (jsonb)                               │    │
│  │   { account_id: { "2025-04": 1234567, ... }} │    │
│  │ bs_data (jsonb)                               │    │
│  │ cf_data (jsonb)                               │    │
│  │ compliance_data (jsonb)                        │    │
│  │   { gst: {...}, tds: {...}, advance_tax: {...}}│    │
│  │ quick_metrics (jsonb)                          │    │
│  │   { cash_on_hand: {...}, net_income: {...} }  │    │
│  │ version (int)                                 │    │
│  │ created_at                                    │    │
│  │   INDEX: (company_id, scenario_id, created_at)│    │
│  └───────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────┐
│              COMPLIANCE CONFIGURATION                  │
├───────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐    │
│  │  gst_config                                   │    │
│  ├───────────────────────────────────────────────┤    │
│  │ id (PK)                                       │    │
│  │ company_id (FK)                               │    │
│  │ registration_type (regular/qrmp)              │    │
│  │ default_output_rate (numeric)                 │    │
│  │ itc_percentage (numeric, 0-100)               │    │
│  │   → % of input GST claimed as credit          │    │
│  │ payment_frequency (monthly/quarterly)          │    │
│  │ supply_type_defaults (jsonb)                  │    │
│  │   { "intra_state": "cgst+sgst",              │    │
│  │     "inter_state": "igst" }                   │    │
│  └───────────────────────────────────────────────┘    │
│                                                       │
│  ┌───────────────────────────────────────────────┐    │
│  │  tds_config                                   │    │
│  ├───────────────────────────────────────────────┤    │
│  │ id (PK)                                       │    │
│  │ company_id (FK)                               │    │
│  │ salary_regime (old/new)                       │    │
│  │ tds_sections (jsonb)                          │    │
│  │   { "192": { "rate": 0, "threshold": 250000 },│    │
│  │     "194C": { "rate": 0.01, "threshold":... },│    │
│  │     "194I": { "rate": 0.10, ... }             │    │
│  │   }                                           │    │
│  │ payment_frequency (monthly/quarterly)          │    │
│  └───────────────────────────────────────────────┘    │
│                                                       │
│  ┌───────────────────────────────────────────────┐    │
│  │  advance_tax_config                           │    │
│  ├───────────────────────────────────────────────┤    │
│  │ id (PK)                                       │    │
│  │ company_id (FK)                               │    │
│  │ tax_regime (old/new)                          │    │
│  │ effective_tax_rate (numeric)                  │    │
│  │ installment_schedule (jsonb)                  │    │
│  │   [                                           │    │
│  │     { "due_date": "Jun 15", "pct": 15 },      │    │
│  │     { "due_date": "Sep 15", "pct": 45 },      │    │
│  │     { "due_date": "Dec 15", "pct": 75 },      │    │
│  │     { "due_date": "Mar 15", "pct": 100 }      │    │
│  │   ]                                           │    │
│  │ interest_section (string)                      │    │
│  │   "234C" / "234C+234D"                        │    │
│  └───────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────┘
```

## 7.2 Critical Design Decisions in Schema

### Decision 1: Amounts stored in PAISE (integer, not float)

```sql
-- WRONG: Floating point errors
amount NUMERIC(15,2)  -- 1234567.89 → stored as float, can have precision issues

-- CORRECT: Store in smallest unit (paise)
amount BIGINT           -- 123456789 → always exact, no floating point issues
-- Display layer converts: 123456789 / 100 = ₹12,34,567.89
```

### Decision 2: Forecast results stored as JSONB, not normalized rows

```
WHY JSONB for forecast_snapshots.pl_data:
  - A single forecast has: ~50 accounts × 12 months = 600 values
  - Reading forecast = 1 JSONB read vs 600 row reads
  - Writing forecast = 1 JSONB write vs 600 row inserts
  - No joins needed to render the grid
  - JSONB supports indexing for specific account lookups
  - PostgreSQL JSONB is battle-tested for this pattern

WHY NOT JSONB:
  - If you need to query "show me all companies where revenue > ₹1Cr"
  - → historical monthly_actuals ARE normalized (separate rows per account/month)
  - → forecast results are NOT queried individually (always read as full set)
```

### Decision 3: Scenario overrides stored as DELTA, not full copy

```
SCENARIO "Pessimistic" doesn't store:
  - All 50 value rules (most are inherited unchanged)
  - All timing profiles (only AR timing changed)
  - All driver values (only headcount adjusted)

It stores ONLY:
  - { target: "value_rule", account: "revenue", 
      override: { type: "baseline_adjustment", percent: -15 } }
  - { target: "timing_profile", name: "receivables",
      override: { month_0: 0.20, month_1: 0.30, ... } }
  - { target: "micro_forecast_toggle", id: "equity-raise-uuid",
      override: { is_active: false } }

This means:
  - Baseline changes automatically flow to scenarios
  - Scenario creation is fast (just store a few deltas)
  - Scenario inheritance chain works (A inherits from B inherits from baseline)
```

### Decision 4: Row-Level Security for multi-tenancy

```sql
-- PostgreSQL RLS ensures data isolation without application-level checks
ALTER TABLE monthly_actuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_isolation ON monthly_actuals
  USING (company_id = current_setting('app.company_id')::uuid);

-- Every request sets the context:
SET LOCAL app.company_id = 'uuid-of-accessed-company';

-- Even if a bug in application code forgets to check access,
-- PostgreSQL will never return another company's data
```

---

# 8. THE FORECAST ENGINE (COMPLETE LOGIC)

## 8.1 Engine Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ENGINE PIPELINE                           │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ HISTORICAL│───►│BASELINE  │───►│THREE-WAY │              │
│  │ DATA     │    │ GENERATOR│    │INTEGRATOR │              │
│  │ (input)  │    │          │    │           │              │
│  └──────────┘    └──────────┘    └─────┬─────┘              │
│                                       │                      │
│  ┌──────────┐    ┌──────────┐         │                      │
│  │VALUE RULES│───►│          │         │                      │
│  │TIMING    │───►│          │         │                      │
│  │PROFILES  │    │          │         │                      │
│  │DRIVERS   │───►│          │         │                      │
│  │SCHEDULES │───►│          │         │                      │
│  └──────────┘    └──────────┘         │                      │
│                                       ▼                      │
│                              ┌──────────────┐              │
│                              │ BASELINE     │              │
│                              │ FORECAST     │              │
│                              │ (P&L+BS+CF)  │              │
│                              └──────┬───────┘              │
│                                     │                       │
│  ┌──────────┐    ┌──────────┐       │                       │
│  │MICRO-    │───►│MICRO-FC  │       │                       │
│  │FORECASTS │    │ENGINE    │───────┤                       │
│  │(events)  │    │          │       │                       │
│  └──────────┘    └──────────┘       │                       │
│                                     ▼                       │
│                              ┌──────────────┐              │
│                              │ COMBINED     │              │
│                              │ FORECAST     │              │
│                              └──────┬───────┘              │
│                                     │                       │
│  ┌──────────┐    ┌──────────┐       │                       │
│  │SCENARIO  │───►│SCENARIO  │───────┤                       │
│  │OVERRIDES │    │ENGINE    │       │                       │
│  └──────────┘    └──────────┘       │                       │
│                                     ▼                       │
│                              ┌──────────────┐              │
│                              │ FINAL        │              │
│                              │ FORECAST     │              │
│                              │ (P&L+BS+CF+  │              │
│                              │  COMPLIANCE) │              │
│                              └──────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## 8.2 Value Rules — Complete Logic

### Rule 1: Rolling Average

```
INPUT: 
  - lookback_months: N (default 6)
  - historical_values: [M1, M2, ..., M12] (last N actuals)

LOGIC:
  For each forecast month F1, F2, ..., F12:
    forecast[F] = average of last N values (actual or previously forecasted)
    
  Example: lookback = 3, historical = [100, 110, 105, 115, 120, 125]
    F1 = avg(105, 115, 120) = 113.3    (last 3 actuals)
    F2 = avg(115, 120, 125) = 120      (last 3 actuals)  
    F3 = avg(120, 125, 113.3) = 119.4  (mix of actual + forecast)
    F4 = avg(125, 113.3, 120) = 119.4
    ...converges toward a stable value

USE CASE: 
  - Utility bills (relatively stable with slight variation)
  - Office supplies
  - Routine maintenance
```

### Rule 2: Smart Prediction (Trend + Seasonality)

```
INPUT:
  - historical_values: 12+ months of actuals
  - seasonality_period: 12 (monthly data)

LOGIC (simplified):
  Step 1: Calculate trend using linear regression
    y = mx + c  (fit line through historical data)
    m = slope (monthly growth rate)
    
  Step 2: Calculate seasonal indices
    For each month (Jan-Dec):
      actual[month] / trend[month] = seasonal_index[month]
    Average across available years
    
  Step 3: Project
    For each forecast month F:
      base = m × F + c  (trend value)
      seasonal_multiplier = seasonal_index[month_of_F]
      forecast[F] = base × seasonal_multiplier

Example:
  Historical revenue (₹ Lakhs):
    Apr: 45  May: 48  Jun: 52  Jul: 58  Aug: 62  Sep: 55
    Oct: 70  Nov: 85  Dec: 95  Jan: 42  Feb: 44  Mar: 50
    
  Trend: growing at ₹1.5L/month
  Seasonal indices: Oct=1.3, Nov=1.5, Dec=1.6 (Diwali/festive)
                   Jan=0.75, Feb=0.75 (post-festive dip)
  
  Forecast Oct 2025: trend_value × 1.3 = ₹78L
  Forecast Nov 2025: trend_value × 1.5 = ₹92L
  Forecast Jan 2026: trend_value × 0.75 = ₹47L

USE CASE:
  - Revenue with strong seasonality (textiles, agriculture-linked, FMCG)
  - Any business with festival-driven demand

IMPLEMENTATION NOTE:
  For MVP: Use simple linear regression + ratio-based seasonality
  For Phase 2: Use Holt-Winters exponential smoothing (handles trend + seasonality + damping)
```

### Rule 3: Growth from Previous Period

```
INPUT:
  - growth_type: 'percentage' | 'fixed_amount'
  - growth_value: 0.02 (2%) | 5000 (₹5K)
  - base_period: 'last_actual' | 'last_forecast' | 'specific_month'
  - cap (optional): max value ceiling
  - floor (optional): min value floor

LOGIC:
  If percentage:
    forecast[F] = forecast[F-1] × (1 + growth_value)
    If cap: forecast[F] = min(forecast[F], cap)
    If floor: forecast[F] = max(forecast[F], floor)
    
  If fixed_amount:
    forecast[F] = forecast[F-1] + growth_value

Example (percentage, 2% growth):
  Last actual: ₹100L
  F1: ₹102L
  F2: ₹104.04L
  F3: ₹106.12L
  F12: ₹126.82L (compound effect)

USE CASE:
  - Revenue with expected steady growth
  - Subscription MRR growth
  - Salary costs (annual increments)
```

### Rule 4: Same as Last Year

```
INPUT:
  - offset: 0 (same month last year) | 1 (month after) | etc.
  - adjustment_percent: 0 (default, no adjustment)

LOGIC:
  forecast[F_current_year_month] = actual[F_last_year_month] × (1 + adjustment_percent)

Example:
  Forecast Apr 2025 = Actual Apr 2024 × 1.05 (if 5% adjustment)
  Forecast May 2025 = Actual May 2024 × 1.05
  ...

USE CASE:
  - Businesses with stable year-over-year patterns
  - Starting point that gets refined with micro-forecasts
  - Seasonal businesses where last year is best predictor
```

### Rule 5: Link to Previous Period (Carry Forward)

```
INPUT:
  - source_account_id: the account to mirror
  - adjustment_type: 'none' | 'percent' | 'fixed'
  - adjustment_value: 0

LOGIC:
  forecast[F, this_account] = forecast[F, source_account] × (1 + adjustment_value)

USE CASE:
  - "Bad debts provision" = 2% of "Revenue" (same period)
  - "Commission expense" = 5% of "Sales" (same period)
  - "Provision for warranty" = 1.5% of "Revenue"
```

### Rule 6: Formula

```
INPUT:
  - expression: string with account references and math operators
  - Variables: {account_name}, {driver_name}, {constant}

LOGIC:
  Parse expression → evaluate with substituted values per period

Example formulas:
  "Revenue - Cost_of_Sales"                              → Gross Profit
  "{headcount} × {avg_salary}"                           → Total Salary Cost
  "Revenue × 0.18 - Purchases × 0.18 × {itc_pct}"      → Net GST Payable
  "(Fixed_Assets × 0.10) / 12"                           → Monthly Depreciation (WDV approx)
  "MAX(0, PBT × 0.25 - Advance_Tax_Paid_YTD)"           → Current Month Advance Tax

IMPLEMENTATION:
  - Use a safe expression parser (mathjs or expr-eval)
  - Whitelist only mathematical operations (no function calls, no file access)
  - Resolve account references to their forecast values
  - Resolve driver references to their forecast values
  - Cache parsed AST for performance

USE CASE:
  - Complex inter-account relationships
  - GST calculation
  - Custom KPI-derived expenses
```

### Rule 7: Direct Entry

```
INPUT:
  - values: { "2025-04": 500000, "2025-05": 500000, "2025-06": 600000, ... }
  - OR: flat_value: 500000 (same for all months)

LOGIC:
  forecast[F] = values[F] or flat_value

CREATED WHEN:
  - User clicks a forecast cell and types a value
  - This overrides whatever value rule was previously set
  - The system stores it as a Direct Entry rule for that account

USE CASE:
  - Known fixed costs (rent, insurance premium)
  - User overrides specific months
  - One-time adjustments
```

### Rule 8: Baseline Adjustment (Scenario-only)

```
INPUT:
  - adjustment_type: 'percentage' | 'fixed_amount'
  - adjustment_value: -15 (meaning -15%) or -50000

LOGIC:
  For each forecast month F:
    baseline_value = value calculated by baseline rule
    forecast[F] = baseline_value × (1 + adjustment_value/100)  // if percentage
    forecast[F] = baseline_value + adjustment_value            // if fixed

CRITICAL: This rule ONLY exists in scenarios, never in baseline
  It reads the baseline's computed value and adjusts it
  It doesn't know or care WHAT the baseline rule is

USE CASE:
  - "Reduce all marketing expenses by 10%" → one override, affects all months
  - "Increase COGS by ₹50K/month across the board"
  - "Reduce revenue by 15%" (pessimistic scenario)
```

## 8.3 Timing Profiles — Complete Logic

### Profile 1: Receivables (Revenue → Cash In)

```
PURPOSE: Model when revenue booked in P&L actually becomes cash in bank

INPUT:
  profile: { month_0: 0.30, month_1: 0.40, month_2: 0.20, month_3: 0.08, never: 0.02 }
  // month_0 = same month as revenue, month_1 = next month, etc.
  // Percentages must sum to 1.0 (or less if "never" > 0)

LOGIC PER FORECAST MONTH:
  Given Revenue[F] = ₹100L

  Cash received in month F:     ₹100L × 0.30 = ₹30L  (30% same month)
  Cash received in month F+1:   ₹100L × 0.40 = ₹40L  (40% next month)
  Cash received in month F+2:   ₹100L × 0.20 = ₹20L  (20% month after)
  Cash received in month F+3:   ₹100L × 0.08 = ₹8L   (8% third month)
  Never collected (bad debt):   ₹100L × 0.02 = ₹2L   (P&L provision)

BALANCE SHEET IMPACT:
  Receivables at end of month F:
    = Revenue[F] × (month_1 + month_2 + month_3)  // uncollected portions
    = ₹100L × (0.40 + 0.20 + 0.08) = ₹68L
    
  Receivables at end of month F+1:
    = (Revenue[F] × (month_2 + month_3)) + (Revenue[F+1] × (month_1 + month_2 + month_3))
    = (₹100L × 0.28) + (Revenue[F+1] × 0.68)

CASH FLOW IMPACT (in CF statement, Operating Activities):
  Change in Receivables = Receivables[F] - Receivables[F-1]
  If Receivables increased → cash outflow (negative in CF)
  If Receivables decreased → cash inflow (positive in CF)

AUTO-DERIVATION FROM HISTORICAL DATA:
  For each historical month M:
    ratio[M] = AccountsReceivable_end[M] / Revenue[M]
  
  If pattern is: [0.68, 0.65, 0.70, 0.72, 0.68, ...]
  → Suggest timing profile: month_1=0.40, month_2=0.20, month_3=0.08 (residual)
  
  More sophisticated: Use matrix inversion on AR/revenue history
  to solve for the collection percentages that best fit the data.
```

### Profile 2: Payables (Expense → Cash Out)

```
PURPOSE: Model when expenses booked in P&L actually leave as cash from bank

INPUT:
  profile: { month_0: 0.00, month_1: 0.60, month_2: 0.30, month_3: 0.10 }

LOGIC: Mirror of Receivables but for cash OUT

  Given COGS[F] = ₹62L (raw material purchases)

  Cash paid in month F:     ₹62L × 0.00 = ₹0    (no advance to suppliers)
  Cash paid in month F+1:   ₹62L × 0.60 = ₹37.2L (60% paid next month)
  Cash paid in month F+2:   ₹62L × 0.30 = ₹18.6L (30% in second month)
  Cash paid in month F+3:   ₹62L × 0.10 = ₹6.2L  (10% stretched)

BALANCE SHEET:
  Payables at end of month F = ₹62L × (0.60 + 0.30 + 0.10) = ₹62L
  (100% of this month's purchases are unpaid at month-end)

CASH FLOW:
  Change in Payables = Payables[F] - Payables[F-1]
  If Payables increased → cash conserved (positive in CF — less cash went out)
  If Payables decreased → cash used (negative in CF)
```

### Profile 3: Deferred Revenue (Cash In → Revenue Later)

```
PURPOSE: Cash received BEFORE revenue is recognized

USE CASE: Annual subscription paid upfront, software licenses, maintenance contracts

INPUT:
  profile: { recognition_months: 12, cash_timing: "advance" }

LOGIC:
  Client pays ₹12L on Apr 1 for annual subscription
  
  Cash Flow (Apr): +₹12L
  P&L Revenue (Apr-Dec): ₹1L/month × 9 months = ₹9L
  P&L Revenue (Jan-Mar next FY): ₹1L/month × 3 months = ₹3L
  
  Balance Sheet (end Apr):
    Deferred Revenue Liability: ₹12L - ₹1L = ₹11L
  Balance Sheet (end May):
    Deferred Revenue: ₹10L
  ...reduces by ₹1L/month until ₹0
```

### Profile 4: Prepaid Expenses (Cash Out → Expense Later)

```
PURPOSE: Cash paid BEFORE expense is recognized

USE CASE: Annual insurance, rent deposit, annual software subscription

INPUT:
  profile: { recognition_months: 12, cash_timing: "advance" }

LOGIC:
  Insurance premium ₹2.4L paid in January
  
  Cash Flow (Jan): -₹2.4L
  P&L Expense: ₹20K/month × 12 months
  Balance Sheet (end Jan): Prepaid Asset: ₹2.2L
  ...reduces by ₹20K/month
```

## 8.4 Three-Way Integration — The Balancing Act

This is the hardest part of the engine. Here's the exact algorithm:

```
FUNCTION generateThreeWayForecast(historicalPL, historicalBS, baselinePL):
  
  // STEP 1: We already have projected P&L from value rules
  projectedPL = baselinePL  // 12 months, each account has values
  
  // STEP 2: Build projected Balance Sheet month by month
  openingBS = historicalBS[lastMonth]  // starting point
  
  FOR each forecastMonth F from 1 to 12:
    
    // 2a: Calculate P&L-driven BS changes
    netIncome = projectedPL.netIncome[F]
    
    retainedEarnings = openingBS.retainedEarnings + netIncome
    
    // 2b: Calculate working capital from timing profiles
    revenue = projectedPL.totalRevenue[F]
    cogs = projectedPL.totalCOGS[F]
    totalExpenses = projectedPL.totalExpenses[F]  // excluding non-cash
    
    receivables = calculateReceivables(revenue, arTimingProfile, F)
    payables = calculatePayables(cogs + applicableExpenses, apTimingProfile, F)
    inventory = calculateInventory(cogs, dioProfile, F)
    
    // 2c: Calculate non-current items from schedules
    fixedAssets = openingBS.fixedAssets 
                    + assetAdditions[F]        // from schedules/micro-FCs
                    - assetDisposals[F]
    
    depreciation = depreciationSchedule[F]       // from schedule
    accumulatedDepreciation = openingBS.accumDep + depreciation
    
    // 2d: Calculate financing from schedules
    loans = openingBS.loans 
            + newBorrowings[F]                   // from schedules/micro-FCs
            - principalRepayments[F]             // from loan amortization
    
    // 2e: Handle deferred revenue and prepaids (if applicable)
    deferredRevenue = calculateDeferredRevenue(defRevProfile, F)
    prepaidExpenses = calculatePrepaidExpenses(prepaidProfile, F)
    
    // 2f: CALCULATE CASH AS PLUG
    // Cash = Total Assets - Non-Cash Assets
    // But we need to ensure A = L + E
    
    totalAssets = cash + receivables + inventory + prepaidExpenses 
                  + fixedAssets - accumulatedDepreciation + otherAssets
    
    totalLiabilities = payables + shortTermDebt + loans + taxPayable 
                       + otherLiabilities + deferredRevenue
    
    totalEquity = shareCapital + retainedEarnings + otherEquity
    
    // BALANCE CHECK:
    // If totalAssets ≠ totalLiabilities + totalEquity:
    //   cash = (totalLiabilities + totalEquity) - (totalAssets - cash)
    //   This is the PLUG — cash absorbs any imbalance
    
    cash = (totalLiabilities + totalEquity) 
           - (receivables + inventory + prepaidExpenses 
              + fixedAssets - accumulatedDepreciation + otherAssets)
    
    // IF cash is negative → WARNING: business is projected to run out of cash
    // This is a valid projection (it means they need to borrow more)
    
    closingBS = { cash, receivables, inventory, ..., loans, ..., retainedEarnings }
    
    // STEP 3: Generate Cash Flow (Indirect Method) for this month
    operatingCF = netIncome 
                  + depreciation                     // add back non-cash
                  + otherNonCashAdjustments
                  - (receivables - openingBS.receivables)  // Δ AR
                  - (inventory - openingBS.inventory)      // Δ Inv
                  + (payables - openingBS.payables)        // Δ AP
                  + (otherCL - openingBS.otherCL)          // Δ Other CL
                  - (otherCA - openingBS.otherCA)          // Δ Other CA
    
    investingCF = -assetAdditions + assetDisposalProceeds
    
    financingCF = +newBorrowings - principalRepayments 
                  - dividendPayments + equityRaised
    
    netCashFlow = operatingCF + investingCF + financingCF
    
    // CROSS-CHECK:
    // closingCash should equal openingCash + netCashFlow
    // If not, there's a rounding/timing error → iterate to converge
    
    VERIFY(Math.abs(closingBS.cash - (openingBS.cash + netCashFlow)) < 1)  // within ₹1
    
    // Store this month's results
    projectedBS[F] = closingBS
    projectedCF[F] = { operatingCF, investingCF, financingCF, netCashFlow }
    
    // Set up next iteration
    openingBS = closingBS
  
  RETURN { projectedPL, projectedBS, projectedCF }
```

## 8.5 Micro-Forecast Overlay — The Layering Logic

```
FUNCTION applyMicroForecasts(baselineForecast, activeMicroForecasts):
  
  combinedPL = deepCopy(baselineForecast.PL)
  combinedBS = deepCopy(baselineForecast.BS)
  combinedCF = deepCopy(baselineForecast.CF)
  
  FOR each microForecast in activeMicroForecasts:
    
    // Each micro-forecast is a self-contained mini three-way model
    microPL = generateMicroPL(microForecast)     // uses its own value rules
    microBS = generateMicroBS(microForecast)     // uses its own timing profiles
    microCF = generateMicroCF(microForecast)     // derived from microPL + microBS
    
    // Overlay: ADD micro values to combined values
    FOR each month F:
      FOR each account in microPL:
        combinedPL[F][account] += microPL[F][account]
      
      FOR each account in microBS:
        combinedBS[F][account] += microBS[F][account]
      
      // Cash flow categories:
      combinedCF[F].operatingCF += microCF[F].operatingCF
      combinedCF[F].investingCF += microCF[F].investingCF
      combinedCF[F].financingCF += microCF[F].financingCF
      combinedCF[F].netCashFlow += microCF[F].netCashFlow
  
  // CRITICAL: After overlay, re-balance the three statements
  // Because: baseline cash was calculated as a plug
  // Adding micro-forecast impacts may unbalance
  
  combinedForecast = rebalanceThreeWay(combinedPL, combinedBS, combinedCF)
  
  RETURN combinedForecast

FUNCTION generateMicroPL(microForecast):
  // Same value rule engine as baseline, but only for this micro-forecast's accounts
  // E.g., "New Hire" micro-forecast has:
  //   Salaries: ₹80K/month (direct entry, starting from start_date)
  //   PF Expense: ₹4.8K/month
  //   ESI Expense: ₹2.6K/month
  //   Revenue contribution: ₹0/month (or user-specified)
  
  pl = empty12MonthMatrix()
  
  FOR each account in microForecast.accounts:
    FOR each month F:
      IF F < microForecast.startMonth OR F > microForecast.endMonth:
        pl[F][account] = 0  // outside event period
      ELSE:
        pl[F][account] = evaluateValueRule(account.rule, F)
  
  RETURN pl
```

## 8.6 Scenario Engine — Inheritance & Override

```
FUNCTION generateScenarioForecast(scenario, baselineForecast):
  
  // STEP 1: Resolve inheritance chain
  // If scenario.parentId = null → inherit from baseline
  // If scenario.parentId = "optimistic" → inherit from "optimistic" scenario
  
  parentForecast = scenario.parentId 
    ? getForecast(scenario.parentId) 
    : baselineForecast
  
  // STEP 2: Apply overrides
  scenarioForecast = deepCopy(parentForecast)
  
  FOR each override in scenario.overrides:
    
    SWITCH override.targetType:
      
      CASE 'value_rule':
        // Replace the value rule for a specific account
        // Then re-calculate that account's forecast values
        newRule = parseOverrideConfig(override.config)
        scenarioForecast.PL[override.accountId] = 
          evaluateRule(newRule, 12, parentForecast.PL)
        
        // Re-calculate subtotals (GP, OP, NP) since an account changed
        scenarioForecast.PL = recalculateSubtotals(scenarioForecast.PL)
        
        // CRITICAL: Re-run three-way integration because P&L changed
        scenarioForecast = rebalanceThreeWay(
          scenarioForecast.PL, scenarioForecast.BS, scenarioForecast.CF
        )
      
      CASE 'timing_profile':
        // Replace a timing profile (e.g., slower collection)
        newProfile = parseOverrideConfig(override.config)
        scenarioForecast = regenerateWithNewTimingProfile(
          scenarioForecast, override.profileName, newProfile
        )
      
      CASE 'driver':
        // Change a driver value (e.g., headcount from 22 to 18)
        newDriverValues = parseOverrideConfig(override.config)
        // Re-evaluate all accounts that reference this driver
        scenarioForecast = reevaluateDriverDependencies(
          scenarioForecast, override.driverName, newDriverValues
        )
      
      CASE 'micro_forecast_toggle':
        // Toggle a micro-forecast on/off
        IF override.config.is_active == false:
          // Remove this micro-forecast's contribution
          scenarioForecast = removeMicroForecastContribution(
            scenarioForecast, override.microForecastId
          )
  
  RETURN scenarioForecast

// BASELINE ADJUSTMENT — the most used scenario override
FUNCTION applyBaselineAdjustment(parentForecastPL, accountId, adjustmentPercent):
  
  adjustedPL = deepCopy(parentForecastPL)
  
  FOR each month F:
    adjustedPL[F][accountId] = parentForecastPL[F][accountId] 
                               × (1 + adjustmentPercent / 100)
  
  RETURN adjustedPL
  // Note: This changes one account, but subtotals and three-way balance
  // must be recalculated by the caller
```

---

# 9. INDIA-SPECIFIC ENGINES

## 9.1 GST Engine

```
FUNCTION calculateGSTForecast(projectedPL, gstConfig):
  
  gstForecast = empty12MonthMatrix() // per month
  
  FOR each month F:
    
    // OUTPUT GST (collected on sales)
    totalRevenue = projectedPL[F].revenue  // ONLY GST-able revenue
    outputGST = totalRevenue × gstConfig.default_output_rate
    
    // SPLIT by supply type (if intra-state vs inter-state data available)
    IF hasIntraInterSplit:
      cgst = intraStateRevenue × gstConfig.default_output_rate / 2
      sgst = intraStateRevenue × gstConfig.default_output_rate / 2
      igst = interStateRevenue × gstConfig.default_output_rate
    ELSE:
      // Assume all intra-state (most common for SMEs)
      cgst = outputGST / 2
      sgst = outputGST / 2
      igst = 0
    
    // INPUT GST (paid on purchases)
    totalPurchases = projectedPL[F].cogs  // ONLY GST-able purchases
    // Some purchases may not have GST (exempt, petroleum, etc.)
    gstEligiblePurchases = totalPurchases × gstConfig.itc_percentage / 100
    inputGST = gstEligiblePurchases × gstConfig.default_output_rate
    
    inputCGST = inputGST / 2
    inputSGST = inputGST / 2
    inputIGST = 0
    
    // NET GST PAYABLE
    netCGST = cgst - inputCGST
    netSGST = sgst - inputSGST
    netIGST = igst - inputIGST
    
    // ITC cross-utilization rules (simplified):
    // If netIGST > 0: can be used for CGST or SGST first
    // For MVP: simplified — net payable = max(0, output - input)
    
    netGSTPayable = max(0, outputGST - inputGST)
    
    // PAYMENT TIMING
    IF gstConfig.payment_frequency == 'monthly':
      dueDate = lastDayOfMonth(F) + 20 days  // 20th of next month
    ELSE: // QRMP
      quarter = getQuarter(F)
      dueDates = [Apr 13, Jul 22, Oct 24, Dec 24]  // QRMP dates
      dueDate = dueDates[quarter]
    
    // CASH FLOW IMPACT
    // GST is NOT in P&L (it's a balance sheet item)
    // Cash outflow happens on due date
    gstForecast[F] = {
      outputGST, inputGST, netGSTPayable,
      cgst, sgst, igst,
      inputCGST, inputSGST,
      dueDate,
      cashOutflow: netGSTPayable,  // added to CF financing activities
      balanceSheetImpact: {
        gstReceivable: max(0, inputGST - outputGST),  // if ITC > output
        gstPayable: netGSTPayable                       // liability until paid
      }
    }
  
  RETURN gstForecast

// WHERE DOES GST APPEAR IN THREE STATEMENTS?
// P&L: NOWHERE (GST is not an expense, it's collected on behalf of government)
// BS:  GST Receivable (asset) or GST Payable (liability) 
// CF:  In Operating Activities as "Change in GST Payable/Receivable"
//     Or shown separately as compliance line item
```

## 9.2 TDS Engine

```
FUNCTION calculateTDSForecast(microForecasts, salaryAccounts, tdsConfig):
  
  tdsForecast = empty12MonthMatrix()
  
  // TDS ON SALARIES (Section 192)
  FOR each month F:
    totalSalary = sum(salaryAccounts.map(a => projectedPL[F][a]))
    
    // Annualize for tax calculation
    annualSalary = totalSalary × 12
    
    // Calculate annual tax liability based on regime
    annualTax = calculateIncomeTax(annualSalary, tdsConfig.salary_regime)
    
    // Monthly TDS = annualTax / 12
    monthlyTDS = annualTax / 12
    
    // Employer's PF contribution (Section 192A — not TDS but related)
    employerPF = totalSalary × 0.12  // assuming basic = 50% of CTC
    
    tdsForecast[F].salaryTDS = monthlyTDS
    tdsForecast[F].dueDate = 7th of next month
    tdsForecast[F].cashOutflow = monthlyTDS
  
  // TDS ON CONTRACTORS (Section 194C)
  FOR each microForecast of type 'contractor':
    contractorPayment = microForecast.monthlyAmount
    tdsRate = tdsConfig.sections['194C'].rate  // 1% or 2%
    threshold = tdsConfig.sections['194C'].threshold  // ₹30,000/₹1L
    
    IF annualContractorPayment > threshold:
      monthlyTDS = contractorPayment × tdsRate
      tdsForecast[F].contractorTDS += monthlyTDS
  
  // TDS ON RENT (Section 194I)
  // Similar logic with 10% rate for plant/machinery, 5% for land/building
  
  // TOTAL TDS per month
  FOR each month F:
    tdsForecast[F].totalTDS = tdsForecast[F].salaryTDS 
                              + tdsForecast[F].contractorTDS
                              + tdsForecast[F].rentTDS
  
  RETURN tdsForecast

// WHERE DOES TDS APPEAR?
// P&L: Salary is shown GROSS (before TDS). TDS is not an expense.
//     If salary = ₹80K and TDS = ₹2K:
//       P&L shows salary expense: ₹80K
//       Cash actually paid to employee: ₹78K
//       ₹2K is deposited with government (on behalf of employee)
// BS: TDS Receivable (asset) — until you claim it against your own tax liability
// CF: In Operating Activities: "TDS Deposited with Government" as cash outflow
```

## 9.3 Advance Tax Engine

```
FUNCTION calculateAdvanceTaxForecast(projectedPL, advanceTaxConfig):
  
  advanceTaxForecast = {}
  
  // Step 1: Project PBT for the full year
  projectedPBT = sum(projectedPL.map(m => m.profitBeforeTax))
  
  // Step 2: Estimate total tax liability
  estimatedTax = projectedPBT × advanceTaxConfig.effective_tax_rate
  
  // Step 3: Calculate quarterly installments
  installments = advanceTaxConfig.installment_schedule
  // Default for non-corporate: 15%, 45%, 75%, 100%
  // Default for corporate: 15%, 45%, 75%, 100%
  
  cumulativeTaxPaid = 0
  
  FOR each installment in installments:
    requiredCumulative = estimatedTax × installment.pct / 100
    thisInstallment = requiredCumulative - cumulativeTaxPaid
    cumulativeTaxPaid = requiredCumulative
    
    advanceTaxForecast[installment.due_date] = {
      installmentNumber: index,
      dueDate: installment.due_date,
      requiredCumulative,
      thisInstallment,
      cumulativePaidSoFar: cumulativeTaxPaid,
    }
  
  // Step 4: Check for interest under Section 234C
  // If actual advance tax paid < required at each installment date → interest
  // For MVP: simplified — compare projected vs required
  
  RETURN advanceTaxForecast

// WHERE DOES ADVANCE TAX APPEAR?
// P&L: Tax Expense = total estimated tax for the year
//     (spread monthly or recognized quarterly)
// BS: Advance Tax Paid (asset) — it's a prepayment of your tax liability
//     Tax Payable (liability) — remaining tax not yet paid
// CF: In Operating Activities: "Advance Tax Paid" as cash outflow on due dates
```

## 9.4 PF/ESI Engine

```
FUNCTION calculatePFESIForecast(salaryMicroForecasts):
  
  pfESIForecast = empty12MonthMatrix()
  
  FOR each salaryMicroForecast:
    FOR each active month F:
      ctc = salaryMicroForecast.monthlyCTC
      basic = ctc × 0.50  // standard assumption, configurable
      
      // PF (applicable if basic > ₹15,000 or if employee opts in)
      IF salaryMicroForecast.pfApplicable:
        employerPF = basic × 0.12
        employeePF = basic × 0.12
        totalPF = employerPF + employeePF
        
        pfESIForecast[F].employerPF += employerPF  // P&L expense
        pfESIForecast[F].employeePF += employeePF  // not P&L expense (deducted from salary)
        pfESIForecast[F].totalPFDeposit += totalPF // cash outflow
        pfESIForecast[F].pfPayable += totalPF      // BS liability (until deposited)
      
      // ESI (applicable if gross salary ≤ ₹21,000)
      IF salaryMicroForecast.esiApplicable:
        employerESI = ctc × 0.0325
        employeeESI = ctc × 0.0075
        totalESI = employerESI + employeeESI
        
        pfESIForecast[F].employerESI += employerESI
        pfESIForecast[F].employeeESI += employeeESI
        pfESIForecast[F].totalESIDeposit += totalESI
        pfESIForecast[F].esiPayable += totalESI
      
      // PAYMENT TIMING
      pfESIForecast[F].dueDate = 15th of next month
  
  RETURN pfESIForecast

// WHERE DOES PF/ESI APPEAR?
// P&L: Employer PF (₹4,800) and Employer ESI (₹2,600) are EXPENSES
//     Employee PF (₹4,800) and Employee ESI (₹600) are NOT expenses
//     They're part of CTC but deducted from employee's gross pay
//     P&L shows total salary cost INCLUDING employer's share
// BS: PF Payable and ESI Payable are LIABILITIES until deposited
// CF: PF/ESI deposited = cash outflow (operating activities)
```

---

# 10. API DESIGN (REST CONTRACTS)

## 10.1 Core API Endpoints

```
BASE URL: /api/v1

AUTH:
  POST /auth/login          → { token, user }
  POST /auth/refresh        → { token }
  POST /auth/register       → { user }

COMPANIES:
  GET    /companies                     → [{ company }]  (CA: all, SME: own)
  POST   /companies                     → { company }
  GET    /companies/:id                 → { company }
  PATCH  /companies/:id                 → { company }
  DELETE /companies/:id                 → 204

DATA IMPORT:
  POST   /companies/:id/import/upload   → { jobId }     (upload Excel/CSV/Tally XML)
  GET    /companies/:id/import/status/:jobId → { status, progress, result }
  POST   /companies/:id/import/map      → { mapping }    (map accounts)
  POST   /companies/:id/import/confirm  → { companyId }  (finalize import)

CHART OF ACCOUNTS:
  GET    /companies/:id/coa             → { tree: [...] }  (hierarchical)
  PATCH  /companies/:id/coa/:accountId  → { account }
  POST   /companies/:id/coa/merge       → { merged }     (merge accounts)

HISTORICAL DATA:
  GET    /companies/:id/historical      → { months: [{ period, accounts: {...} }] }
  PATCH  /companies/:id/historical/:period → { accounts }

FORECAST:
  POST   /companies/:id/forecast/generate     → { jobId }
  GET    /companies/:id/forecast/status/:jobId → { status, progress }
  GET    /companies/:id/forecast               → { pl, bs, cf, compliance, metrics }
  PATCH  /companies/:id/forecast/cell           → { accountId, period, value }

BASELINE SETTINGS:
  GET    /companies/:id/forecast/value-rules        → [{ rule }]
  PATCH  /companies/:id/forecast/value-rules/:id    → { rule }
  POST   /companies/:id/forecast/value-rules         → { rule }
  
  GET    /companies/:id/forecast/timing-profiles     → [{ profile }]
  PATCH  /companies/:id/forecast/timing-profiles/:id → { profile }
  
  GET    /companies/:id/forecast/drivers             → [{ driver }]
  PATCH  /companies/:id/forecast/drivers/:id         → { driver }
  
  GET    /companies/:id/forecast/schedules           → [{ schedule }]
  PATCH  /companies/:id/forecast/schedules/:id       → { schedule }

MICRO-FORECASTS:
  GET    /companies/:id/micro-forecasts              → [{ mf }]
  POST   /companies/:id/micro-forecasts              → { mf }
  GET    /companies/:id/micro-forecasts/:id          → { mf }
  PATCH  /companies/:id/micro-forecasts/:id          → { mf }
  DELETE /companies/:id/micro-forecasts/:id          → 204
  PATCH  /companies/:id/micro-forecasts/:id/toggle   → { is_active }
  PATCH  /companies/:id/micro-forecasts/:id/move     → { newStartDate }

SCENARIOS:
  GET    /companies/:id/scenarios                    → [{ scenario }]
  POST   /companies/:id/scenarios                    → { scenario }
  GET    /companies/:id/scenarios/:id                → { scenario }
  PATCH  /companies/:id/scenarios/:id                → { scenario }
  DELETE /companies/:id/scenarios/:id                → 204
  GET    /companies/:id/scenarios/compare             → { base, scenario, diff }
  POST   /companies/:id/scenarios/:id/overrides      → { override }

COMPLIANCE:
  GET    /companies/:id/compliance/gst               → { forecast }
  GET    /companies/:id/compliance/tds               → { forecast }
  GET    /companies/:id/compliance/advance-tax       → { forecast }
  GET    /companies/:id/compliance/pf-esi            → { forecast }
  PATCH  /companies/:id/compliance/gst/config        → { config }
  PATCH  /companies/:id/compliance/tds/config        → { config }

QUICK METRICS:
  GET    /companies/:id/forecast/metrics             → { metrics }
  PATCH  /companies/:id/forecast/metrics/config      → { config }

REPORTS:
  POST   /companies/:id/reports/management           → { pdfUrl }  (async)
  POST   /companies/:id/reports/bank-loan             → { pdfUrl }  (async)
  POST   /companies/:id/reports/scenario-comparison   → { pdfUrl }  (async)
  GET    /companies/:id/reports/status/:jobId        → { status, pdfUrl }

SNAPSHOTS (Phase 3):
  POST   /companies/:id/snapshots                     → { snapshot }
  GET    /companies/:id/snapshots                     → [{ snapshot }]
  GET    /companies/:id/snapshots/variance            → { variance }

PORTFOLIO (CA-only):
  GET    /portfolio/overview                          → { summary, alerts }
  GET    /portfolio/companies                         → [{ company, healthScore }]
  GET    /portfolio/companies/:id/summary             → { summary }
```

## 10.2 Example API Contract: Cell Update

```
PATCH /api/v1/companies/abc-123/forecast/cell
Authorization: Bearer eyJhbGci...
Content-Type: application/json

REQUEST:
{
  "accountId": "def-456",
  "period": "2025-08-01",        // first day of August 2025
  "value": 850000,               // in PAISE (₹8,500.00)
  "scenarioId": null              // null = baseline, "xyz" = scenario override
}

RESPONSE (200):
{
  "cell": {
    "accountId": "def-456",
    "accountName": "Salaries & Wages",
    "period": "2025-08-01",
    "value": 850000,
    "displayValue": "₹8,50,000",
    "rule": {
      "type": "direct_entry",
      "source": "user_override"
    },
    "previousValue": 820000,
    "previousRule": {
      "type": "rolling_average",
      "config": { "months": 3 }
    }
  },
  "impactedMetrics": {
    "cashOnHand": {
      "previous": 24500000,
      "new": 24170000,
      "change": -330000,
      "displayChange": "-₹33,000"
    },
    "netIncome": {
      "previous": 820000,
      "new": 790000,
      "change": -30000,
      "displayChange": "-₹30,000"
    }
  },
  "recalculationJobId": "job-789",
  "message": "Cell updated. Full forecast recalculating in background."
}

ERROR RESPONSES:
  400: { "error": "Invalid period", "details": "Period must be a forecast month" }
  403: { "error": "Access denied", "details": "You have read-only access to this company" }
  404: { "error": "Account not found" }
  422: { "error": "Validation failed", "details": { "value": "Must be positive integer in paise" } }
```

## 10.3 Example API Contract: Generate Forecast

```
POST /api/v1/companies/abc-123/forecast/generate
Authorization: Bearer eyJhbGci...
Content-Type: application/json

REQUEST:
{
  "forecastMonths": 12,
  "includeCompliance": true,
  "scenarioId": null,           // null = baseline
  "options": {
    "autoDeriveTimingProfiles": true,
    "autoDetectSeasonality": true,
    "smartPredictionForRevenue": true
  }
}

RESPONSE (202 Accepted):
{
  "jobId": "job-gen-001",
  "status": "queued",
  "estimatedDuration": "8-15 seconds",
  "statusUrl": "/api/v1/companies/abc-123/forecast/status/job-gen-001"
}

// Polling response:
GET /api/v1/companies/abc-123/forecast/status/job-gen-001

RESPONSE (200, while processing):
{
  "jobId": "job-gen-001",
  "status": "processing",
  "progress": {
    "step": "generating_baseline_pl",
    "percent": 40,
    "message": "Calculating revenue projections..."
  }
}

RESPONSE (200, completed):
{
  "jobId": "job-gen-001",
  "status": "completed",
  "progress": { "step": "done", "percent": 100 },
  "result": {
    "forecastId": "fc-002",
    "periods": [
      { "period": "2025-04-01", "type": "actual" },
      { "period": "2025-05-01", "type": "actual" },
      ...
      { "period": "2026-03-01", "type": "actual" },
      { "period": "2026-04-01", "type": "forecast" },
      ...
      { "period": "2027-03-01", "type": "forecast" }
    ],
    "quickMetrics": {
      "cashOnHand": {
        "endMonth": { "period": "2027-03-01", "value": 18200000 }
      },
      "netIncome": {
        "total": { "value": 9850000 }
      }
    },
    "dataUrl": "/api/v1/companies/abc-123/forecast"
  }
}
```

---

# 11. DATA IMPORT PIPELINE

## 11.1 Excel Import Flow

```
USER UPLOADS FILE
       │
       ▼
┌──────────────────────────────────┐
│ STEP 1: FILE VALIDATION          │
│ ├── Check file type (.xlsx/.csv) │
│ ├── Check file size (< 10MB)     │
│ ├── Check for password protection│
│ └── Check for macros (reject)    │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│ STEP 2: STRUCTURE DETECTION      │
│ ├── Detect orientation           │
│ │   (accounts in rows vs cols)   │
│ ├── Detect header row            │
│ │   (which row has "Revenue"?)   │
│ ├── Detect period columns        │
│ │   (Apr-24, May-24, etc.)      │
│ ├── Detect account name column   │
│ ├── Detect amount columns        │
│ │   (debit/credit or single)     │
│ └── Detect if P&L and BS are     │
│     in same sheet or separate    │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│ STEP 3: DATA EXTRACTION          │
│ ├── Parse all cells into         │
│ │   structured format:           │
│ │   {                           │
│ │     accounts: [               │
│ │       { name: "Sales",        │
│ │         type: "pl",           │
│ │         months: {             │
│ │           "2024-04": 4500000, │
│ │           "2025-03": 5200000  │
│ │         }                     │
│ │       }, ...                  │
│ │     ]                         │
│ │   }                           │
│ ├── Handle merged cells          │
│ ├── Handle Indian number format │
│ │   (lakhs, crores in headers)  │
│ └── Clean whitespace, special    │
│     characters from account names│
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│ STEP 4: ACCOUNT MAPPING         │
│ ├── For each extracted account: │
│ │   ├── Exact match against      │
│ │   │   standard CoA dictionary │
│ │   ├── Fuzzy match (Levenshtein│
│ │   │   distance < 3)           │
│ │   ├── Keyword match            │
│ │   │   ("salary" → Salaries &  │
│ │   │    Wages)                  │
│ │   └── If no match → "Unmapped"│
│ ├── Group unmapped accounts      │
│ ├── Present mapping UI to user   │
│ └── User confirms/adjusts       │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│ STEP 5: BALANCE VALIDATION      │
│ ├── P&L Check:                   │
│ │   Total Revenue =             │
│ │     Total Expenses + Net Profit│
│ │   (allow ₹1 tolerance)        │
│ ├── BS Check:                    │
│ │   Total Assets =              │
│ │     Total Liabilities + Equity │
│ │   (allow ₹1 tolerance)        │
│ ├── Cross-check:                 │
│ │   Net Profit flows to         │
│ │   Retained Earnings in BS     │
│ ├── Gap Detection:               │
│ │   Flag if < 12 months of data │
│ │   Flag if months are non-     │
│ │   contiguous                  │
│ └── Anomaly Detection:           │
│     Flag if any month's value is │
│     > 3 standard deviations     │
│     from mean (possible error)  │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│ STEP 6: STORE                    │
│ ├── Create/Update Chart of      │
│ │   Accounts                    │
│ ├── Insert monthly_actuals rows │
│ │   (one per account per month) │
│ ├── Set company.fy_start_month  │
│ ├── Set company.import_source   │
│ └── Trigger baseline generation │
│     (async job)                 │
└──────────────────────────────────┘
```

## 11.2 Tally Import Flow (Phase 2)

```
METHOD 1: Tally XML Export (Phase 2a - Simplest)
  1. User exports from Tally: Gateway of Tally → Export → XML
  2. Upload XML file to CashFlowIQ
  3. Parser extracts:
     - Chart of Accounts (from GROUP and LEDGER tags)
     - Monthly Trial Balance (from VOUCHER tags, aggregated by month)
  4. Convert Trial Balance to P&L + BS using account type classification
  5. Follow same mapping → validation → store flow as Excel

METHOD 2: Tally API Integration (Phase 2b - Real-time)
  1. Install Tally connector (Tally Sync Server or third-party middleware)
  2. OAuth handshake with Tally instance
  3. API calls to fetch:
     - GET /master/groups → Chart of Accounts
     - GET /voucher?date_from=X&date_to=Y → Monthly vouchers
     - GET /report/TrialBalance?date=X → Monthly TB
  4. Normalize and store (same as Excel flow from Step 4 onward)
  5. Set up periodic sync (daily/weekly)

METHOD 3: Tally Gateway (Phase 3 - Most robust)
  1. User installs CashFlowIQ Tally Extension (.TSL file)
  2. Extension sends data to our API on schedule
  3. Handles multi-company Tally setups
  4. Handles UDP port conflicts
  5. Auto-reconnects if