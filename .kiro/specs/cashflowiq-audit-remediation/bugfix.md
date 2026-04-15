# Bugfix Requirements Document

## Introduction

The CashFlowIQ production audit identified 23 issues across security, architecture, performance, and code quality domains that block or risk production deployment. This document captures the defective behaviors and the correct behaviors required to achieve production certification. Issues span five severity tiers: 5 Critical blockers (C1–C5), 6 High-priority items (H1–H6), 6 Medium items (M1–M6), and 6 Low items (L1–L6).

---

## Bug Analysis

### Current Behavior (Defect)

**C1 — Zoho Books Integration Constraint Violation**

1.1 WHEN the application is deployed, THEN the system contains a full Zoho Books OAuth2 integration (client, mapper, sync, 3 API routes, schema table, env vars) in violation of the requirement that no external accounting integrations exist

**C2 — Missing API Retry Logic**

1.2 WHEN an API request fails due to a transient network error (packet loss, timeout, intermittent 3G/4G), THEN the system immediately surfaces the error to the user with no retry attempt

**C3 — Missing Request Timeout**

1.3 WHEN an API request is made on a slow or stalled network connection, THEN the system allows the request to hang indefinitely with no AbortController timeout

**C4 — Potentially Exposed Secrets**

1.4 WHEN `.env.local` was committed to git history, THEN the system has live Clerk, Resend, and encryption keys exposed in version control with no rotation verification

**C5 — Insufficient API Route Test Coverage**

1.5 WHEN API routes for companies, forecast, and import are exercised, THEN the system has zero unit tests covering auth enforcement, input validation, or response correctness for those routes

**H1 — Dead auth-store.ts**

1.6 WHEN the codebase is built, THEN the system includes `auth-store.ts` which has zero external consumers and exports only an unused `currentCompanyId` state

**H2 — OnboardingWorkspace on Legacy Store**

1.7 WHEN a user completes onboarding (demo, import, or manual setup), THEN the system persists all workspace state to `localStorage` via the legacy `workspace-store` instead of the API-backed stores

**H3 — WorkspaceBootstrapper on Legacy Store**

1.8 WHEN the app bootstraps on page load, THEN the system reads accounts, value rules, timing profiles, and forecast months from `localStorage` via `workspace-store` instead of the API-backed stores

**H4 — WorkspaceConfigurationFile Type Coupled to workspace-store**

1.9 WHEN `src/lib/configuration.ts` is imported, THEN the system imports the `WorkspaceConfigurationFile` type from `workspace-store`, creating a dependency on the legacy store that prevents clean removal

**H5 — Missing Server-Side File Content-Type Validation**

1.10 WHEN a file is uploaded to the import endpoint, THEN the system trusts the client-supplied `Content-Type` header without independently validating the actual file bytes server-side

**H6 — 97KB of Deprecated Components**

1.11 WHEN the project is built, THEN the system includes 6 deprecated components totalling ~97KB in `src/components/_deprecated/` that are never imported by any active route

**M1 — Heavy Dependencies in Initial Bundle**

1.12 WHEN the application first loads, THEN the system includes `exceljs`, `jspdf`, and `html2canvas` in the initial JavaScript bundle even though they are only needed for specific user-triggered actions

**M2 — No Optimistic UI Updates**

1.13 WHEN a user performs a mutation (e.g., updating a value rule or account), THEN the system waits for the API response before reflecting the change in the UI, causing perceived latency

**M3 — No Request Deduplication or Abort on Unmount**

1.14 WHEN a component that triggered an API request is unmounted before the response arrives, THEN the system does not abort the in-flight request, causing potential state updates on unmounted components

**M4 — Hardcoded Zero Opening Balances**

1.15 WHEN the forecast engine runs with imported Balance Sheet data, THEN the system defaults `AR`, `AP`, `equity`, and `retainedEarnings` opening balances to zero instead of resolving them from the imported data, producing inaccurate three-way integration results

**M5 — Non-Atomic Import Transactions**

1.16 WHEN a bulk import save operation fails partway through, THEN the system leaves partially-written account data in the database with no rollback, resulting in corrupted or incomplete datasets

**M6 — No End-to-End Tests**

1.17 WHEN critical user flows (onboarding, import, forecast, compliance) are executed, THEN the system has no Playwright E2E tests to verify correctness of the full user journey

**L1 — No PWA Offline Page**

1.18 WHEN a user with a cached PWA loses network connectivity and navigates to an uncached route, THEN the system shows a browser-default error page instead of a branded offline fallback

**L2 — No Concurrent Write Conflict Resolution for Value Rules**

1.19 WHEN two sessions update the same value rule simultaneously, THEN the system applies a last-write-wins strategy with no conflict detection or user notification

**L3 — No Lighthouse CI in Deploy Pipeline**

1.20 WHEN a deployment is made, THEN the system has no automated Lighthouse performance/accessibility score gate in the CI/CD pipeline

**L4 — Orphaned integrations Table if Zoho Removed**

1.21 WHEN Zoho Books integration code is removed (C1), THEN the system retains the `integrations` database table in the schema with no corresponding application code

**L5 — Unstructured Logging on Non-Error API Paths**

1.22 WHEN an API route completes successfully, THEN the system emits no structured log entry, making request tracing and performance analysis impossible without error-level events

**L6 — No Request Queuing for Slow Networks**

1.23 WHEN multiple API requests are triggered in rapid succession on a slow network, THEN the system fires all requests concurrently with no queue or backpressure mechanism

---

### Expected Behavior (Correct)

**C1 — Zoho Books Integration Removed**

2.1 WHEN the application is deployed, THEN the system SHALL contain no Zoho Books OAuth2 client, mapper, sync pipeline, API routes, or schema references, and all related env var documentation SHALL be removed

**C2 — API Client Retry with Exponential Backoff**

2.2 WHEN an API request fails with a transient network error (5xx, network failure), THEN the system SHALL automatically retry up to 3 times with exponential backoff (e.g., 500ms, 1000ms, 2000ms) before surfacing the error to the user

**C3 — Request Timeout via AbortController**

2.3 WHEN an API request is initiated, THEN the system SHALL attach an AbortController with a 30-second default timeout, automatically aborting and surfacing a timeout error if the request exceeds that duration

**C4 — Secret Rotation Verified**

2.4 WHEN `.env.local` git history is checked and a prior commit is found, THEN the system SHALL have all Clerk, Resend, and encryption keys rotated in their respective dashboards and the new keys applied to the deployment environment

**C5 — API Route Unit Tests Present**

2.5 WHEN the test suite runs, THEN the system SHALL include unit tests covering at minimum: companies route (auth enforcement, CRUD responses), forecast route (input validation, engine invocation), and import route (file validation, save behavior)

**H1 — auth-store.ts Deleted**

2.6 WHEN the codebase is built, THEN the system SHALL NOT include `src/stores/auth-store.ts`

**H2 — OnboardingWorkspace Migrated**

2.7 WHEN a user completes onboarding, THEN the system SHALL persist workspace state through the API-backed stores (`useCompanyStore`, `useAccountsStore`, `useForecastConfigStore`) and SHALL NOT write to `localStorage` via `workspace-store`

**H3 — WorkspaceBootstrapper Migrated**

2.8 WHEN the app bootstraps, THEN the system SHALL read accounts, value rules, timing profiles, and forecast months from the API-backed stores and SHALL NOT depend on `workspace-store` for runtime data

**H4 — WorkspaceConfigurationFile Type Extracted**

2.9 WHEN `src/lib/configuration.ts` is imported, THEN the system SHALL resolve `WorkspaceConfigurationFile` from a shared types file (e.g., `src/types/workspace.ts`) with no import dependency on `workspace-store`

**H5 — Server-Side Content-Type Validation**

2.10 WHEN a file is uploaded to the import endpoint, THEN the system SHALL inspect the first bytes of the file buffer to verify the actual file signature matches an allowed type (xlsx magic bytes or valid CSV text) before processing

**H6 — Deprecated Components Deleted**

2.11 WHEN the project is built, THEN the system SHALL NOT include any files under `src/components/_deprecated/`

**M1 — Dynamic Imports for Heavy Libraries**

2.12 WHEN the application first loads, THEN the system SHALL NOT include `exceljs`, `jspdf`, or `html2canvas` in the initial bundle; these SHALL be dynamically imported only at the point of use

**M2 — Optimistic UI Updates**

2.13 WHEN a user performs a mutation, THEN the system SHALL immediately reflect the change in the UI optimistically and roll back to the previous state only if the API call fails

**M3 — Request Abort on Unmount**

2.14 WHEN a component that triggered an API request is unmounted, THEN the system SHALL abort the in-flight request via AbortController and SHALL NOT update state after unmount

**M4 — Opening Balance Resolution from Imported Data**

2.15 WHEN the forecast engine runs with imported Balance Sheet data, THEN the system SHALL resolve `AR`, `AP`, `equity`, and `retainedEarnings` opening balances from the most recent imported period values instead of defaulting to zero

**M5 — Atomic Import Transactions**

2.16 WHEN a bulk import save operation encounters an error mid-write, THEN the system SHALL roll back all writes for that import batch, leaving the database in its pre-import state

**M6 — Playwright E2E Tests**

2.17 WHEN the test suite runs, THEN the system SHALL include Playwright E2E tests covering: new user onboarding flow, Excel/CSV import flow, forecast view rendering, and compliance calendar display

**L1 — PWA Offline Page**

2.18 WHEN a user with a cached PWA loses network connectivity and navigates to an uncached route, THEN the system SHALL display a branded offline page with a retry prompt

**L2 — Concurrent Write Conflict Resolution**

2.19 WHEN two sessions attempt to update the same value rule simultaneously, THEN the system SHALL detect the conflict using an optimistic concurrency token and notify the later writer that their change conflicts with a more recent update

**L3 — Lighthouse CI Gate**

2.20 WHEN a deployment is triggered, THEN the system SHALL run Lighthouse CI and fail the deploy if performance score drops below the configured threshold

**L4 — integrations Table Removed**

2.21 WHEN Zoho Books integration code is removed (C1), THEN the system SHALL also remove the `integrations` table from the Drizzle schema and generate a migration to drop it

**L5 — Structured Logging on All API Routes**

2.22 WHEN any API route completes (success or error), THEN the system SHALL emit a structured JSON log entry containing at minimum: route label, HTTP method, status code, and duration

**L6 — Request Queuing for Slow Networks**

2.23 WHEN multiple API requests are triggered in rapid succession on a slow network, THEN the system SHALL queue requests and enforce a concurrency limit to prevent network saturation

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user authenticates via Clerk, THEN the system SHALL CONTINUE TO enforce auth middleware on all non-public routes with no regression in access control

3.2 WHEN the forecast engine runs with valid accounts, value rules, and timing profiles, THEN the system SHALL CONTINUE TO produce deterministic three-way integrated forecasts satisfying `totalAssets === totalLiabilities + totalEquity`

3.3 WHEN Indian compliance calculations run (GST, TDS, PF, ESI, Advance Tax), THEN the system SHALL CONTINUE TO produce correct obligation amounts and calendar due dates

3.4 WHEN monetary values are stored or computed, THEN the system SHALL CONTINUE TO use integer paise throughout with no floating-point arithmetic

3.5 WHEN a user uploads an Excel or CSV file via the onboarding import flow, THEN the system SHALL CONTINUE TO parse, detect structure, map accounts, and generate a forecast

3.6 WHEN API routes receive invalid input, THEN the system SHALL CONTINUE TO return structured Zod validation errors with appropriate HTTP status codes

3.7 WHEN the application is deployed to Vercel region `bom1`, THEN the system SHALL CONTINUE TO serve all routes with Mumbai-region latency characteristics

3.8 WHEN a company is deleted, THEN the system SHALL CONTINUE TO cascade-delete all associated data via database FK constraints

3.9 WHEN the rate limiter is active, THEN the system SHALL CONTINUE TO enforce 100 req/min general and 10 req/hr import limits per user

3.10 WHEN Indian number formatting is applied, THEN the system SHALL CONTINUE TO display values in lakh/crore grouping (`12,34,567`) with `₹` prefix and parenthetical negatives

---

## Bug Condition Pseudocode

### C(X) — Bug Condition Functions

```pascal
FUNCTION isBugCondition_C1(X)
  INPUT: X = deployed application state
  OUTPUT: boolean
  RETURN EXISTS file IN X WHERE file.path MATCHES 'src/lib/integrations/zoho-books/*'
         OR EXISTS route IN X WHERE route.path MATCHES '/api/integrations/zoho/*'
END FUNCTION

FUNCTION isBugCondition_C2(X)
  INPUT: X = API request that receives a transient error response
  OUTPUT: boolean
  RETURN X.response.status >= 500 OR X.networkError = true
         AND X.retryCount = 0
END FUNCTION

FUNCTION isBugCondition_C3(X)
  INPUT: X = API request
  OUTPUT: boolean
  RETURN X.abortController = null AND X.timeoutMs = null
END FUNCTION

FUNCTION isBugCondition_H2_H3(X)
  INPUT: X = store write operation during onboarding or bootstrap
  OUTPUT: boolean
  RETURN X.targetStore = 'workspace-store' AND X.storageType = 'localStorage'
END FUNCTION

FUNCTION isBugCondition_M4(X)
  INPUT: X = forecast engine options
  OUTPUT: boolean
  RETURN X.openingBalances = null OR X.openingBalances.AR = 0
         AND X.importedData != null
END FUNCTION

FUNCTION isBugCondition_M5(X)
  INPUT: X = import save operation
  OUTPUT: boolean
  RETURN X.writeCount > 0 AND X.error != null AND X.rolledBack = false
END FUNCTION
```

### Fix Checking Properties

```pascal
// Property: C1 Fix — No Zoho integration files exist
FOR ALL X WHERE isBugCondition_C1(X) DO
  result ← scanCodebase'(X)
  ASSERT result.zohoFiles.count = 0
  ASSERT result.zohoRoutes.count = 0
END FOR

// Property: C2 Fix — Retry on transient failure
FOR ALL X WHERE isBugCondition_C2(X) DO
  result ← api'(X.url, X.options)
  ASSERT result.retryAttempts >= 1
  ASSERT result.retryAttempts <= 3
END FOR

// Property: C3 Fix — Request aborted after timeout
FOR ALL X WHERE isBugCondition_C3(X) DO
  result ← api'(X.url, X.options)
  ASSERT result.abortController != null
  ASSERT result.timeoutMs = 30000
END FOR

// Property: M5 Fix — No partial writes on failure
FOR ALL X WHERE isBugCondition_M5(X) DO
  stateBefore ← getDbState(X.companyId)
  importSave'(X)
  stateAfter ← getDbState(X.companyId)
  ASSERT stateBefore = stateAfter
END FOR
```

### Preservation Checking

```pascal
// Property: Preservation — forecast engine correctness unchanged
FOR ALL X WHERE NOT isBugCondition_M4(X) DO
  ASSERT runForecastEngine(X) = runForecastEngine'(X)
END FOR

// Property: Preservation — API auth enforcement unchanged
FOR ALL X WHERE X.request.authToken = null DO
  ASSERT api(X) = api'(X)  // both return 401
END FOR
```
