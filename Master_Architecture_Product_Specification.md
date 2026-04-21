# Master Architecture & Product Specification
**Project:** CashFlowIQ
**Target Audience:** Investors, External Security Auditors, Third-Party Developers

---

## 1. Executive Summary & Product Vision

**CashFlowIQ** is a highly specialized, Three-Way Integrated Financial Forecasting platform engineered explicitly for Indian Small and Medium Enterprises (SMEs) and Chartered Accountant (CA) Firms.

**Core Value Proposition:**
The platform solves the fragmented financial modeling problem by allowing companies or their accounting firms to seamlessly ingest historical Profit & Loss (P&L) and Balance Sheet data. Utilizing this data, the proprietary engine generates a dynamic 12-month projected P&L, Balance Sheet, and Cash Flow Statement. The system ensures algorithmic perfection where every transaction implicitly balances across all three financial statements.

Crucially, the platform features native compliance with Indian statutory obligations (GST, TDS, PF, ESI, Corporate Tax), enabling businesses to not only forecast cash availability but to predict precise statutory outflows dynamically.

**Key Capabilities:**
- **Tenant Isolation & Firm Workspaces:** Multi-tenant architecture designed to support CA firms managing multiple client companies.
- **Micro-Forecasting & Scenarios:** Capability to simulate precise business events (e.g., asset purchases, hiring drives) and map out multiple "what-if" financial scenarios.
- **Strict Schedule III / AS 3 Compliance Engine:** The financial integrity of the system ensures that changes in the P&L automatically tie back to the Balance Sheet and correctly model Cash Flow via the Indirect Method.

---

## 2. High-Level Tech Stack

CashFlowIQ utilizes a modern, serverless edge-first technology stack deliberately constrained to avoid non-deterministic behavior and mathematical float drift.

### Frontend
- **Framework:** Next.js 15 (App Router utilizing React Server Components).
- **UI & Presentation:** React 19, Tailwind CSS v4, shadcn/ui, Radix/Base UI primitives.
- **State Management:** Zustand (domain-partitioned client-side stores acting as memory snapshots).
- **Data Visualization & Export:** Recharts, ExcelJS, JSPDF, and HTML2Canvas.

### Backend & Orchestration
- **Architecture:** Node.js Serverless architecture via Next.js Server Actions.
- **Database & ORM:** Turso (libSQL/SQLite distribution over the edge) handled via Drizzle ORM.
- **Schema Validation & Types:** Zod for end-to-end exact validation typing.
- **Background Processing:** Inngest (Event-driven queues for long-running mathematical jobs).

### Infrastructure & Operations
- **Authentication & Identity:** Clerk (Handles pure JWT identities; NO raw passwords touch the database).
- **Storage:** Cloudflare R2 / UploadThing.
- **Rate Limiting & Resiliency:** Upstash Redis.
- **Monitoring:** Sentry.

---

## 3. Financial Engine & Core Logic (Deep Dive)

The intellectual property of CashFlowIQ operates primarily in an isolated mathematical backend framework. It comprises two core architectural constructs: the **Three-Way Engine** and the **Formula Evaluator**.

### The Three-Way Integration Engine
*Location: `/src/lib/engine/three-way`*

The engine rigorously implements Schedule III (Division I) / AS 3 logic.
1. **Integer Arithmetic (Paise):** To negate IEEE 754 floating-point drift, all engine calculations happen in absolute *paise* (integers).
2. **Two-Step Tax Computation to Break Circularity:** 
   - **Step A:** Computes the P&L down to Profit Before Tax (PBT).
   - **Step B:** The Compliance Engine intercepts PBT, injects the correct staggered Tax Expense logic, and calculates Profit After Tax (PAT). 
3. **Cash as the Balance Sheet Plug:** The engine mandates that *Assets = Liabilities + Equity*. It enforces this mathematically each month by dynamically calculating Cash as the ultimate reconciling variable. If a discrepancy occurs (e.g., historical data imports are missing variables), the engine surfaces non-blocking reconciliation warnings down to the single-paise magnitude.
4. **Working Capital Target Balances:** For assets/liabilities like Inventories or Pre-paids, the engine ingests *Target Balances* (the CA perspective) and calculates the absolute Deltas automatically routing them to the AS 3 Cash Flow Statement.

### Formula Evaluator Engine
*Location: `/src/lib/engine/formula-evaluator.ts`*

Permits dynamic, user-coded scenario variables mapped against historical structures.
- **AST Parser Security:** Utilizes an Abstract Syntax Tree parser (`expr-eval`) mapping expressions mathematically without utilizing `eval()` or unsafe Javascript prototypes.
- **Div/0 Defensive Structuring:** Mathematical exceptions (Divided by zero constraints or variable omissions) never throw system crashes holding up generation; they gracefully return 0 alongside structured `warning` metadata arrays. 
- **Variable Sanitization:** Automatically translates string representations of accounts (`[account_id]`) into localized variables isolating engine processing from ID mismatches.

---

## 4. System Architecture & Workflow Concurrency

### Serverless Full-Stack Monolith Workflow
- **Client-to-Server Mutations:** Read paths are SSR streaming layouts. Mutations utilize Next.js Server Actions constrained purely by Zod schemas. The actions perform the database changes securely out-of-band and issue an `revalidatePath` instruction triggering a fresh DOM representation on the client without manual re-fetches.
- **Asynchronous Backpressure (Inngest):** When a user asks the system to evaluate a 12-month projection utilizing 5,000 value rules, processing occurs out-of-band on Inngest queues. The database state updates to `status: calculating`, the Inngest runner securely completes the logic execution asynchronously, writing to `forecast_results`, and dispatches an event alerting the UI to switch state to `ready`.

### Resiliency Patterns
- **Idempotency Keys (`idempotency_keys`):** Every mutation endpoint (Server Action) expects an Idempotency Key. A cache table logs execution states (`in_progress`, `completed`). If a client retries a mutation under a slow network before the first completes, the system natively aborts the concurrent replay with a `409 Conflict`, or returns the `responseBody` immediately if completed.
- **Optimistic Concurrency Control (OCC):** Complex relational tables like `scenarios` utilize a `version` column. Upon an update, to ensure two users at the same firm are not diverging forecasts, the schema asserts against the version it knew. Updates natively increment the version in the SQL statement.

---

## 5. Database Schema & Architecture

CashFlowIQ utilizes a strictly normalized SQLite database prioritizing rapid B-Tree appends. Multi-tenant tracking happens explicitly at query runtime via global constraints mapping against `companyId`.

**ID Generation Strategy:** 
- `UUIDv4`: For configuration tables (Companies, Accounts, Rules).
- `cuid2`: For high-throughput *append-only* ledgers (`auditLog`, `monthlyActuals`). Cuid2 strings are natively time-sortable ensuring new records append to the end of the SQLite B-Tree index, effectively eradicating index fragmentation.

### Core Data Models:
1. **Identity (`companies`, `firms`, `company_members`):** Maps Clerk’s `clerkUserId` against roles holding explicit access (partner, staff, readonly). 
2. **Chart of Accounts & Ledgers (`accounts`, `monthly_actuals`):** Hierarchical mapping utilizing tree logic via recursive parent-ID keys. Actuals hold normalized period states in paise.
3. **Forecasting Models (`scenarios`, `value_rules`, `timing_profiles`):** Defines rules instructing the system how past actuals project forward (Value Equations) and *when* exactly that projected cash effectively realizes operationally (Timing Profiles).
4. **Compliance (`tax_rate_history`, `compliance_config`):** Structurally chronological configurations preventing *retroactive corruption*. Forecasting historical months adheres strictly to the effective rate `effectiveFrom` assigned that month explicitly, preventing new government budgets from re-writing locked historical reports.
5. **System Observability (`forecast_results`, `audit_log`):** Houses materialized pre-computed strings (`pl_data`, `bs_data`) preventing the need to rerun the three-way mathematics purely to view a dashboard. 

---

## 6. Frontend & UI/UX Design Architecture

The user interface operates under a highly decoupled Client/Server layout, deliberately engineered to mirror the absolute speed, interaction physics, and data density of native desktop financial software within the browser.

### The "Fathom-Level Precision" Design Philosophy
The entire application follows a strict, data-over-decoration aesthetic philosophy governed by `globals.css` and Tailwind CSS v4 variables:
- **Color as Data:** Colors are exclusively semantic. Blue (`#2563EB`) strictly indicates positive cash flows or interactive areas. Red (`#DC2626`) signals an operative stop or negative outflow. Amber signals attention. The base palette strictly uses a monochrome slate, neutralizing the interface to allow raw numbers to stand out.
- **Strictly Light Theme:** To maintain absolute contrast standard matching enterprise accounting platforms, the application disables dark mode. The canvas sits at `#F8FAFC` utilizing `#FFFFFF` for elevated data cards, preventing eye strain during heavy tabular data entry.
- **Surgical Precision Layout & Density:** Instead of airy "SaaS" padded designs, the engine favors dense `display: grid` spreadsheet-like constructs. Table rows are structurally locked to `44px` or `48px` with sticky headers. 
- **Typography & Alignment:** Standard UI text uses `Inter` for legibility, but **all numbers strictly utilize `IBM Plex Mono`** enforcing `tabular-nums`. This guarantees numbers align perfectly down the columns, making rapid visual audits of large datasets seamless.

### Micro-Interactions & Physics
- **Deterministic Physics:** Interactions mimic physical switches. Hover states are constrained to a fast `80ms` ease-out ensuring interfaces feel lightning-fast yet intentional. Button activations utilize `0.5px` translations (`btn-press`), providing visceral feedback alongside `150ms` fluid toggle slides.
- **Shimmer Workflows:** Loading states explicitly map to content shapes leveraging linear-gradient linear shimmers representing actual data blocks, avoiding jarring spinner pop-ins during Inngest job polling.

### State Management & Separation of Concerns
- **Domain-Partitioned Zustand Stores:** Memory execution explicitly avoids single-store monoliths. States are split dynamically (`company-store`, `scenario-store`, `actuals-store`). This domain isolation prevents widespread React re-renders on minor data inputs, isolating updates specifically where the computation occurred.
- **React Server Components (RSC) vs Client Hooks:** Layout shells, metrics grids, and structural navigational data is streamed via RSC for zero-bundle payload deliveries. Highly interactive calculation grids, scenario formula builders, and data ingestion wizards utilize targeted Client Components where instant, zero-latency feedback loop is required.

### Presentation Boundaries
Located under `/src/app/(app)/`:
- `forecast/`: Granular logic mapping where the UI permits deep nesting of Micro-Forecast scenarios using local interactive overlays (Sheet/Dialog).
- `reports/`: View-only layers leaning exclusively on Server Components that simply draw pre-cached `forecast_results` from the database.
- `import/`: Intelligent multi-step parser utilizing local memory (indexedDB paths via Zustand insists) to parse, clean, and map external General Ledgers to the system's exact internal schema logic before committing anything to the backend network.

---

## 7. Operational Blueprint

An architectural summary indicating physical separation of duties across the repository:

- **`/src/lib/db/*`:** The explicit source of truth containing Drizzle modeling schemas, strictly type-safe hardened CRUD patterns enforcing workspace isolation, and exact Zod parsing matrices. 
- **`/src/lib/engine/*`:** Pure abstract mathematical implementation. Designed to have absolutely zero awareness of HTTP cycles, React interfaces, or raw database connections. Only accepts structured `MonthlyInput` schemas yielding `ThreeWayMonth` structured responses.
- **`/src/app/api/*`:** Specifically Webhooks from external providers (Clerk user instantiation routes, Inngest deterministic background triggers, Resend pingbacks).
- **`/src/components/*`:** Purely presentation code, structurally split between atomic design components (`/ui`), and compound functional boundaries (`/forecast`, `/reports`) that combine UI primitives and Zustand state into unified interactive blocks.
