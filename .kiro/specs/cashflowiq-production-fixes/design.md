# CashFlowIQ Production Fixes — Bugfix Design

## Overview

This document formalizes the fix approach for 15 production issues found in CashFlowIQ. The bugs
span five categories:

- **Broken interactions** (Bugs 1, 15): UI events that never fire; missing variance view
- **Data integrity** (Bugs 2, 3, 13): Duplicate rows, doubled amounts, client-only persistence
- **Auth / access control** (Bugs 4, 5): Members blocked; notification counts wrong
- **Infrastructure / ops** (Bugs 6, 8, 9, 10, 11, 12): Stale files, per-instance rate limiting,
  missing env wiring, missing error monitoring
- **Code quality** (Bug 7): Unused variables causing TypeScript hints
- **Missing features** (Bugs 14): No invite API despite schema being ready

The fix strategy is minimal and targeted: each change touches only the code identified in the root
cause analysis, preserves all existing API contracts, and degrades gracefully when optional
infrastructure (Upstash, Sentry, Inngest) is absent.

---

## Glossary

- **Bug_Condition (C)**: The predicate that identifies inputs or states that trigger a specific bug
- **Property (P)**: The desired correct behavior when the bug condition holds
- **Preservation**: Existing behaviors that must remain byte-for-byte identical after the fix
- **SubmitBtn**: The shared submit button component in `MicroForecastWizard.tsx` that lacked an
  `onClick` prop
- **upsertTimingProfile**: The DB query in `forecast-config.ts` that was missing
  `onConflictDoUpdate`
- **pfMonth**: A `PFESIForecastMonth` object returned by the compliance engine containing
  pre-computed correct deposit amounts
- **requireOwnedCompany**: Auth helper that only checked direct ownership, ignoring members
- **requireAccessibleCompany**: New auth helper (to be added) that checks ownership OR accepted
  membership via `canAccessCompany()`
- **canAccessCompany**: Existing helper in `company-members.ts` that checks both ownership and
  accepted membership — already correct, just not wired into auth routes
- **getUnreadCount**: Notification query that filtered only on `companyId`, ignoring `clerkUserId`
- **isBugCondition**: Pseudocode function used throughout this document to formally specify when
  each bug manifests

---

## Bug Details

### Bug 1 — SubmitBtn onClick Not Forwarded

The bug manifests when any of the six wizard forms (HireForm, RevenueForm, AssetForm, LoanForm,
ExpenseForm, PriceChangeForm) renders a `<SubmitBtn>` with an `onClick` prop. Because `SubmitBtn`
does not declare `onClick` in its props interface, TypeScript silently drops the prop and the
underlying `<button>` element has no click handler.

**Formal Specification:**
```
FUNCTION isBugCondition_1(X)
  INPUT: X of type { component: 'SubmitBtn', props: object }
  OUTPUT: boolean

  RETURN 'onClick' IN X.props
         AND SubmitBtn.propTypes does NOT include 'onClick'
END FUNCTION
```

**Examples:**
- HireForm renders `<SubmitBtn onClick={() => onSubmit(...)} .../>` — click does nothing
- RevenueForm renders `<SubmitBtn onClick={() => onSubmit(...)} .../>` — click does nothing
- All 6 forms are affected identically

### Bug 2 — upsertTimingProfile Creates Duplicates

The bug manifests when `upsertTimingProfile` is called for a `(companyId, name)` pair that already
exists. The plain `.insert()` with no conflict clause creates a new row every time.

**Formal Specification:**
```
FUNCTION isBugCondition_2(X)
  INPUT: X of type { companyId: string, name: string }
  OUTPUT: boolean

  RETURN COUNT(*) FROM timing_profiles
         WHERE company_id = X.companyId AND name = X.name
         >= 1
END FUNCTION
```

**Examples:**
- Saving "Monthly Uniform" timing profile twice → 2 rows with identical `(companyId, name)`
- AccountRuleEditor auto-saves on every change → N saves = N duplicate rows

### Bug 3 — Compliance Page Doubles PF/ESI

The bug manifests whenever `pfMonth` is non-null. The compliance page applies `* 2` to values that
the engine already returns as the correct total deposit.

**Formal Specification:**
```
FUNCTION isBugCondition_3(X)
  INPUT: X of type PFESIForecastMonth
  OUTPUT: boolean

  RETURN X IS NOT NULL
END FUNCTION
```

**Examples:**
- Engine returns `employerPF = ₹9,000` → page displays `₹18,000` (doubled)
- Engine returns `employerESI + employeeESI = ₹3,250` → page displays `₹6,500` (doubled)

### Bug 4 — requireOwnedCompany Ignores Members

The bug manifests when a user who is an accepted member (but not the owner) calls any API route
that uses `requireOwnedCompany`.

**Formal Specification:**
```
FUNCTION isBugCondition_4(X)
  INPUT: X of type { userId: string, companyId: string }
  OUTPUT: boolean

  company ← getCompanyById(X.companyId)
  RETURN company.clerkUserId ≠ X.userId
         AND EXISTS accepted member row WHERE
             company_id = X.companyId AND clerk_user_id = X.userId
             AND accepted_at IS NOT NULL
END FUNCTION
```

**Examples:**
- Editor member calls `GET /api/companies/[id]` → 401 Unauthorized (should be 200)
- Viewer member calls any read route → 401 (should be 200)

### Bug 5 — getUnreadCount Ignores clerkUserId

The bug manifests when a company has unread notifications targeted at a specific user other than
the caller.

**Formal Specification:**
```
FUNCTION isBugCondition_5(X)
  INPUT: X of type { companyId: string, clerkUserId: string }
  OUTPUT: boolean

  RETURN EXISTS unread notification WHERE
             company_id = X.companyId
             AND read_at IS NULL
             AND clerk_user_id IS NOT NULL
             AND clerk_user_id ≠ X.clerkUserId
END FUNCTION
```

**Examples:**
- User A has 0 unread; User B has 5 unread targeted notifications → `getUnreadCount(co, userA)`
  returns 5 instead of 0

### Bug 6 — Stale SW Files in public/

next-pwa generates `sw.js` and `workbox-*.js` on each build. Old files accumulate because
`.gitignore` previously had no entries for them. Currently 10 stale files are committed.

**Formal Specification:**
```
FUNCTION isBugCondition_6(X)
  INPUT: X of type { file: string }
  OUTPUT: boolean

  RETURN X.file MATCHES 'public/sw*.js' OR 'public/workbox-*.js'
         AND X.file IS tracked by git
END FUNCTION
```

### Bug 7 — Unused Variables in ForecastGrid

Five symbols are declared but never consumed: `formatRupees`, `accounts` (in `DriversView`), `n`,
`burnRate`, and `prev` (in tone callbacks).

**Formal Specification:**
```
FUNCTION isBugCondition_7(X)
  INPUT: X of type { symbol: string, file: 'ForecastGrid.tsx' }
  OUTPUT: boolean

  RETURN X.symbol IN ['formatRupees', 'accounts', 'n', 'burnRate', 'prev']
         AND X.symbol is declared but value is never read
END FUNCTION
```

### Bug 8 — Rate Limiting Per-Instance

The in-memory `Map` in `middleware.ts` is not shared across Vercel serverless instances. Each cold
start resets all counters.

**Formal Specification:**
```
FUNCTION isBugCondition_8(X)
  INPUT: X of type { environment: string }
  OUTPUT: boolean

  RETURN X.environment = 'production'
         AND UPSTASH_REDIS_REST_URL IS NULL
         AND rate limiter uses in-memory Map
END FUNCTION
```

### Bug 9 — Inngest Keys Missing — No Warning

When `INNGEST_EVENT_KEY` or `INNGEST_SIGNING_KEY` are absent in production, background jobs
silently fail with no operator-visible warning.

### Bug 10 — Clerk Webhook Secret — Documentation Only

The code already handles missing `CLERK_WEBHOOK_SECRET` gracefully. The fix is documentation only:
`.env.example` needs step-by-step instructions.

### Bug 11 — RESEND_FROM_EMAIL Test Domain — Documentation Only

`onboarding@resend.dev` is Resend's shared test domain. The fix is a clear warning in `.env.example`.

### Bug 12 — No Sentry

No error monitoring is installed. Unhandled exceptions in production are invisible.

### Bug 13 — Compliance Paid Status in localStorage

Paid status is stored only in the browser. It is lost on data clear and not shared across team
members.

**Formal Specification:**
```
FUNCTION isBugCondition_13(X)
  INPUT: X of type { storage: string }
  OUTPUT: boolean

  RETURN X.storage = 'localStorage'
         AND paid status is NOT persisted server-side
END FUNCTION
```

### Bug 14 — No Multi-User Invite API

The `company_members` table and `addMember()` query exist but no API endpoint or UI exposes them.

### Bug 15 — No Variance Analysis View

The ForecastGrid has P&L, BS, CF, and Drivers views but no Variance view comparing actuals to
forecast.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All six wizard forms continue to call the correct store action with the same typed payload shape
- `upsertTimingProfile` continues to insert a new row when `(companyId, name)` does not yet exist
- GST, TDS, and advance tax amounts on the compliance page are displayed without modification
- The company owner (Clerk user who created the company) continues to be granted access without
  requiring a `company_members` row
- `getNotifications` continues to return notifications targeted at the specific user OR broadcast
  (where `clerkUserId IS NULL`)
- The application continues to generate a valid service worker and workbox runtime for PWA
- ForecastGrid P&L, BS, CF, and Drivers views continue to display all existing rows correctly
- When Upstash env vars are absent, rate limiting continues via the in-memory fallback
- When Inngest keys are absent, all non-background-job routes continue to serve normally
- When `CLERK_WEBHOOK_SECRET` is absent in development, webhook verification is skipped silently
- When `RESEND_API_KEY` is absent, email sending is skipped silently
- When Sentry DSN is absent, the application functions normally without Sentry
- Existing `cashflowiq_paid_compliance` localStorage data is respected during migration
- Write operations (create, update, delete) continue to require at minimum the `editor` role
- The Variance view is additive — it does not replace existing views
- All monetary values remain integer paise throughout
- The forecast engine remains pure (no DB calls inside `runForecastEngine()`)
- The balance sheet invariant `totalAssets === totalLiabilities + totalEquity` is preserved
- Period values continue to use `YYYY-MM-01` format exclusively

**Scope:**
All inputs that do NOT match the specific bug conditions above are completely unaffected by these
fixes. Each fix is surgical and isolated to the identified root cause.

---

## Hypothesized Root Cause

### Bug 1
`SubmitBtn` was written without an `onClick` prop because the original intent may have been to wrap
each form in a `<form onSubmit>` element. That refactor never happened, and `// @ts-ignore` was
used as a workaround that TypeScript silently discards.

### Bug 2
`upsertTimingProfile` was written without a unique constraint on `(company_id, name)` in the
schema, so there was no conflict target to use with `onConflictDoUpdate`. The constraint was simply
never added.

### Bug 3
The `* 2` multiplier was likely added under the incorrect assumption that `employerPF` was only the
employer half and needed to be doubled to include the employee contribution. In reality,
`employerPF` is the full employer deposit and `employerESI + employeeESI` is already the total ESI
deposit.

### Bug 4
`requireOwnedCompany` predates the `company_members` table. When multi-user support was added, the
new `canAccessCompany()` helper was written but the existing auth helper was not updated to use it.

### Bug 5
`getUnreadCount` was written before targeted notifications (non-null `clerkUserId`) were
implemented. The `clerkUserId` parameter was added to the function signature but the query was
never updated to filter on it.

### Bug 6
`.gitignore` entries for next-pwa outputs were simply never added. The files were committed
manually at some point and accumulated across builds.

### Bug 7
`formatRupees` was written for the Drivers view but the view was later refactored to use
`formatPct` and `formatDays` only. `accounts` in `DriversView` was destructured from props but the
component accesses `engineResult` directly. `n`, `burnRate`, and `prev` are leftover from
incomplete implementations.

### Bug 8
The in-memory rate limiter was explicitly documented as a known limitation in a comment. The
`@upstash/ratelimit` and `@upstash/redis` packages are already in `package.json` but were never
wired up.

### Bug 9
Inngest keys were added to `env.ts` as optional but no warning was added for the production case
where they are required for compliance reminders to fire.

### Bugs 10, 11
Documentation gaps — the code handles missing values gracefully but `.env.example` does not guide
operators on how to obtain and configure these values.

### Bug 12
Sentry was never installed. The project was bootstrapped without it.

### Bug 13
The compliance page was built with localStorage as a quick MVP. The `compliance_payments` table
was never created.

### Bug 14
The `company_members` table and queries were built but the API layer and UI were never wired up.

### Bug 15
The Variance view was planned but never implemented. `ViewSwitcher` only has four tabs.

---

## Correctness Properties

Property 1: Bug Condition — SubmitBtn Forwards onClick

_For any_ `SubmitBtn` rendered with an `onClick` prop, the fixed component SHALL forward that
handler to the underlying `<button>` element so that clicking the button invokes the handler.

**Validates: Requirements 2.1**

Property 2: Preservation — Wizard Payload Shape Unchanged

_For any_ wizard form submission where the bug condition does NOT hold (i.e., the button click
fires correctly), the fixed code SHALL call the same store action with the same typed payload as
before the fix.

**Validates: Requirements 3.1**

Property 3: Bug Condition — upsertTimingProfile No Duplicates

_For any_ call to `upsertTimingProfile` where a row with the same `(companyId, name)` already
exists, the fixed function SHALL update the existing row and the total row count for that
`(companyId, name)` pair SHALL remain exactly 1.

**Validates: Requirements 2.2**

Property 4: Preservation — upsertTimingProfile New Row Insert

_For any_ call to `upsertTimingProfile` where no row with that `(companyId, name)` exists, the
fixed function SHALL insert exactly one new row (same as before).

**Validates: Requirements 3.2**

Property 5: Bug Condition — Compliance PF Amount Not Doubled

_For any_ `PFESIForecastMonth` where `employerPF > 0`, the fixed compliance page SHALL display
`pfAmount === pfMonth.employerPF` (not `pfMonth.employerPF * 2`).

**Validates: Requirements 2.3**

Property 6: Bug Condition — Compliance ESI Amount Not Doubled

_For any_ `PFESIForecastMonth` where `employerESI + employeeESI > 0`, the fixed compliance page
SHALL display `esiAmount === pfMonth.employerESI + pfMonth.employeeESI` (not multiplied by 2).

**Validates: Requirements 2.3**

Property 7: Preservation — GST/TDS/Advance Tax Amounts Unchanged

_For any_ compliance month, the fixed page SHALL display GST, TDS, and advance tax amounts
identical to the engine output with no multiplier applied.

**Validates: Requirements 3.3**

Property 8: Bug Condition — requireAccessibleCompany Grants Member Access

_For any_ `(userId, companyId)` where the user is an accepted member but not the owner, the fixed
`requireAccessibleCompany` function SHALL return the company without throwing a 401.

**Validates: Requirements 2.4**

Property 9: Preservation — Owner Access Unchanged

_For any_ `(userId, companyId)` where `company.clerkUserId === userId`, the fixed auth helper
SHALL continue to grant access (same as `requireOwnedCompany`).

**Validates: Requirements 3.4**

Property 10: Bug Condition — getUnreadCount Filters by User

_For any_ `(companyId, clerkUserId)` where unread notifications exist for other users, the fixed
`getUnreadCount` SHALL return only the count of notifications where `clerkUserId IS NULL` OR
`clerkUserId = ?` (the caller's ID).

**Validates: Requirements 2.5**

Property 11: Preservation — getNotifications Behavior Unchanged

_For any_ call to `getNotifications`, the fixed code SHALL continue to return notifications
targeted at the specific user OR broadcast (where `clerkUserId IS NULL`).

**Validates: Requirements 3.5**

---

## Fix Implementation

### Bug 1 — MicroForecastWizard.tsx

**File:** `src/components/forecast/MicroForecastWizard.tsx`

**Changes:**
1. Add `onClick?: () => void` to `SubmitBtn` props interface
2. Forward `onClick` to the underlying `<button>` element: `<button onClick={onClick} ...>`
3. Remove all 6 `// @ts-ignore` comments from HireForm, RevenueForm, AssetForm, LoanForm,
   ExpenseForm, PriceChangeForm

### Bug 2 — schema.ts + forecast-config.ts + migration

**File:** `src/lib/db/schema.ts`
1. Add `uniqueIndex('idx_timing_profiles_company_name').on(table.companyId, table.name)` to the
   `timingProfiles` table definition

**File:** `src/lib/db/queries/forecast-config.ts`
1. Add `.onConflictDoUpdate({ target: [schema.timingProfiles.companyId, schema.timingProfiles.name], set: { profileType, config, autoDerived, isDefault } })` to `upsertTimingProfile`

**File:** `drizzle/0003_timing_profile_unique.sql` (new)
1. `CREATE UNIQUE INDEX IF NOT EXISTS idx_timing_profiles_company_name ON timing_profiles(company_id, name);`

### Bug 3 — compliance/page.tsx

**File:** `src/app/(app)/compliance/page.tsx`

**Changes (lines ~108-115):**
1. Change `amount: pfAmount * 2` → `amount: pfAmount`
2. Change `amount: esiAmount * 2` → `amount: esiAmount`

Note: `pfAmount` is already `pfMonth.employerPF` and `esiAmount` is already
`pfMonth.employerESI + pfMonth.employeeESI` — both are the correct total deposit values.

### Bug 4 — auth.ts

**File:** `src/lib/server/auth.ts`

**Changes:**
1. Import `canAccessCompany` from `@/lib/db/queries/company-members`
2. Add new exported function `requireAccessibleCompany(userId, companyId)`:
   - Gets company via `getCompanyById`
   - Throws 404 if not found
   - Calls `canAccessCompany(companyId, userId)`
   - Throws 401 if false
   - Returns company
3. Keep `requireOwnedCompany` unchanged for write operations

Read-only API routes that should use `requireAccessibleCompany` instead of `requireOwnedCompany`:
- `GET /api/companies/[id]`

### Bug 5 — notifications.ts

**File:** `src/lib/db/queries/notifications.ts`

**Changes:**
1. Import `or` from `drizzle-orm`
2. Update `getUnreadCount` query to add filter:
   `or(isNull(schema.notifications.clerkUserId), eq(schema.notifications.clerkUserId, clerkUserId))`

### Bug 6 — .gitignore + delete stale files

**File:** `.gitignore`
- Already has the correct entries (confirmed in current file). No change needed.

**Action:** Delete all stale committed SW files from `public/`:
- `public/sw 2.js` through `public/sw 10.js` and any `workbox-*.js` duplicates

### Bug 7 — ForecastGrid.tsx

**File:** `src/components/forecast/ForecastGrid.tsx`

**Changes:**
1. Remove `formatRupees` function declaration entirely
2. Remove `accounts` from `DriversView` props destructuring (it is not used; `engineResult` is
   used directly)
3. Remove `const n = forecastMonths.length` from `DriversView`
4. Add `burnRate` as a rendered row in the Drivers table (it is a meaningful metric — burn rate
   when OCF is negative)
5. Replace `(v, prev)` with `(v, _prev)` in tone callbacks where `prev` is unused, or remove the
   parameter where the signature allows it

### Bug 8 — middleware.ts + .env.example

**File:** `src/middleware.ts`

**Changes:**
1. Import `Ratelimit` from `@upstash/ratelimit` and `Redis` from `@upstash/redis`
2. Construct `upstashRedis` conditionally on env vars being present
3. Construct `upstashLimiter` conditionally on `upstashRedis` being non-null
4. In the rate-limit check paths, try `upstashLimiter` first; fall back to `checkRateLimit` if
   `upstashLimiter` is null

**File:** `.env.example`
1. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` with instructions

### Bug 9 — env.ts + .env.example

**File:** `src/lib/server/env.ts`

**Changes:**
1. After the `env` object is constructed, add:
```ts
if (isProduction && (!process.env.INNGEST_EVENT_KEY || !process.env.INNGEST_SIGNING_KEY)) {
  console.warn('[CashFlowIQ] INNGEST_EVENT_KEY or INNGEST_SIGNING_KEY missing — background jobs disabled')
}
```

**File:** `.env.example`
1. Add clear instructions for obtaining Inngest keys

### Bugs 10, 11 — .env.example only

**File:** `.env.example`
1. Add step-by-step instructions for `CLERK_WEBHOOK_SECRET`
2. Add warning that `onboarding@resend.dev` is a test domain

### Bug 12 — Sentry

**Files:** `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`,
`next.config.ts`, `.env.example`, `package.json`

**Changes:**
1. Add `@sentry/nextjs` to `package.json` dependencies
2. Create three Sentry config files — each initializes Sentry only when `SENTRY_DSN` is set
3. Wrap `next.config.ts` export with `withSentryConfig`
4. Add `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` to `.env.example`

### Bug 13 — compliance_payments table + API + page

**Files:** `src/lib/db/schema.ts`, `drizzle/0004_compliance_payments.sql`,
`src/app/api/compliance/payments/route.ts`,
`src/app/api/compliance/payments/[id]/route.ts`,
`src/app/(app)/compliance/page.tsx`

**Changes:**
1. Add `compliancePayments` table to schema with columns: `id`, `companyId`, `clerkUserId`,
   `obligationId`, `paidAt`, `createdAt`
2. Generate migration SQL
3. Add `GET /api/compliance/payments?companyId=` — list paid obligation IDs for a company
4. Add `POST /api/compliance/payments` — mark obligation as paid
5. Add `DELETE /api/compliance/payments/[id]` — unmark
6. Update compliance page to fetch paid status from API; keep localStorage as fallback during
   migration (merge API results with localStorage)

### Bug 14 — members API + settings UI

**Files:** `src/app/api/companies/[id]/members/route.ts`,
`src/app/(app)/settings/page.tsx`

**Changes:**
1. Add `GET /api/companies/[id]/members` — list members (owner only)
2. Add `POST /api/companies/[id]/members` — invite member by Clerk user ID (owner only)
3. Add `DELETE /api/companies/[id]/members` with `?clerkUserId=` — remove member (owner only)
4. Add "Team Members" section to Settings page with member list and invite input

### Bug 15 — Variance view

**Files:** `src/components/forecast/ViewSwitcher.tsx`,
`src/components/forecast/ForecastGrid.tsx`,
`src/app/(app)/forecast/page.tsx`

**Changes:**
1. Add `'variance'` to `ViewType` union in `ViewSwitcher.tsx`
2. Add "Variance" tab to the `views` array
3. Add `buildVarianceRows()` function in `ForecastGrid.tsx`:
   - Accepts `accounts`, `engineResult`, `actuals` (map of accountId → period → amount), `monthCount`
   - For each P&L account, for each month: if actual exists, compute `actual - forecast`; else `null`
   - Returns `GridRow[]` with variance values
4. Pass `actuals` data from `useActualsStore` into `ForecastGrid` when `view === 'variance'`
5. Color-code cells: green when `actual > forecast` (better), red when `actual < forecast` (worse)

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate
the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.
Property-based tests are used where the input space is large (Bugs 2, 3, 5). Unit tests cover the
remaining bugs.

### Exploratory Bug Condition Checking

**Goal:** Surface counterexamples that demonstrate each bug BEFORE implementing the fix. Confirm
or refute the root cause analysis.

**Bug 1 — SubmitBtn:**
- Render `<SubmitBtn onClick={mockFn} .../>` and simulate a click
- Assert `mockFn` was NOT called (confirms bug on unfixed code)
- After fix: assert `mockFn` IS called

**Bug 2 — upsertTimingProfile:**
- Call `upsertTimingProfile(companyId, { name: 'X', ... })` twice
- Assert row count is 2 (confirms bug on unfixed code)
- After fix: assert row count is 1

**Bug 3 — PF/ESI doubled:**
- Render compliance page with a known `pfMonth` where `employerPF = 9000`
- Assert displayed PF amount is 18000 (confirms bug on unfixed code)
- After fix: assert displayed PF amount is 9000

**Bug 5 — getUnreadCount:**
- Insert 3 unread notifications for userB in companyX
- Call `getUnreadCount(companyX, userA)`
- Assert result is 3 (confirms bug on unfixed code)
- After fix: assert result is 0

### Fix Checking

**Pseudocode (Bugs 1, 3, 5):**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Pseudocode (Bug 2):**
```
FOR ALL (companyId, name) WHERE row already exists DO
  rowsBefore := COUNT(*)
  upsertTimingProfile_fixed(companyId, { name, ... })
  rowsAfter := COUNT(*)
  ASSERT rowsAfter = rowsBefore
END FOR
```

### Preservation Checking

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT fixedFunction(input) = originalFunction(input)
END FOR
```

**Testing Approach:** Property-based testing is recommended for Bugs 2, 3, and 5 because:
- It generates many `(companyId, name)` pairs automatically to verify no regressions on new inserts
- It generates many `pfMonth` values to verify GST/TDS amounts are never affected
- It generates many `(companyId, clerkUserId)` combinations to verify broadcast notifications
  are always included

**Test Cases:**
1. **Bug 2 Preservation:** Generate random `(companyId, name)` pairs that do NOT exist → assert
   exactly 1 new row is inserted
2. **Bug 3 Preservation:** Generate random compliance months → assert GST and TDS amounts are
   unchanged
3. **Bug 5 Preservation:** Generate notifications with `clerkUserId IS NULL` → assert they are
   always counted for any caller

### Unit Tests

- Bug 1: `SubmitBtn` with `onClick` prop calls handler on click
- Bug 1: `SubmitBtn` without `onClick` prop renders without error
- Bug 3: Compliance page PF amount equals `pfMonth.employerPF`
- Bug 3: Compliance page ESI amount equals `pfMonth.employerESI + pfMonth.employeeESI`
- Bug 4: `requireAccessibleCompany` returns company for accepted member
- Bug 4: `requireAccessibleCompany` throws 401 for non-member, non-owner
- Bug 4: `requireAccessibleCompany` returns company for owner (preservation)
- Bug 5: `getUnreadCount` returns 0 when all unread notifications belong to a different user
- Bug 5: `getUnreadCount` counts broadcast notifications (clerkUserId IS NULL)
- Bug 8: Middleware uses Upstash limiter when env vars are present
- Bug 8: Middleware falls back to in-memory limiter when env vars are absent
- Bug 9: Warning is logged in production when Inngest keys are missing
- Bug 9: No warning in development when Inngest keys are missing

### Property-Based Tests

- Bug 2: For any `(companyId, name)` pair called N times, row count is always 1
- Bug 3: For any `PFESIForecastMonth`, displayed PF = `employerPF` (never `* 2`)
- Bug 5: For any set of notifications, `getUnreadCount` never counts notifications targeted at
  other users

### Integration Tests

- Bug 1: Full wizard flow — fill form, click submit, assert store action called with correct payload
- Bug 13: Mark obligation paid via API, reload page, assert paid status persists
- Bug 14: POST member invite, GET members list, assert member appears
- Bug 15: Load forecast with actuals, switch to Variance view, assert variance cells render
