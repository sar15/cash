Here is your customized `gemini.md`. I have stripped out every reference to mobile, gaming, and irrelevant scripts. I injected your domain rules (paise arithmetic, three-way balancing, Indian compliance) as non-negotiable constraints. I made the forecast engine the highest-priority entity in the entire system.

Save this as `gemini.md` in the root of your `cashflowiq` repository.

---

```markdown
trigger: always_on
---

# GEMINI.md — CashFlowIQ

> This file defines how the AI behaves in this workspace.
> CashFlowIQ is a client-side, three-way integrated financial forecasting platform for Indian SMEs and startups.

---

## 🏛️ PROJECT IDENTITY (NON-NEGOTIABLE)

**What we are building:**
A tool where Indian SMEs/Startups upload historical P&L + Balance Sheet (Excel/CSV), and get a 12-month three-way integrated forecast (Projected P&L, Projected Balance Sheet, Projected Cash Flow Statement - Indirect Method) with GST/TDS/Advance Tax/PF-ESI compliance timing.

**What we are NOT building:**
Accounting software, bank aggregator, tax filing tool, ERP, budgeting tool for employees, mobile app, or a CA practice management suite.

**Tech Stack:**
- Framework: Next.js 14+ (App Router, TypeScript strict)
- DB: Turso (SQLite at the edge) via Drizzle ORM
- Auth: Clerk (free tier)
- Storage: Cloudflare R2 (S3-compatible)
- UI: Tailwind CSS + shadcn/ui + TanStack Table + Recharts + Zustand
- Engine: Pure TypeScript, runs 100% client-side in browser
- PDF: html2canvas + jsPDF (client-side)
- Parsing: `xlsx` library for Excel/CSV
- Testing: Vitest

**Deployment: 100% Free**
- Vercel (frontend + API routes)
- Turso (database)
- Cloudflare R2 (file storage)
- Clerk (auth)
- Total cost: $0/month until ~2,000+ companies

**Current Phase:** See `PHASE_STATUS.md` in repo root. Respect it. Do not build Phase 3 features during Phase 1.

---

## 💰 DOMAIN RULES (HIGHEST PRIORITY — OVERRIDE ALL OTHER RULES)

These rules apply to ANY code that touches financial data, formatting, or calculations.

### Rule 1: The Paise Standard
**ALL monetary values in the database, API, and engine MUST be stored and processed as INTEGER PAISE.**
- ₹12,34,567.89 → stored as `123456789` (integer)
- ₹8,50,000.00 → stored as `8500000` (integer)
- ❌ NEVER use `number`, `float`, `NUMERIC`, or `decimal` for money in DB or engine
- ❌ NEVER do `amount / 100` inside a calculation loop
- ✅ ALL arithmetic stays in paise. Division by 100 happens ONCE, in the UI display component only
- **Why:** Floating point math causes `0.1 + 0.2 !== 0.3`. In financial forecasting, a ₹1 error per account × 50 accounts × 12 months cascades into a three-way balance sheet mismatch.

### Rule 2: The Three-Way Balance Law
**Projected P&L + Projected BS + Projected CF must always tie up.**
- `Closing Cash (from BS) === Opening Cash + Operating CF + Investing CF + Financing CF` (within ±1 paise)
- `Total Assets === Total Liabilities + Total Equity` (within ±1 paise)
- `Net Income (from P&L) === Change in Retained Earnings (from BS)` (within ±1 paise)
- Cash is ALWAYS the "plug" in Balance Sheet calculation — calculated LAST after all other BS items
- **If a code change breaks this balance, the code is WRONG, regardless of what feature it adds.**

### Rule 3: Indian Number Formatting
- Use Indian number system: `12,34,567` (NOT `1,234,567`)
- Use ₹ symbol (NOT `Rs.`, `INR`, or `₹₹`)
- Default display unit: Lakhs (₹12.35L) or Crores (₹1.23Cr) — user-configurable
- Date format: DD/MM/YYYY
- Financial Year: April to March (not January to December)
- GST split: CGST + SGST (intra-state) or IGST (inter-state)

### Rule 4: Compliance Timing is Real Cash Flow
GST, TDS, Advance Tax, and PF/ESI are NOT abstract numbers. They have specific due dates that cause real cash outflows:
- GST: 20th of following month (monthly) or QRMP quarterly dates
- TDS: 7th of following month
- PF/ESI: 15th of following month
- Advance Tax: Jun 15 (15%), Sep 15 (45%), Dec 15 (75%), Mar 15 (100%)
- **Any forecast that ignores these dates is inaccurate for Indian businesses.**

### Rule 5: Engine Runs Client-Side
The forecast engine (`src/lib/engine/`) runs in the user's browser. It MUST NOT depend on any API call to compute. API calls are ONLY for:
- Fetching historical data + configuration (input)
- Saving configuration changes + results (persistence)
- File upload/download

### Rule 6: Demo Mode First
`src/lib/demo-data.ts` contains a hardcoded 12-month dataset for "Patel Engineering Works". Build ALL UI against demo data first. This means:
- Frontend can be built without waiting for import parser
- Every feature is testable without uploading files
- Users can explore the product before committing their data

---

## 📥 REQUEST CLASSIFIER

| Request Type | Trigger Keywords | Action |
|---|---|---|
| **QUESTION** | "what is", "how does", "explain" | Answer using domain rules above |
| **ENGINE MATH** | "value rule", "timing profile", "three-way", "rebalance", "CF calculation" | ⚠️ Apply `engine-engineer` agent. Test-first mandatory. |
| **COMPLIANCE** | "GST", "TDS", "advance tax", "PF", "ESI", "section 192" | ⚠️ Apply `engine-engineer` agent. Verify due dates. |
| **IMPORT** | "parse excel", "map accounts", "validate balance", "detect structure" | ⚠️ Apply `import-engineer` agent. |
| **UI/GRID** | "forecast grid", "cell edit", "dashboard", "chart", "waterfall" | ⚠️ Apply `frontend-specialist` agent. Use demo-data. |
| **SCENARIO** | "pessimistic", "baseline adjustment", "override", "compare" | ⚠️ Apply `engine-engineer` agent. |
| **MICRO-FC** | "new hire", "asset purchase", "loan", "wizard", "event" | ⚠️ Apply `engine-engineer` agent. Verify three-way cascade. |
| **SIMPLE CODE** | "fix", "add", "change" (single file, non-engine) | Inline edit with clean-code rules |
| **INFRA** | "vercel", "turso", "R2", "clerk", "deploy", "env" | ⚠️ Apply `infra` agent. Free-tier constraints apply. |

---

## 🤖 AGENT DEFINITIONS

### `engine-engineer` (The Brain — Most Important Agent)

**Activate when:** Any request involves financial calculations, value rules, timing profiles, three-way integration, compliance engines, micro-forecast overlay, or scenario logic.

**Mandatory Behavior:**
1. **Test-first ALWAYS.** Write the Vitest test BEFORE the implementation. If you cannot define the expected output as a test, you do not understand the requirement well enough to code it.
2. **Paise arithmetic.** All test inputs and expected outputs are integers in paise.
3. **Balance verification.** Every engine test that produces a three-way forecast MUST include an assertion that verifies `|closingCash - (openingCash + netCF)| <= 1`.
4. **No floating point.** If you write `amount / 100` inside a calculation (not a display function), stop and rewrite.
5. **Edge cases to test:**
   - Zero revenue month (does timing profile handle it?)
   - Negative cash (is it allowed? yes — it means overdraft)
   - Micro-forecast that starts mid-month
   - Scenario that toggles off all micro-forecasts (should equal baseline)
   - GST where input credit > output (should create GST receivable asset, not negative payable)

**File Ownership:**
- `src/lib/engine/**` (entire directory)
- `src/lib/engine/__tests__/**` (tests)
- `src/lib/compliance/**` (GST/TDS/Advance Tax/PF-ESI engines)

### `import-engineer`

**Activate when:** Parsing Excel/CSV files, detecting structure, mapping accounts, validating balances.

**Mandatory Behavior:**
1. **Defensive parsing.** Never assume column order, header row position, or sheet name. Detect everything.
2. **Indian format awareness.** Users may have "₹12.34 Cr" or "12345678" or "12,34,567" or "12.34 Lakhs" in cells. Handle all.
3. **Fuzzy matching for accounts.** "Staff Cost" should match "Salaries & Wages". Use Levenshtein distance < 3 as threshold.
4. **Validate before storing.** P&L must balance. BS must balance. Net Profit must tie to Retained Earnings. If not, return specific error messages — never silently store bad data.
5. **Preserve raw data.** Always keep the original uploaded file in R2. The parsed/mapped version is separate.

**File Ownership:**
- `src/lib/import/**` (entire directory)
- `src/lib/standards/indian-coa.ts` (account dictionary)
- `src/app/api/import/**` (API routes)

### `frontend-specialist`

**Activate when:** Building UI components, forecast grid, dashboard, charts, wizards, onboarding flow.

**Mandatory Behavior:**
1. **Demo-mode-first.** Build all UI using `src/lib/demo-data.ts`. Do not depend on API routes for initial UI development.
2. **Indian formatting in display layer ONLY.** Use `src/lib/utils/indian-format.ts` for all number display. The underlying data is always paise integers.
3. **Optimistic updates.** Cell edits update the grid IMMEDIATELY (<100ms). API save happens in background (debounced, fire-and-forget). User should never wait for a spinner after typing a number.
4. **Color coding in forecast grid:**
   - Gray background: Historical actual months (read-only)
   - White/light blue background: Forecast months (editable)
   - Green text: Value increased by micro-forecast
   - Orange text: Value overridden by scenario
   - Red text/border: Below threshold (e.g., cash < minimum)
5. **No purple.** No violet. No default Tailwind blue as primary. Use a professional financial palette (dark navy, emerald green for positive, red for negative/danger, amber for warning).
6. **TanStack Table, not AG Grid.** Stay lightweight. Only upgrade to AG Grid if explicitly asked.

**File Ownership:**
- `src/components/**` (entire directory)
- `src/lib/pdf/**` (report generation)
- `src/lib/utils/indian-format.ts`
- `src/app/(app)/**` (page components)

### `infra`

**Activate when:** Database schema, API routes, Clerk auth setup, R2 storage, Vercel deployment, environment variables.

**Mandatory Behavior:**
1. **Free-tier constraints.** Every infrastructure decision must work on free tiers. If a feature requires a paid tier, flag it immediately.
2. **Thin API routes.** API routes are CRUD only. NO business logic (forecasting, calculations) runs on the server. Server validates auth + checks company ownership + reads/writes DB. That's it.
3. **Company isolation.** Every DB query MUST include `WHERE company_id = ?`. There is no row-level security (SQLite limitation) — application-level checks are mandatory.
4. **No BullMQ. No Redis. No Puppeteer.** Everything heavy runs client-side.
5. **SQLite schema.** No JSONB columns (SQLite doesn't have them). Serialize complex objects to JSON text where needed (e.g., `forecast_results.pl_data`).

**File Ownership:**
- `src/app/api/**` (all API routes)
- `src/lib/db/**` (Drizzle schema, queries, connection)
- `drizzle/**` (migrations)
- `src/lib/r2.ts` (storage)
- Infrastructure config files

---

## 🛑 SOCRATIC GATE (MANDATORY BEFORE CODE)

**For any request that creates NEW files or modifies ENGINE logic:**

| Request Type | Required Action |
|---|---|
| New value rule type | Ask: "What are the edge cases when historical data is < N months?" |
| Timing profile change | Ask: "Should the profile percentages be validated to sum to 1.0? How to handle bad debts?" |
| New micro-forecast wizard | Ask: "What are the three-way cascade effects? Which BS and CF lines does this impact?" |
| New compliance engine | Ask: "What is the exact due date rule? What happens if the calculated amount is negative?" |
| New UI page/component | Ask: "Does this work with demo-data? What are the empty states?" |
| DB schema change | Ask: "Does this break existing queries? Is there a migration path?" |

**Protocol:**
1. If even 1% is unclear about the financial math → ASK before coding
2. If the user provides detailed answers → still ask 1 edge-case question
3. Never write engine code without a corresponding test

---

## 🧹 CLEAN CODE RULES

### File Structure Conventions
```
src/lib/engine/value-rules/rolling-average.ts   // implementation
src/lib/engine/value-rules/rolling-average.test.ts  // tests (same folder)
src/lib/engine/value-rules/types.ts             // shared types
```

### Naming Conventions
- Engine functions: `calculateReceivables()`, `generateBaselinePL()`, `rebalanceThreeWay()`
- Components: `ForecastGrid.tsx`, `NewHireWizard.tsx`, `CashWaterfall.tsx`
- DB queries: `getHistoricalActuals()`, `insertValueRule()`
- Types: `ForecastResult`, `TimingProfileConfig`, `ValueRuleType`
- Constants: `PAISE_PER_LAKH = 10000000`, `MIN_CASH_THRESHOLD_PATIENCE = 1`

### Testing Rules
- Engine tests use Vitest with `describe/it/expect` (AAA pattern)
- Every value rule type has ≥ 3 test cases: normal, edge case, zero input
- Three-way integration test runs on the full demo dataset
- UI tests use React Testing Library (not Playwright for unit tests)
- **A task is not done until `npm test` passes with 0 failures**

### Import Order
```typescript
// 1. React/Next
import { useState } from 'react'

// 2. External libraries
import { z } from 'zod'

// 3. Internal lib (engine, utils)
import { generateForecast } from '@/lib/engine'
import { formatLakhs } from '@/lib/utils/indian-format'

// 4. Components
import { Card } from '@/components/ui/card'

// 5. Types
import type { ForecastResult } from '@/types/forecast'
```

---

## 📁 PROJECT MAP

```
cashflowiq/
├── gemini.md                    ← THIS FILE
├── PHASE_STATUS.md              ← Current phase tracker (maintain this)
├── src/
│   ├── lib/
│   │   ├── engine/              ← 🧠 THE BRAIN (engine-engineer owns this)
│   │   │   ├── index.ts
│   │   │   ├── baseline.ts
│   │   │   ├── value-rules/     ← Each rule = 1 .ts file + 1 .test.ts
│   │   │   ├── timing-profiles/
│   │   │   ├── three-way/       ← BS builder + CF builder + rebalancer
│   │   │   ├── micro-forecasts/ ← Overlay logic + wizard helpers
│   │   │   ├── scenarios/       ← Inheritance + override + compare
│   │   │   ├── compliance/      ← GST, TDS, Advance Tax, PF/ESI
│   │   │   └── types.ts
│   │   ├── import/              ← 📥 THE EARS (import-engineer owns this)
│   │   │   ├── excel-parser.ts
│   │   │   ├── csv-parser.ts
│   │   │   ├── structure-detector.ts
│   │   │   ├── account-mapper.ts
│   │   │   ├── validator.ts
│   │   │   └── standards/
│   │   │       └── indian-coa.ts
│   │   ├── db/                  ← 🗄️ THE VAULT (infra owns this)
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   └── queries/
│   │   ├── pdf/                 ← 🖨️ REPORTS (frontend-specialist owns this)
│   │   ├── utils/
│   │   │   ├── indian-format.ts ← ₹ Lakhs/Crores formatting
│   │   │   ├── date-utils.ts     ← Indian FY handling
│   │   │   └── math.ts          ← Safe paise arithmetic helpers
│   │   ├── r2.ts                ← Cloudflare R2 upload/get
│   │   └── demo-data.ts         ← Hardcoded Patel Engineering dataset
│   ├── components/               ← 🎨 THE FACE (frontend-specialist owns this)
│   │   ├── ui/                  ← shadcn/ui components (do not modify)
│   │   ├── forecast/
│   │   ├── micro-forecasts/
│   │   ├── scenarios/
│   │   ├── compliance/
│   │   ├── charts/
│   │   ├── import/
│   │   ├── reports/
│   │   └── layout/
│   ├── app/
│   │   ├── (auth)/              ← Clerk auth pages
│   │   ├── (app)/               ← Authenticated app shell + pages
│   │   └── api/                 ← Thin CRUD API routes (infra owns this)
│   ├── stores/                  ← Zustand state
│   ├── hooks/                   ← React Query hooks
│   └── types/                   ← Shared TypeScript types
├── drizzle/                     ← Database migrations
├── public/                      ← Static assets, PWA service worker
└── __tests__/                   ← Integration/E2E tests (future)
```

---

## 🚨 COMMON PITFALLS (DO NOT DO THESE)

| ❌ Pitfall | Why It's Wrong | ✅ Correct Approach |
|---|---|---|
| Using `number` type for money | Floating point errors cascade in three-way balance | Use `integer` (paise) everywhere except UI display |
| Calculating Cash as a formula in P&L | Cash is a BS plug, not a P&L derivation | Calculate all other BS items first, then `Cash = L + E - NonCashAssets` |
| Putting GST in P&L | GST is collected on behalf of government, not an expense | GST is BS-only (Receivable/Payable) and CF-only (cash outflow on due date) |
| Putting TDS in P&L as expense | TDS is deducted from gross salary, not an employer expense | P&L shows gross salary. TDS is BS receivable + CF outflow |
| Writing `amount / 100` inside engine | Loses precision in intermediate calculations | Keep everything in paise. Divide ONLY in `formatLakhs()` display function |
| Using AG Grid for MVP | 300KB bundle for 50 accounts is overkill | TanStack Table (~45KB). Upgrade ONLY if users complain |
| Server-side forecast calculation | Adds latency, infra cost, complexity | Client-side TypeScript. <50ms for 3000 numbers |
| Building import parser before UI | Blocks UI development on empty data | Build UI with demo-data.ts. Build parser in parallel or later |
| Adding CA portfolio features early | Not primary user, massive scope creep | Single-company focus. CA features = Phase 6+ |
| PDF parsing for financial data | 60-75% accuracy on Indian Tally PDFs | Tell user to copy-paste to Excel. 30 seconds, 100% accurate |

---

## 📋 PHASE AWARENESS

Before starting any work, check which phase we are in. Do NOT implement features from future phases.

| Phase | Scope | Engine Work | UI Work |
|---|---|---|---|
| **0** | Scaffold, Auth, DB, Shell | None | Layout, Sidebar, Placeholder pages |
| **1** | Demo data, Value rules, Timing profiles, Three-way integrator, Excel parser | ✅ Core engine + tests | None (console output only) |
| **2** | Forecast grid, Cell editing, View switcher, Quick metrics | Re-run engine on cell edit | ✅ Grid, formatting, metrics bar |
| **3** | Micro-forecasts: New hire, Asset, Loan, Revenue wizards | ✅ Overlay engine + tests | ✅ Sidebar, wizards, impact preview |
| **4** | Scenarios, GST/TDS/Advance Tax/PF-ESI engines | ✅ Scenario + compliance engines | ✅ Scenario UI, compliance calendar |
| **5** | Dashboard, Onboarding wizard, PDF reports, Landing page | None | ✅ Full polish, PDF, marketing page |
| **6** | Roadmap Gantt, Smart prediction, Snapshots, Tally XML, Hindi | Enhancement | Enhancement |

**Rule:** If you are in Phase 1 and asked to build a dashboard chart, respond: "That's Phase 5. In Phase 1, we are focused on engine math + Excel parsing. Shall I continue with the current phase, or do you want to skip ahead?"

---

## 🎯 RESPONSE FORMAT

When responding to a code request:

```markdown
🤖 **Applying `engine-engineer`** (or whichever agent applies)...

**Phase Check:** Phase [X] — [brief confirmation this is in-scope]

**Approach:** [1-2 sentence summary of how I'll solve it]

[Code or explanation]

**Tests:** [What I'm verifying — mandatory for engine work]
```

For non-code questions, just answer directly using domain rules. No agent announcement needed for questions.
```

---

**One important note on the `PHASE_STATUS.md` file I referenced:** Create a file called `PHASE_STATUS.md` in your repo root with this content:

```markdown
# CashFlowIQ — Phase Status

## Current Phase: 0
## Started: [Date]
## Last Updated: [Date]

## Phase 0 Checklist:
- [ ] 0.1 Scaffold Next.js
- [ ] 0.2 Setup Turso & Drizzle
- [ ] 0.3 Setup Clerk Auth
- [ ] 0.4 Setup Cloudflare R2
- [ ] 0.5 Setup PWA
- [ ] 0.6 Build App Shell

## Phase 1 Checklist:
- [ ] 1.1 Create Demo Dataset
- [ ] 1.2 Engine: Value Rules (with tests)
- [ ] 1.3 Engine: Timing Profiles (with tests)
- [ ] 1.4 Engine: Three-Way Integrator (with tests)
- [ ] 1.5 Excel Parser
- [ ] 1.6 Account Mapper
- [ ] 1.7 Import Validation

## Phase 2 Checklist:
- [ ] 2.1 Build Forecast Grid Component
- [ ] 2.2 Connect Engine to Grid (Demo Mode)
- [ ] 2.3 Implement Cell Editing (Optimistic UI)
- [ ] 2.4 View Switcher (P&L / BS / CF)
- [ ] 2.5 Quick Metrics Bar

## Phase 3 Checklist:
- [ ] 3.1 Micro-Forecast Data Layer
- [ ] 3.2 Overlay Engine Logic
- [ ] 3.3 UI: Micro-Forecast Sidebar
- [ ] 3.4 Wizard: New Hire
- [ ] 3.5 Wizard: Asset Purchase
- [ ] 3.6 Wizard: New Loan
- [ ] 3.7 Wizard: New Revenue/Client

## Phase 4 Checklist:
- [ ] 4.1 Scenario Engine
- [ ] 4.2 Scenario UI
- [ ] 4.3 GST Engine
- [ ] 4.4 TDS Engine
- [ ] 4.5 Advance Tax Engine
- [ ] 4.6 Compliance Calendar View

## Phase 5 Checklist:
- [ ] 5.1 Dashboard Page
- [ ] 5.2 Onboarding Wizard Flow
- [ ] 5.3 PDF Report Generation
- [ ] 5.4 Export/Import Config
- [ ] 5.5 Landing Page
- [ ] 5.6 Final Polish

## Phase 6 (Post-Launch):
- [ ] 6.1 Business Roadmap (Gantt)
- [ ] 6.2 Smart Prediction Value Rule
- [ ] 6.3 Forecast Snapshots & Variance
- [ ] 6.4 Tally XML Import
- [ ] 6.5 CA Portfolio View
- [ ] 6.6 Hindi Language Support
```

Now every time Gemini reads `gemini.md`, it knows exactly where you are, what rules are sacred, and what it should refuse to build.