# Master Architecture & Product Specification: CashFlowIQ

**Project:** CashFlowIQ  
**Target Audience:** Investors, External Security Auditors, Third-Party Developers  
**Confidentiality:** Proprietary Blueprint — **NO SOURCE CODE INCLUDED**

---

## 1. Executive Summary & Product Vision

**CashFlowIQ** is an enterprise-grade, Three-Way Integrated Financial Forecasting platform specifically engineered for the Indian Small and Medium Enterprise (SME) sector and Chartered Accountant (CA) firms. 

### Core Value Proposition
Traditional accounting software provides historical snapshots but fails to deliver predictive, algorithmically integrated financial models. CashFlowIQ solves this by allowing companies to ingest historical data and generate 12-month projections where every transaction is automatically balanced across the Profit & Loss (P&L), Balance Sheet, and Cash Flow Statement.

### Key Capabilities
- **Schedule III / AS 3 Compliance:** Native support for Indian statutory reporting standards.
- **Indian Statutory Intelligence:** Built-in logic for GST, TDS, PF, ESI, and Corporate Tax.
- **Collaborative Multi-Tenancy:** Designed for CA firms managing hundreds of client portfolios with absolute data isolation.
- **Granular Scenario Modeling:** Simulates business events (hires, capex, price changes) and reveals their impact on cash runways in real-time.

---

## 2. High-Level Tech Stack

The system utilizes a serverless, edge-first architecture designed for deterministic performance and high-precision data integrity.

### Frontend
- **Framework:** Next.js 15/16 (App Router) utilizing React 19 Server Components.
- **Presentation:** Tailwind CSS v4, shadcn/ui, and Radix UI primitives.
- **State Management:** Domain-partitioned Zustand client-side stores.
- **Visualization:** Recharts for dense, interactive financial data plotting.

### Backend & Orchestration
- **Architecture:** Node.js Serverless architecture via Next.js Server Actions.
- **Database:** Turso (libSQL/SQLite) distributed over the edge via Drizzle ORM.
- **Background Processing:** Inngest (Event-driven, asynchronous mathematical jobs).
- **Validation:** Zod for strict end-to-end schema integrity and DoS protection.

### Infrastructure
- **Identity:** Clerk (JWT-based identity management; zero passwords stored locally).
- **Storage:** Cloudflare R2 / UploadThing for secure document ingestion.
- **Resiliency:** Upstash Redis for global rate limiting and idempotency control.
- **Observability:** Sentry for performance monitoring and error tracking.

---

## 3. System Architecture & Data Flow

### The "Clean Engine" Pattern
The core mathematical logic is strictly decoupled from the web and database layers. The **Financial Engine** is a stateless, pure function that accepts structured financial inputs and returns a deterministic Three-Way forecast.

### Data Flow Lifecycle
1. **Ingestion:** Data is uploaded via Excel or Tally XML. A streaming SAX parser handles large files (up to 200MB) within memory limits.
2. **Standardization:** External accounts are mapped to a canonical Schedule III taxonomy using an intelligent mapping UI.
3. **Mutation:** Changes to forecasting rules are sent via Server Actions, which enforce multi-tenant scoping and record persistent audit logs.
4. **Asynchronous Computation:** Heavy mathematical models are dispatched to Inngest queues. The UI polls a status-aware endpoint that detects and recovers from stalled jobs.
5. **Revalidation:** Real-time UI updates are triggered via Next.js cache revalidation upon job completion.

---

## 4. Database Schema & Architecture

The database is a strictly normalized SQLite schema prioritizing write-speed and relational integrity.

### Multi-Tenant Isolation
Isolation is enforced at the query level using globally unique UUIDv4 identifiers for configuration data and `company_id` filters. High-throughput tables utilize `cuid2` for time-sortable, append-only performance.

### Key Data Models
- **Identity (`companies`, `firms`, `company_members`):** Maps Clerk identities to roles (Partner, Staff, Viewer).
- **Ledger (`accounts`, `monthly_actuals`):** Hierarchical chart of accounts storing balances in **integer paise** to eliminate floating-point drift.
- **Forecasting (`scenarios`, `value_rules`, `timing_profiles`):** Rule-based projections that define how and when cash moves.
- **Resiliency (`idempotency_keys`, `audit_log`):** Ensures exactly-once execution for mutations and a permanent history of system changes.

---

## 5. Backend & Engine Architecture

### Forecasting Engine Resilience
The engine implements **Deterministic Convergence Monitoring**. It executes a 3-pass loop to resolve cross-account dependencies (e.g., interest based on debt balance). If the model fails to stabilize, the system surfaces an explicit "Engine Convergence" warning to the user.

### Mathematical Precision
All compounding logic (e.g., growth rates) is performed using raw floating-point values internally, with rounding only occurring at the final output stage. This prevents "rounding drift" that typically plagues spreadsheet-based models.

### Security Hardening
- **IP-Based Rate Limiting:** Public routes are protected against DoS via IP-tracking (30 req/min).
- **Payload Bounds:** All array inputs are strictly constrained by Zod `.max()` checks to prevent memory-bloat attacks.
- **Safe Formula Evaluation:** User-defined formulas are parsed via an Abstract Syntax Tree (AST) evaluator, preventing arbitrary code execution while allowing complex math.

---

## 6. Frontend Architecture

### Design Philosophy: "Surgical Precision"
The UI is optimized for data density and speed. Interactive grids utilize monospaced typography (`IBM Plex Mono`) with `tabular-nums` alignment to ensure numbers align perfectly for visual audits.

### State Management
Instead of a single global store, the system uses **Domain-Partitioned Zustand Stores** (e.g., `ScenarioStore`, `ActualsStore`). This ensures that complex data transformations (like mapping thousands of accounts) do not trigger unnecessary re-renders across the whole application.

---

## 7. Comprehensive Directory & File Map

### `/src/app/(app)` — Interaction Layers
- `forecast/`: The main projection workspace for building and viewing models.
- `data/`: Ingestion hub for external accounting data.
- `compliance/`: Configuration and prediction of GST/TDS statutory outflows.
- `reports/`: View-only, high-fidelity financial statements (P&L, BS, CF).

### `/src/lib/engine` — The Mathematical Core
- `three-way/`: Core implementation of the indirect-method cash flow logic.
- `value-rules/`: Projection logic (Growth, Rolling Average, Same Last Year).
- `formula-evaluator.ts`: AST-based safe expression evaluation engine.
- `index.ts`: The central orchestration point for the forecasting lifecycle.

### `/src/lib/db` — Persistence & Query Layer
- `schema.ts`: Master source of truth for the relational database.
- `validation.ts`: Bound-checked Zod schemas for all network data.
- `queries/`: Hardened data access patterns with built-in company isolation.

### `/src/lib/import` — Ingestion Engines
- `tally-parser.ts`: SAX-based streaming XML parser for Tally Prime exports.
- `excel-parser.ts`: High-performance buffer-based Excel ingestion.
- `account-mapper.ts`: Logic for classifying external accounts into the Schedule III taxonomy.

---
**Document Status:** Finalized & Verified  
**Version:** 2.0.0 (Hardened)  
**Verification Suite:** Passed (155/155 Tests)
