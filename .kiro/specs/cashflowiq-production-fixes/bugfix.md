# Bugfix Requirements Document

## Introduction

CashFlowIQ is a Next.js 16 financial forecasting platform for Indian SMEs. A deep audit of the codebase
revealed 15 production issues spanning broken UX interactions, data integrity bugs, auth access-control
gaps, code quality problems, missing environment wiring, and absent features required for production
parity. This document captures the defective behaviors, the correct behaviors that must replace them,
and the existing behaviors that must be preserved throughout the fix.

---

## Bug Analysis

### Current Behavior (Defect)

**Bug 1 — MicroForecastWizard submit buttons never fire**

1.1 WHEN a user fills in a wizard form (HireForm, RevenueForm, AssetForm, LoanForm, ExpenseForm, or
    PriceChangeForm) and clicks the submit button THEN the system does nothing because `onClick` is
    passed to `<SubmitBtn>` via `// @ts-ignore` but `SubmitBtn` does not accept or forward `onClick`
    to the underlying `<button>` element.

**Bug 2 — `upsertTimingProfile` creates duplicates on every save**

1.2 WHEN `upsertTimingProfile` is called with a `(companyId, name)` pair that already exists in the
    database THEN the system inserts a new row instead of updating the existing one, because the
    function uses plain `.insert()` with no `onConflictDoUpdate` clause, resulting in unbounded
    duplicate timing profile rows.

**Bug 3 — Compliance page doubles PF/ESI amounts**

1.3 WHEN the compliance page renders PF and ESI deposit amounts THEN the system displays twice the
    correct value because the code applies `* 2` multipliers (`pfAmount * 2` and `esiAmount * 2`)
    to values that the engine already returns as the correct total deposit.

**Bug 4 — `requireOwnedCompany` ignores `company_members` table**

1.4 WHEN an invited team member (editor or viewer role) makes an API call that goes through
    `requireOwnedCompany` THEN the system returns HTTP 401 Unauthorized because the function only
    checks `company.clerkUserId === userId` and never consults the `company_members` table or the
    existing `canAccessCompany()` helper.

**Bug 5 — `getUnreadCount` ignores `clerkUserId` parameter**

1.5 WHEN `getUnreadCount(companyId, clerkUserId)` is called THEN the system returns the count of ALL
    unread notifications for the entire company rather than the count for the specific user, because
    the DB query filters only on `companyId` and `readAt IS NULL` and never applies a `clerkUserId`
    filter.

**Bug 6 — Stale service worker files accumulate in `public/`**

1.6 WHEN the application is built THEN the system leaves stale generated service worker files
    (`public/sw*.js`, `public/workbox-*.js`) from previous builds in the repository because
    next-pwa does not clean up old files and `.gitignore` has no entries for these generated
    artifacts, resulting in up to 10 stale SW files committed to source control.

**Bug 7 — Unused variables in ForecastGrid (TypeScript hints)**

1.7 WHEN `ForecastGrid.tsx` is compiled THEN the system emits TypeScript "declared but never read"
    hints for `formatRupees`, `accounts` (in `DriversView`), `n`, `burnRate`, and `prev` because
    these variables are declared but their values are never consumed.

**Bug 8 — Rate limiting is per-instance (doesn't scale on Vercel)**

1.8 WHEN the application is deployed to Vercel and multiple serverless instances are running THEN
    the system resets rate-limit counters on every cold start because the rate limiter uses an
    in-memory `Map` that is not shared across instances, making the limit ineffective at scale.

**Bug 9 — Inngest compliance reminders never fire (keys missing)**

1.9 WHEN the application runs with empty `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` environment
    variables THEN the system never registers or executes Inngest background functions (including
    compliance reminders) even though the functions are fully implemented, because the Inngest
    client cannot authenticate without valid keys.

**Bug 10 — Welcome emails never send (webhook secret missing)**

1.10 WHEN a new user signs up via Clerk and the `CLERK_WEBHOOK_SECRET` environment variable is
     empty THEN the system silently returns `{ received: true }` from the webhook handler without
     verifying the payload or triggering the welcome email flow.

**Bug 11 — `RESEND_FROM_EMAIL` uses test domain**

1.11 WHEN the application sends emails using `RESEND_FROM_EMAIL=onboarding@resend.dev` THEN the
     system sends from Resend's shared test domain, causing emails to be flagged as spam in
     production and subject to Resend's test-domain rate limits.

**Bug 12 — No Sentry error monitoring**

1.12 WHEN an unhandled exception or runtime error occurs in production THEN the system provides no
     visibility into the error because Sentry (or any error tracking) is not installed or
     configured.

**Bug 13 — Compliance "paid" status stored in localStorage**

1.13 WHEN a user marks a compliance obligation as paid THEN the system persists that status only in
     the browser's `localStorage`, so the paid status is lost when the user clears browser data and
     does not sync across devices or team members.

**Bug 14 — No multi-user invite API endpoint**

1.14 WHEN a company owner wants to invite a team member THEN the system provides no API endpoint or
     UI to do so, even though the `company_members` table and `addMember()` query are fully
     implemented.

**Bug 15 — No variance analysis (actual vs forecast)**

1.15 WHEN a user views the ForecastGrid for months that have actual data THEN the system shows only
     forecast values with no column or view comparing actuals against the forecast, making it
     impossible to assess forecast accuracy.

---

### Expected Behavior (Correct)

**Bug 1 — MicroForecastWizard submit buttons**

2.1 WHEN a user fills in a wizard form and clicks the submit button THEN the system SHALL invoke the
    form's `onSubmit` handler with the collected field values, either by adding an `onClick` prop to
    `SubmitBtn` that is forwarded to the underlying `<button>`, or by wrapping each form in a
    `<form onSubmit>` element.

**Bug 2 — `upsertTimingProfile` duplicate prevention**

2.2 WHEN `upsertTimingProfile` is called with a `(companyId, name)` pair that already exists THEN
    the system SHALL update the existing row's fields (profileType, config, autoDerived, isDefault)
    instead of inserting a duplicate, using `onConflictDoUpdate` targeting a unique constraint on
    `(company_id, name)`.

**Bug 3 — Compliance PF/ESI amounts**

2.3 WHEN the compliance page renders PF and ESI deposit amounts THEN the system SHALL display the
    values returned directly by the engine (`pfMonth.employerPF` and the sum of
    `pfMonth.employerESI + pfMonth.employeeESI`) without any additional multiplier.

**Bug 4 — Auth access for team members**

2.4 WHEN an invited team member (with an accepted `company_members` record) makes an API call THEN
    the system SHALL grant access by calling `canAccessCompany(companyId, userId)` from
    `company-members.ts`, which checks both direct ownership and accepted membership, instead of
    only checking ownership.

**Bug 5 — `getUnreadCount` per-user filtering**

2.5 WHEN `getUnreadCount(companyId, clerkUserId)` is called THEN the system SHALL return only the
    count of unread notifications where `clerkUserId IS NULL` (company-wide broadcast) OR
    `clerkUserId = ?` (targeted at this specific user).

**Bug 6 — Stale service worker cleanup**

2.6 WHEN the repository is managed and the application is built THEN the system SHALL NOT commit
    generated service worker files to source control; `.gitignore` SHALL include entries for
    `public/sw*.js` and `public/workbox-*.js`, and all currently committed stale files SHALL be
    removed.

**Bug 7 — Unused variables in ForecastGrid**

2.7 WHEN `ForecastGrid.tsx` is compiled THEN the system SHALL produce no "declared but never read"
    TypeScript hints; unused declarations (`formatRupees`, `accounts` in `DriversView`, `n`,
    `burnRate`, `prev`) SHALL be removed or, where the value is meaningful (e.g. `burnRate`),
    rendered in the UI.

**Bug 8 — Distributed rate limiting**

2.8 WHEN the application is deployed to Vercel with `UPSTASH_REDIS_REST_URL` and
    `UPSTASH_REDIS_REST_TOKEN` configured THEN the system SHALL use `@upstash/ratelimit` backed by
    Upstash Redis so that rate-limit counters are shared across all serverless instances; WHEN those
    env vars are absent THEN the system SHALL fall back to the existing in-memory limiter
    (graceful degradation).

**Bug 9 — Inngest key validation and documentation**

2.9 WHEN `INNGEST_EVENT_KEY` or `INNGEST_SIGNING_KEY` are missing THEN the system SHALL log a
    clear warning (not throw) via `src/lib/server/env.ts` so that background jobs are known to be
    disabled; documentation SHALL specify the exact steps to obtain and configure Inngest keys.

**Bug 10 — Clerk webhook secret documentation**

2.10 WHEN `CLERK_WEBHOOK_SECRET` is missing THEN the system SHALL continue to handle the webhook
     gracefully (existing behavior); documentation SHALL specify the exact steps to obtain the
     Clerk webhook secret so that welcome emails are enabled in production.

**Bug 11 — `RESEND_FROM_EMAIL` production domain**

2.11 WHEN the application is deployed to production THEN the system SHALL send emails from a
     verified custom domain; `.env.example` SHALL include clear instructions directing operators to
     verify their domain in the Resend dashboard and set `RESEND_FROM_EMAIL` accordingly.

**Bug 12 — Sentry error monitoring**

2.12 WHEN an unhandled exception or runtime error occurs in production THEN the system SHALL
     capture and report it to Sentry; `@sentry/nextjs` SHALL be installed and configured with
     `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts`; a
     `SENTRY_DSN` env var SHALL be added to `.env.example`.

**Bug 13 — Compliance paid status persistence**

2.13 WHEN a user marks a compliance obligation as paid THEN the system SHALL persist that status
     server-side (via a `compliance_payments` table or the existing `audit_log`) so that paid
     status survives browser data clears and is visible to all team members of the same company.

**Bug 14 — Multi-user invite API endpoint**

2.14 WHEN a company owner wants to invite a team member THEN the system SHALL provide a
     `POST /api/companies/[id]/members` endpoint that calls `addMember()` and a basic team
     management UI in the Settings page.

**Bug 15 — Variance analysis view**

2.15 WHEN a user views the ForecastGrid for months that have actuals in `monthly_actuals` THEN the
     system SHALL provide a "Variance" view showing `actual − forecast` for each account and month
     that has actuals data.

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a wizard form is submitted with valid inputs THEN the system SHALL CONTINUE TO call the
    correct store action (`addHire`, `addRevenue`, `addAsset`, `addLoan`, `addExpense`,
    `addPriceChange`) with the same typed payload shape as before.

3.2 WHEN `upsertTimingProfile` is called with a new `(companyId, name)` pair THEN the system SHALL
    CONTINUE TO insert a new timing profile row.

3.3 WHEN the compliance engine returns GST, TDS, and advance tax amounts THEN the system SHALL
    CONTINUE TO display those amounts without modification on the compliance page.

3.4 WHEN the company owner (the Clerk user who created the company) makes any API call THEN the
    system SHALL CONTINUE TO be granted access without requiring a `company_members` row.

3.5 WHEN `getNotifications` is called THEN the system SHALL CONTINUE TO return notifications
    targeted at the specific user OR broadcast to the whole company (where `clerkUserId IS NULL`).

3.6 WHEN the application is built THEN the system SHALL CONTINUE TO generate a valid service worker
    and workbox runtime for PWA functionality.

3.7 WHEN `ForecastGrid` renders the P&L, Balance Sheet, Cash Flow, and Drivers views THEN the
    system SHALL CONTINUE TO display all existing rows and computed values correctly.

3.8 WHEN Upstash env vars are absent THEN the system SHALL CONTINUE TO apply rate limiting via the
    in-memory fallback without throwing errors or blocking requests.

3.9 WHEN Inngest keys are absent THEN the system SHALL CONTINUE TO serve all non-background-job
    routes normally; the warning SHALL NOT cause a server crash or failed build.

3.10 WHEN `CLERK_WEBHOOK_SECRET` is absent in development THEN the system SHALL CONTINUE TO skip
     webhook verification silently without crashing.

3.11 WHEN `RESEND_API_KEY` is absent THEN the system SHALL CONTINUE TO skip email sending silently.

3.12 WHEN Sentry DSN is absent THEN the system SHALL CONTINUE TO function normally without Sentry
     capturing events.

3.13 WHEN a user views the compliance page in a browser that has existing `cashflowiq_paid_compliance`
     localStorage data THEN the system SHALL CONTINUE TO respect that data during a migration
     period (or provide a one-time migration path to the server-side store).

3.14 WHEN a non-owner member calls a read-only API route THEN the system SHALL CONTINUE TO enforce
     that write operations (create, update, delete) require at minimum the `editor` role.

3.15 WHEN the ForecastGrid renders the P&L, BS, and CF views THEN the system SHALL CONTINUE TO
     display only forecast values in those views; the Variance view SHALL be additive and not
     replace existing views.

3.16 WHEN all monetary values flow through the system THEN the system SHALL CONTINUE TO store and
     compute them as integer paise; no fix SHALL introduce floating-point monetary arithmetic.

3.17 WHEN the forecast engine runs THEN the system SHALL CONTINUE TO be pure with no DB calls
     inside `runForecastEngine()`.

3.18 WHEN the balance sheet is computed THEN the system SHALL CONTINUE TO satisfy
     `totalAssets === totalLiabilities + totalEquity`.

3.19 WHEN period values are stored or compared THEN the system SHALL CONTINUE TO use the
     `YYYY-MM-01` format exclusively.

---

## Bug Condition Pseudocode

### Bug 1 — SubmitBtn onClick not forwarded

```pascal
FUNCTION isBugCondition_1(X)
  INPUT: X of type SubmitBtnProps
  OUTPUT: boolean
  RETURN X has onClick prop AND SubmitBtn does not forward onClick to <button>
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_1(X) DO
  result ← render SubmitBtn'(X) and click it
  ASSERT onSubmit handler was called
END FOR

// Preservation Checking
FOR ALL X WHERE NOT isBugCondition_1(X) DO
  ASSERT SubmitBtn'(X) renders identically to SubmitBtn(X)
END FOR
```

### Bug 2 — upsertTimingProfile duplicate insert

```pascal
FUNCTION isBugCondition_2(X)
  INPUT: X of type { companyId, name }
  OUTPUT: boolean
  RETURN EXISTS row in timing_profiles WHERE company_id = X.companyId AND name = X.name
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_2(X) DO
  rowsBefore ← COUNT(*) FROM timing_profiles WHERE company_id = X.companyId AND name = X.name
  upsertTimingProfile'(X.companyId, X.data)
  rowsAfter ← COUNT(*) FROM timing_profiles WHERE company_id = X.companyId AND name = X.name
  ASSERT rowsAfter = rowsBefore  // no new row created
END FOR

// Preservation Checking
FOR ALL X WHERE NOT isBugCondition_2(X) DO
  ASSERT upsertTimingProfile'(X) inserts exactly one new row
END FOR
```

### Bug 3 — PF/ESI doubled amounts

```pascal
FUNCTION isBugCondition_3(X)
  INPUT: X of type ComplianceMonth
  OUTPUT: boolean
  RETURN X.pfMonth IS NOT NULL
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_3(X) DO
  displayed ← compliancePage'(X).pfAmount
  ASSERT displayed = X.pfMonth.employerPF  // not * 2
  displayed_esi ← compliancePage'(X).esiAmount
  ASSERT displayed_esi = X.pfMonth.employerESI + X.pfMonth.employeeESI  // not * 2
END FOR
```

### Bug 4 — requireOwnedCompany blocks members

```pascal
FUNCTION isBugCondition_4(X)
  INPUT: X of type { userId, companyId }
  OUTPUT: boolean
  RETURN company.clerkUserId ≠ X.userId
     AND EXISTS accepted member row for (X.companyId, X.userId)
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_4(X) DO
  result ← requireAccessibleCompany'(X.userId, X.companyId)
  ASSERT result ≠ HTTP 401
END FOR

// Preservation Checking
FOR ALL X WHERE NOT isBugCondition_4(X) DO
  ASSERT requireAccessibleCompany'(X.userId, X.companyId) = requireOwnedCompany(X.userId, X.companyId)
END FOR
```

### Bug 5 — getUnreadCount ignores clerkUserId

```pascal
FUNCTION isBugCondition_5(X)
  INPUT: X of type { companyId, clerkUserId }
  OUTPUT: boolean
  RETURN EXISTS unread notification in company WHERE clerkUserId ≠ X.clerkUserId AND clerkUserId IS NOT NULL
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_5(X) DO
  count ← getUnreadCount'(X.companyId, X.clerkUserId)
  ASSERT count = COUNT of unread notifications WHERE clerkUserId IS NULL OR clerkUserId = X.clerkUserId
END FOR
```
