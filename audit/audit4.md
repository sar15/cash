I now have all the data needed. Here is the comprehensive audit report.

---

# CASHFLOWIQ API ROUTE AUDIT -- COMPLETE REPORT

---

## 1. INVENTORY OF ALL EXISTING API ROUTE FILES

Only **2 route files** exist in the entire `src/app/api/` tree:

| # | File Path |
|---|-----------|
| 1 | `/Users/sarhanak/Documents/CashFlowIQ/src/app/api/micro-forecasts/route.ts` |
| 2 | `/Users/sarhanak/Documents/CashFlowIQ/src/app/api/micro-forecasts/[id]/route.ts` |

The `src/app/api/` directory contains exactly one subdirectory: `micro-forecasts/`.

---

## 2. DETAILED ANALYSIS OF EACH EXISTING ROUTE

### ROUTE 1: `/src/app/api/micro-forecasts/route.ts`

| Attribute | Details |
|-----------|---------|
| **Path** | `/api/micro-forecasts` |
| **HTTP Methods** | `GET`, `POST` |
| **Clerk Auth** | YES -- `await auth()`, returns 401 if no `userId` |
| **Company Isolation** | YES -- Uses `resolveCompanyForUser(userId, companyId)` which verifies `company.clerkUserId === userId`, then filters by `company.id` in queries |
| **Input Validation (Zod)** | **NO** -- Uses TypeScript interfaces (`MicroForecastPayload`, `MicroForecastLinePayload`) with `as` cast. Zero runtime validation. |
| **Error Handling** | YES -- `try/catch` with `console.error` and 500 response |
| **Thin CRUD Rule** | YES -- Pure DB read/write, no business logic |
| **Business Logic on Server** | None |

**Security Issues:**
1. **No runtime input validation.** The `body` is cast with `as MicroForecastPayload` which provides no runtime safety. A malicious client can send arbitrary fields, wrong types, or missing required fields (`name`, `category`, `startMonth`).
2. **Inconsistent companyId source.** GET reads `companyId` from query params; POST reads it from the request body. The PRD2 spec requires it as a path parameter.
3. **No request body size limit.** The `lines` array has no length cap -- a client could send thousands of lines.
4. **No rate limiting.**
5. **`wizardConfig` serialization is permissive.** `JSON.stringify(wizardConfig || {})` will accept any object shape.

---

### ROUTE 2: `/src/app/api/micro-forecasts/[id]/route.ts`

| Attribute | Details |
|-----------|---------|
| **Path** | `/api/micro-forecasts/[id]` |
| **HTTP Methods** | `PATCH`, `DELETE` |
| **Clerk Auth** | YES -- `await auth()`, returns 401 if no `userId` |
| **Company Isolation** | PARTIAL -- Checks ownership indirectly: fetches forecast by `id` without company filter first, then fetches its company, then checks `company.clerkUserId !== userId`. Secure but inefficient. |
| **Input Validation (Zod)** | **NO** -- TypeScript interfaces only. PATCH allows arbitrary partial updates with no runtime validation. |
| **Error Handling** | YES -- `try/catch` with `console.error` and 500 response |
| **Thin CRUD Rule** | YES -- Pure DB update/delete, no business logic |
| **Business Logic on Server** | None |

**Security Issues:**
1. **No runtime input validation.** PATCH body is fully trusted. Missing `name`, `category`, or `startMonth` fields would write `undefined` to the database (Drizzle may handle this, but it's fragile).
2. **Indirect ownership check.** The route fetches the forecast first without any company filter, then checks ownership. This is a less robust pattern than filtering by company_id from the start. If the ownership check is ever accidentally removed during refactoring, it becomes an IDOR vulnerability.
3. **DELETE relies on implicit cascade.** The `microForecastLines` deletion relies on `onDelete: 'cascade'` in the schema definition. While correct, this is implicit and could break if the schema changes.
4. **PATCH replaces all lines via delete+insert.** The line replacement strategy (delete all lines, then insert new ones) means a partial failure between delete and insert would result in data loss. This should be in a transaction.
5. **No rate limiting.**
6. **Path structure deviates from PRD2.** PRD2 specifies `/api/micro-forecasts/:companyId/:id`. This route uses `/api/micro-forecasts/[id]` with no companyId in the path.

---

## 3. MIDDLEWARE ANALYSIS

### File: `/Users/sarhanak/Documents/CashFlowIQ/src/proxy.ts`

This file implements Clerk middleware correctly:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)', '/forecast(.*)', '/scenarios(.*)',
  '/data(.*)', '/settings(.*)', '/reports(.*)',
  '/compliance(.*)', '/accounts(.*)',
  '/api/((?!webhooks).*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) { await auth.protect() }
})
```

### CRITICAL ISSUE: File is Named `proxy.ts`, NOT `middleware.ts`

**Next.js only recognizes middleware from files named `middleware.ts` at the project root or `src/` directory.** The file `src/proxy.ts` will NOT be loaded by Next.js as middleware. There is no `src/middleware.ts` or root `middleware.ts` file anywhere in the project. The `next.config.ts` does not remap middleware.

**Impact:**
- The Clerk middleware route protection is **completely inactive**.
- All API routes lack the middleware-level auth guard.
- All protected pages (dashboard, forecast, scenarios, data, settings, reports, compliance, accounts) lack middleware-level redirects for unauthenticated users.
- The individual API route handlers DO call `auth()` directly, so API data is still protected at the handler level. But the defense-in-depth middleware layer is missing.
- **Fix: Rename `src/proxy.ts` to `src/middleware.ts`.**

---

## 4. "THIN API" PRINCIPLE COMPLIANCE

The two existing routes **do follow** the "thin CRUD only" rule. They perform:
- SELECT queries (GET)
- INSERT queries (POST)
- UPDATE + DELETE + INSERT queries (PATCH with line replacement)
- DELETE queries (DELETE)

**No business logic** (forecast calculations, compliance engine, etc.) runs on the server. The forecast engine correctly runs client-side as specified in PRD2.

---

## 5. CROSS-CUTTING SECURITY CONCERNS

| Concern | Status | Details |
|---------|--------|---------|
| **Middleware active** | BROKEN | `proxy.ts` not recognized by Next.js |
| **Zod/runtime validation** | ABSENT | All 2 routes use only TypeScript types |
| **Rate limiting** | ABSENT | No rate limiting on any endpoint |
| **Request body size limit** | ABSENT | No limits on payload size |
| **Consistent auth pattern** | YES | Both routes use `await auth()` directly |
| **Company isolation in DB queries** | INCONSISTENT | Route 1 uses `resolveCompanyForUser()`, Route 2 uses indirect lookup |
| **Transaction safety** | NO | Route 2's delete-all-then-insert-lines is not wrapped in a transaction |
| **CORS** | DEFAULT | Next.js API routes default to same-origin only |

---

## 6. MISSING ROUTES -- PRD2 SPEC COMPARISON

PRD2 specifies 20+ route paths (with multiple HTTP methods on some). Here is the full comparison:

### EXISTING vs. PRD2

| PRD2 Route | HTTP Methods | Status |
|------------|-------------|--------|
| **AUTH ROUTES** | | |
| `POST /api/auth/signup` | POST | **MISSING** -- Clerk handles this via UI (sign-up page exists at `src/app/(auth)/sign-up/`), but no custom API route |
| `POST /api/auth/login` | POST | **MISSING** -- Clerk handles this via UI (sign-in page exists at `src/app/(auth)/sign-in/`), but no custom API route |
| **COMPANY ROUTES** | | |
| `GET /api/companies` | GET | **MISSING** |
| `POST /api/companies` | POST | **MISSING** |
| `PATCH /api/companies/:id` | PATCH | **MISSING** |
| `DELETE /api/companies/:id` | DELETE | **MISSING** |
| **IMPORT ROUTES** | | |
| `POST /api/import/upload` | POST | **MISSING** |
| `POST /api/import/parse` | POST | **MISSING** |
| `POST /api/import/save` | POST | **MISSING** |
| `GET /api/import/template` | GET | **MISSING** |
| **COA ROUTES** | | |
| `GET /api/coa/:companyId` | GET | **MISSING** |
| `PATCH /api/coa/:companyId/:id` | PATCH | **MISSING** |
| `DELETE /api/coa/:companyId/:id` | DELETE | **MISSING** |
| **HISTORICAL ROUTES** | | |
| `GET /api/historical/:companyId` | GET | **MISSING** |
| `PATCH /api/historical/:companyId` | PATCH | **MISSING** |
| **FORECAST CONFIG ROUTES** | | |
| `GET /api/forecast/config/:companyId` | GET | **MISSING** |
| `PATCH /api/forecast/config/value-rule` | PATCH | **MISSING** |
| `PATCH /api/forecast/config/timing-profile` | PATCH | **MISSING** |
| `PATCH /api/forecast/config/compliance` | PATCH | **MISSING** |
| `PATCH /api/forecast/config/metrics` | PATCH | **MISSING** |
| **MICRO-FORECAST ROUTES** | | |
| `GET /api/micro-forecasts/:companyId` | GET | **PARTIAL** -- Exists as `/api/micro-forecasts` (companyId in query param, not path) |
| `POST /api/micro-forecasts/:companyId` | POST | **PARTIAL** -- Exists as `/api/micro-forecasts` (companyId in body, not path) |
| `PATCH /api/micro-forecasts/:companyId/:id` | PATCH | **PARTIAL** -- Exists as `/api/micro-forecasts/[id]` (no companyId in path) |
| `DELETE /api/micro-forecasts/:companyId/:id` | DELETE | **PARTIAL** -- Exists as `/api/micro-forecasts/[id]` (no companyId in path) |
| `PATCH /api/micro-forecasts/:companyId/:id/toggle` | PATCH | **MISSING** -- Toggle is done via the existing PATCH route, not a dedicated endpoint |
| **SCENARIO ROUTES** | | |
| `GET /api/scenarios/:companyId` | GET | **MISSING** |
| `POST /api/scenarios/:companyId` | POST | **MISSING** |
| `PATCH /api/scenarios/:companyId/:id` | PATCH | **MISSING** |
| `DELETE /api/scenarios/:companyId/:id` | DELETE | **MISSING** |
| `POST /api/scenarios/:companyId/:id/overrides` | POST | **MISSING** |
| **FORECAST RESULT ROUTES** | | |
| `GET /api/forecast/result/:companyId` | GET | **MISSING** |
| `POST /api/forecast/result/:companyId` | POST | **MISSING** |
| **REPORT ROUTES** | | |
| `GET /api/reports/branding/:companyId` | GET | **MISSING** |

### SUMMARY OF MISSING ROUTES

| Category | PRD2 Required | Implemented | Missing |
|----------|--------------|-------------|---------|
| Auth | 2 | 0 (Clerk UI handles it) | 2 |
| Companies | 4 | 0 | 4 |
| Import | 4 | 0 | 4 |
| COA | 3 | 0 | 3 |
| Historical | 2 | 0 | 2 |
| Forecast Config | 5 | 0 | 5 |
| Micro-Forecasts | 5 | 4 (with structural deviations) | 1 (toggle) |
| Scenarios | 5 | 0 | 5 |
| Forecast Result | 2 | 0 | 2 |
| Reports | 1 | 0 | 1 |
| **TOTAL** | **33** | **4** | **29** |

---

## 7. STRUCTURAL DEVIATIONS FROM PRD2

The existing micro-forecasts routes deviate from the PRD2 spec in path structure:

| PRD2 Spec | Actual Implementation |
|-----------|----------------------|
| `GET /api/micro-forecasts/:companyId` | `GET /api/micro-forecasts?companyId=...` |
| `POST /api/micro-forecasts/:companyId` | `POST /api/micro-forecasts` (companyId in body) |
| `PATCH /api/micro-forecasts/:companyId/:id` | `PATCH /api/micro-forecasts/:id` |
| `DELETE /api/micro-forecasts/:companyId/:id` | `DELETE /api/micro-forecasts/:id` |

The PRD2 spec uses `companyId` as a path parameter consistently across all routes. The existing routes use a mix of query params, body params, and path params.

---

## 8. AUTH ROUTE CLARIFICATION

The PRD2 spec calls for `POST /api/auth/signup` and `POST /api/auth/login`. The project uses **Clerk** for auth instead, with Clerk's built-in sign-in/sign-up UI pages at:
- `/Users/sarhanak/Documents/CashFlowIQ/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- `/Users/sarhanak/Documents/CashFlowIQ/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`

These are **not API routes** -- they render Clerk's pre-built components. Since Clerk handles auth server-side, custom `/api/auth/*` routes are technically unnecessary. However, if the PRD2 spec is being strictly followed, these routes would need to be created as wrappers around Clerk's API or replaced with custom JWT auth.

---

## 9. PRIORITY REMEDIATION LIST

### Critical (Security)
1. **Rename `src/proxy.ts` to `src/middleware.ts`** -- Middleware is currently inactive
2. **Add Zod validation** to all existing (and future) API routes
3. **Wrap the PATCH delete-all-lines-then-insert in a database transaction**

### High (Missing Infrastructure)
4. Create `/api/companies` route (GET, POST, PATCH, DELETE) -- foundational for all other routes
5. Create `/api/coa/[companyId]` route (GET, PATCH, DELETE)
6. Create `/api/historical/[companyId]` route (GET, PATCH)
7. Create `/api/import/upload`, `/api/import/parse`, `/api/import/save`, `/api/import/template` routes
8. Create `/api/forecast/config/[companyId]` route and sub-routes for value-rule, timing-profile, compliance, metrics
9. Create `/api/scenarios/[companyId]` route (GET, POST, PATCH, DELETE, overrides)
10. Create `/api/forecast/result/[companyId]` route (GET, POST)
11. Create `/api/reports/branding/[companyId]` route (GET)

### Medium (Consistency)
12. Restructure micro-forecasts routes to use `companyId` as a path parameter per PRD2 spec
13. Add dedicated `/api/micro-forecasts/[companyId]/[id]/toggle` endpoint
14. Standardize the ownership check pattern across all routes (prefer `resolveCompanyForUser` over indirect lookup)
15. Add request body size limits

### Low (Hardening)
16. Add rate limiting
17. Add request logging/audit trail
18. Standardize error response format (currently returns plain text; should return JSON)

---

**Bottom line: Only 4 out of 33 required API endpoints exist (12%), the middleware is broken due to incorrect filename, and zero routes have runtime input validation.**