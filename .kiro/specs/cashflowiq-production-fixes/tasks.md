# Implementation Plan

<!-- ============================================================
     PHASE 1 — EXPLORATION & PRESERVATION TESTS (run BEFORE fixes)
     ============================================================ -->

- [x] 1. Write bug condition exploration tests (critical UX bugs)
  - **Property 1: Bug Condition** - SubmitBtn onClick Not Forwarded
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface counterexamples that demonstrate SubmitBtn swallows onClick
  - **Scoped PBT Approach**: Scope to concrete case — render `<SubmitBtn onClick={mockFn} />`, simulate click, assert `mockFn` was NOT called (confirms bug)
  - Test that clicking SubmitBtn with an onClick prop does NOT invoke the handler (from Bug Condition in design: `'onClick' IN X.props AND SubmitBtn.propTypes does NOT include 'onClick'`)
  - Run test on UNFIXED code — **EXPECTED OUTCOME**: Test FAILS (proves bug exists)
  - Document counterexample: "SubmitBtn rendered with onClick={mockFn}, click simulated, mockFn call count = 0"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1_

- [x] 2. Write bug condition exploration tests (data integrity bugs)
  - **Property 1: Bug Condition** - upsertTimingProfile Creates Duplicate Rows
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface counterexamples showing duplicate rows are inserted
  - **Scoped PBT Approach**: Call `upsertTimingProfile(companyId, { name: 'X', ... })` twice with the same `(companyId, name)` pair; assert row count equals 2 (confirms bug)
  - Test that calling upsertTimingProfile twice for the same `(companyId, name)` results in 2 rows (from Bug Condition: `COUNT(*) >= 1` for that pair)
  - Run test on UNFIXED code — **EXPECTED OUTCOME**: Test FAILS (row count is 2, not 1)
  - Document counterexample: "upsertTimingProfile called twice with same (companyId, 'Monthly Uniform') → 2 rows found"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.2_

- [x] 3. Write bug condition exploration tests (compliance doubled amounts)
  - **Property 1: Bug Condition** - Compliance Page Doubles PF/ESI Amounts
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface counterexamples showing PF/ESI are doubled on the compliance page
  - **Scoped PBT Approach**: Render compliance page with `pfMonth = { employerPF: 9000, employerESI: 1750, employeeESI: 1500 }`; assert displayed PF is 18000 (confirms bug)
  - Test that displayed `pfAmount` equals `pfMonth.employerPF * 2` on unfixed code (from Bug Condition: `X IS NOT NULL` for pfMonth)
  - Run test on UNFIXED code — **EXPECTED OUTCOME**: Test FAILS (displayed value is doubled)
  - Document counterexample: "employerPF=9000 → displayed ₹18,000 (should be ₹9,000)"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.3_

- [x] 4. Write bug condition exploration tests (auth & notifications bugs)
  - **Property 1: Bug Condition** - requireOwnedCompany Blocks Accepted Members
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface counterexamples showing accepted members receive 401
  - **Scoped PBT Approach**: Call `requireOwnedCompany(memberId, companyId)` where `memberId` is an accepted member but not the owner; assert it throws 401 (confirms bug)
  - Test that `requireOwnedCompany` throws 401 for accepted member (from Bug Condition: `company.clerkUserId ≠ userId AND EXISTS accepted member row`)
  - Also test `getUnreadCount(companyId, userA)` returns 3 when 3 unread notifications exist for userB (confirms Bug 5)
  - Run tests on UNFIXED code — **EXPECTED OUTCOME**: Tests FAIL (401 thrown; count inflated)
  - Document counterexamples found
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.4, 1.5_

- [x] 5. Write preservation property tests (BEFORE implementing any fix)
  - **Property 2: Preservation** - Wizard Payload Shape, New Insert, GST/TDS, Owner Access, Broadcast Notifications
  - **IMPORTANT**: Follow observation-first methodology — observe UNFIXED code behavior for non-buggy inputs
  - Observe: wizard form submission with valid inputs calls correct store action with correct payload shape
  - Observe: `upsertTimingProfile` with a NEW `(companyId, name)` pair inserts exactly 1 row
  - Observe: compliance page displays GST, TDS, advance tax amounts without modification
  - Observe: `requireOwnedCompany(ownerId, companyId)` grants access for the company owner
  - Observe: `getUnreadCount` counts broadcast notifications (`clerkUserId IS NULL`) for any caller
  - Write property-based tests:
    - For all new `(companyId, name)` pairs not yet in DB → exactly 1 row inserted (Preservation Req 3.2)
    - For any `PFESIForecastMonth`, GST and TDS amounts displayed equal engine output with no multiplier (Preservation Req 3.3)
    - For any `(companyId, clerkUserId)`, broadcast notifications (`clerkUserId IS NULL`) are always counted (Preservation Req 3.5)
  - Verify all preservation tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

<!-- ============================================================
     PHASE 2 — CRITICAL UX FIXES (Bugs 1, 2, 3)
     ============================================================ -->

- [x] 6. Fix Bug 1 — MicroForecastWizard SubmitBtn onClick not forwarded

  - [x] 6.1 Add onClick prop to SubmitBtn and forward to underlying button
    - File: `src/components/forecast/MicroForecastWizard.tsx`
    - Add `onClick?: () => void` to `SubmitBtn` props interface
    - Forward `onClick` to the underlying `<button>` element: `<button onClick={onClick} ...>`
    - _Bug_Condition: `'onClick' IN X.props AND SubmitBtn.propTypes does NOT include 'onClick'`_
    - _Expected_Behavior: clicking SubmitBtn invokes the onClick handler_
    - _Preservation: all six wizard forms continue to call the correct store action with the same typed payload shape_
    - _Requirements: 2.1, 3.1_

  - [x] 6.2 Remove all // @ts-ignore comments from wizard forms
    - Remove `// @ts-ignore` from HireForm, RevenueForm, AssetForm, LoanForm, ExpenseForm, PriceChangeForm
    - Verify TypeScript compiles without errors after removal
    - _Requirements: 2.1_

  - [x] 6.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - SubmitBtn Forwards onClick
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms SubmitBtn now forwards onClick)
    - _Requirements: 2.1_

  - [x] 6.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Wizard Payload Shape Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 5 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in wizard form submissions)

- [x] 7. Fix Bug 2 — upsertTimingProfile creates duplicates on every save

  - [x] 7.1 Add unique index to timingProfiles schema
    - File: `src/lib/db/schema.ts`
    - Add `uniqueIndex('idx_timing_profiles_company_name').on(table.companyId, table.name)` to the `timingProfiles` table definition
    - _Bug_Condition: `COUNT(*) FROM timing_profiles WHERE company_id = X.companyId AND name = X.name >= 1`_
    - _Requirements: 2.2_

  - [x] 7.2 Add onConflictDoUpdate to upsertTimingProfile query
    - File: `src/lib/db/queries/forecast-config.ts`
    - Add `.onConflictDoUpdate({ target: [schema.timingProfiles.companyId, schema.timingProfiles.name], set: { profileType, config, autoDerived, isDefault } })` to the insert
    - _Expected_Behavior: row count for `(companyId, name)` remains exactly 1 after any number of upserts_
    - _Preservation: calling with a new `(companyId, name)` pair still inserts exactly one new row_
    - _Requirements: 2.2, 3.2_

  - [x] 7.3 Create migration SQL for unique constraint
    - File: `drizzle/0003_timing_profile_unique.sql`
    - Content: `CREATE UNIQUE INDEX IF NOT EXISTS idx_timing_profiles_company_name ON timing_profiles(company_id, name);`
    - _Requirements: 2.2_

  - [x] 7.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - upsertTimingProfile No Duplicates
    - **IMPORTANT**: Re-run the SAME test from task 2 — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (row count is 1 after two upserts with same key)
    - _Requirements: 2.2_

  - [x] 7.5 Verify preservation tests still pass
    - **Property 2: Preservation** - New (companyId, name) Pair Still Inserts One Row
    - **IMPORTANT**: Re-run the SAME tests from task 5 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (new pairs still insert exactly 1 row)

- [x] 8. Fix Bug 3 — Compliance page doubles PF/ESI amounts

  - [x] 8.1 Remove * 2 multipliers from compliance page
    - File: `src/app/(app)/compliance/page.tsx`
    - Change `amount: pfAmount * 2` → `amount: pfAmount`
    - Change `amount: esiAmount * 2` → `amount: esiAmount`
    - Note: `pfAmount` is already `pfMonth.employerPF`; `esiAmount` is already `pfMonth.employerESI + pfMonth.employeeESI`
    - _Bug_Condition: `pfMonth IS NOT NULL` (any compliance month with PF data)_
    - _Expected_Behavior: `displayed === pfMonth.employerPF` and `displayed === pfMonth.employerESI + pfMonth.employeeESI`_
    - _Preservation: GST, TDS, and advance tax amounts displayed without modification_
    - _Requirements: 2.3, 3.3_

  - [x] 8.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Compliance PF/ESI Not Doubled
    - **IMPORTANT**: Re-run the SAME test from task 3 — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (displayed PF equals `employerPF`, not `employerPF * 2`)
    - _Requirements: 2.3_

  - [x] 8.3 Verify preservation tests still pass
    - **Property 2: Preservation** - GST/TDS/Advance Tax Amounts Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 5 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (GST, TDS, advance tax unaffected)

<!-- ============================================================
     PHASE 3 — AUTH FIXES (Bugs 4, 5)
     ============================================================ -->

- [x] 9. Fix Bug 4 — requireOwnedCompany ignores company_members table

  - [x] 9.1 Add requireAccessibleCompany function to auth.ts
    - File: `src/lib/server/auth.ts`
    - Import `canAccessCompany` from `@/lib/db/queries/company-members`
    - Add new exported function `requireAccessibleCompany(userId: string, companyId: string)`:
      - Get company via `getCompanyById`; throw 404 if not found
      - Call `canAccessCompany(companyId, userId)`; throw 401 if false
      - Return company
    - Keep `requireOwnedCompany` unchanged — it remains the guard for write operations
    - _Bug_Condition: `company.clerkUserId ≠ userId AND EXISTS accepted member row for (companyId, userId)`_
    - _Expected_Behavior: `requireAccessibleCompany` returns company without throwing 401_
    - _Preservation: owner access unchanged; write operations still use `requireOwnedCompany`_
    - _Requirements: 2.4, 3.4, 3.14_

  - [x] 9.2 Wire requireAccessibleCompany into read-only API routes
    - Replace `requireOwnedCompany` with `requireAccessibleCompany` in `GET /api/companies/[id]`
    - Audit other read-only routes and apply `requireAccessibleCompany` where appropriate
    - _Requirements: 2.4_

  - [x] 9.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Accepted Member Granted Access
    - **IMPORTANT**: Re-run the SAME test from task 4 — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (`requireAccessibleCompany` returns company for accepted member)
    - _Requirements: 2.4_

  - [x] 9.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Owner Access Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 5 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (owner still granted access; non-member still gets 401)

- [x] 10. Fix Bug 5 — getUnreadCount ignores clerkUserId parameter

  - [x] 10.1 Add per-user filter to getUnreadCount query
    - File: `src/lib/db/queries/notifications.ts`
    - Import `or` and `isNull` from `drizzle-orm` (if not already imported)
    - Update `getUnreadCount` WHERE clause to add:
      `or(isNull(schema.notifications.clerkUserId), eq(schema.notifications.clerkUserId, clerkUserId))`
    - _Bug_Condition: `EXISTS unread notification WHERE clerkUserId IS NOT NULL AND clerkUserId ≠ X.clerkUserId`_
    - _Expected_Behavior: count includes only `clerkUserId IS NULL` OR `clerkUserId = caller`_
    - _Preservation: `getNotifications` behavior unchanged; broadcast notifications always counted_
    - _Requirements: 2.5, 3.5_

  - [x] 10.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - getUnreadCount Filters by User
    - **IMPORTANT**: Re-run the SAME test from task 4 — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (`getUnreadCount(companyX, userA)` returns 0 when only userB has unread)
    - _Requirements: 2.5_

  - [x] 10.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Broadcast Notifications Always Counted
    - **IMPORTANT**: Re-run the SAME tests from task 5 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (broadcast notifications still counted for any caller)

<!-- ============================================================
     PHASE 4 — CODE QUALITY (Bugs 6, 7)
     ============================================================ -->

- [x] 11. Fix Bug 6 — Stale service worker files accumulate in public/

  - [x] 11.1 Verify .gitignore has SW entries
    - Confirm `.gitignore` already contains `public/sw*.js` and `public/workbox-*.js`
    - Add entries if missing
    - _Requirements: 2.6, 3.6_

  - [x] 11.2 Delete all stale committed SW files from public/
    - Remove `public/sw 2.js` through `public/sw 10.js` and any `workbox-*.js` duplicates
    - Keep only the current build-generated `sw.js` and `workbox-*.js` (these are gitignored)
    - _Bug_Condition: `file MATCHES 'public/sw*.js' OR 'public/workbox-*.js' AND file IS tracked by git`_
    - _Preservation: application continues to generate a valid service worker for PWA functionality_
    - _Requirements: 2.6, 3.6_

- [x] 12. Fix Bug 7 — Unused variables in ForecastGrid

  - [x] 12.1 Remove formatRupees declaration
    - File: `src/components/forecast/ForecastGrid.tsx`
    - Remove the `formatRupees` function declaration entirely (it is unused; `formatPct` and `formatDays` are used instead)
    - _Requirements: 2.7_

  - [x] 12.2 Remove unused accounts destructuring in DriversView
    - Remove `accounts` from `DriversView` props destructuring (component accesses `engineResult` directly)
    - _Requirements: 2.7_

  - [x] 12.3 Remove unused n variable
    - Remove `const n = forecastMonths.length` from `DriversView` (value never consumed)
    - _Requirements: 2.7_

  - [x] 12.4 Render burnRate as a meaningful Drivers row
    - Add `burnRate` as a rendered row in the Drivers table (it is a meaningful metric — monthly cash burn when OCF is negative)
    - _Preservation: ForecastGrid P&L, BS, CF, and Drivers views continue to display all existing rows correctly_
    - _Requirements: 2.7, 3.7_

  - [x] 12.5 Fix unused prev parameter in tone callbacks
    - Replace `(v, prev)` with `(v, _prev)` in tone callbacks where `prev` is unused, or remove the parameter where the signature allows it
    - _Requirements: 2.7_

  - [x] 12.6 Verify no TypeScript "declared but never read" hints remain
    - Run TypeScript compiler and confirm zero unused-variable hints in `ForecastGrid.tsx`
    - _Requirements: 2.7_

<!-- ============================================================
     PHASE 5 — INFRASTRUCTURE (Bugs 8, 9, 10, 11, 12)
     ============================================================ -->

- [x] 13. Fix Bug 8 — Rate limiting is per-instance (doesn't scale on Vercel)

  - [x] 13.1 Wire Upstash ratelimit into middleware with in-memory fallback
    - File: `src/middleware.ts`
    - Import `Ratelimit` from `@upstash/ratelimit` and `Redis` from `@upstash/redis`
    - Construct `upstashRedis` conditionally: only when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are both present
    - Construct `upstashLimiter` conditionally on `upstashRedis` being non-null
    - In rate-limit check paths: try `upstashLimiter` first; fall back to existing `checkRateLimit` if `upstashLimiter` is null
    - _Bug_Condition: `environment = 'production' AND UPSTASH_REDIS_REST_URL IS NULL AND rate limiter uses in-memory Map`_
    - _Expected_Behavior: rate-limit counters shared across all serverless instances via Upstash Redis_
    - _Preservation: when Upstash env vars are absent, in-memory fallback continues without errors_
    - _Requirements: 2.8, 3.8_

  - [x] 13.2 Add Upstash env vars to .env.example
    - Add `UPSTASH_REDIS_REST_URL=` and `UPSTASH_REDIS_REST_TOKEN=` with instructions to create a free Upstash Redis database
    - _Requirements: 2.8_

- [x] 14. Fix Bug 9 — Inngest compliance reminders never fire (keys missing)

  - [x] 14.1 Add production warning for missing Inngest keys
    - File: `src/lib/server/env.ts`
    - After the `env` object is constructed, add:
      ```ts
      if (isProduction && (!process.env.INNGEST_EVENT_KEY || !process.env.INNGEST_SIGNING_KEY)) {
        console.warn('[CashFlowIQ] INNGEST_EVENT_KEY or INNGEST_SIGNING_KEY missing — background jobs disabled')
      }
      ```
    - Warning must NOT throw; must NOT cause a server crash or failed build
    - _Bug_Condition: `INNGEST_EVENT_KEY IS NULL OR INNGEST_SIGNING_KEY IS NULL` in production_
    - _Expected_Behavior: clear warning logged; background jobs known to be disabled_
    - _Preservation: all non-background-job routes continue to serve normally; no crash in development_
    - _Requirements: 2.9, 3.9_

  - [x] 14.2 Document Inngest key setup in .env.example
    - Add `INNGEST_EVENT_KEY=` and `INNGEST_SIGNING_KEY=` with step-by-step instructions to obtain keys from the Inngest dashboard
    - _Requirements: 2.9_

- [ ] 15. Fix Bug 10 — Welcome emails never send (webhook secret missing) *
  - Documentation-only fix
  - File: `.env.example`
  - Add `CLERK_WEBHOOK_SECRET=` with step-by-step instructions:
    1. Go to Clerk Dashboard → Webhooks
    2. Create endpoint pointing to `https://<your-domain>/api/webhooks/clerk`
    3. Copy the signing secret and set `CLERK_WEBHOOK_SECRET`
  - _Preservation: when `CLERK_WEBHOOK_SECRET` is absent in development, webhook verification is skipped silently without crashing_
  - _Requirements: 2.10, 3.10_

- [ ] 16. Fix Bug 11 — RESEND_FROM_EMAIL uses test domain *
  - Documentation-only fix
  - File: `.env.example`
  - Add a prominent warning comment above `RESEND_FROM_EMAIL=onboarding@resend.dev`:
    - Warn that `onboarding@resend.dev` is Resend's shared test domain and will cause spam filtering in production
    - Instruct operators to verify their own domain in the Resend dashboard and set `RESEND_FROM_EMAIL=noreply@yourdomain.com`
  - _Preservation: when `RESEND_API_KEY` is absent, email sending is skipped silently_
  - _Requirements: 2.11, 3.11_

- [x] 17. Fix Bug 12 — No Sentry error monitoring

  - [x] 17.1 Install @sentry/nextjs
    - Add `@sentry/nextjs` to `package.json` dependencies
    - Run `npm install` (or equivalent)
    - _Requirements: 2.12_

  - [x] 17.2 Create Sentry config files
    - Create `sentry.client.config.ts` — initialize Sentry only when `NEXT_PUBLIC_SENTRY_DSN` is set
    - Create `sentry.server.config.ts` — initialize Sentry only when `SENTRY_DSN` is set
    - Create `sentry.edge.config.ts` — initialize Sentry only when `SENTRY_DSN` is set
    - All three files must be no-ops when DSN is absent (graceful degradation)
    - _Preservation: when Sentry DSN is absent, application functions normally without Sentry_
    - _Requirements: 2.12, 3.12_

  - [x] 17.3 Wrap next.config.ts with withSentryConfig
    - File: `next.config.ts`
    - Read `node_modules/next/dist/docs/` for current Next.js config API before editing
    - Wrap the existing config export with `withSentryConfig`
    - _Requirements: 2.12_

  - [x] 17.4 Add Sentry DSN to .env.example
    - Add `SENTRY_DSN=` and `NEXT_PUBLIC_SENTRY_DSN=` with instructions to create a Sentry project and copy the DSN
    - _Requirements: 2.12_

<!-- ============================================================
     PHASE 6 — NEW FEATURES (Bugs 13, 14, 15)
     ============================================================ -->

- [x] 18. Fix Bug 13 — Compliance paid status stored in localStorage

  - [x] 18.1 Add compliance_payments table to schema
    - File: `src/lib/db/schema.ts`
    - Add `compliancePayments` table with columns: `id` (uuid pk), `companyId` (fk), `clerkUserId`, `obligationId`, `paidAt`, `createdAt`
    - _Bug_Condition: `storage = 'localStorage' AND paid status NOT persisted server-side`_
    - _Requirements: 2.13_

  - [x] 18.2 Create migration SQL for compliance_payments
    - File: `drizzle/0004_compliance_payments.sql`
    - Generate migration SQL for the new table
    - _Requirements: 2.13_

  - [x] 18.3 Add compliance payments API routes
    - File: `src/app/api/compliance/payments/route.ts`
      - `GET ?companyId=` — list paid obligation IDs for a company
      - `POST` — mark obligation as paid (body: `{ companyId, obligationId }`)
    - File: `src/app/api/compliance/payments/[id]/route.ts`
      - `DELETE` — unmark obligation as paid
    - _Requirements: 2.13_

  - [x] 18.4 Update compliance page to use server-side paid status
    - File: `src/app/(app)/compliance/page.tsx`
    - Fetch paid status from `GET /api/compliance/payments` on load
    - Merge API results with existing `cashflowiq_paid_compliance` localStorage data (localStorage as fallback during migration period)
    - Write to API on mark-paid/unmark actions
    - _Preservation: existing `cashflowiq_paid_compliance` localStorage data respected during migration_
    - _Requirements: 2.13, 3.13_

- [x] 19. Fix Bug 14 — No multi-user invite API endpoint

  - [x] 19.1 Add members API routes
    - File: `src/app/api/companies/[id]/members/route.ts`
    - `GET` — list members (owner only, uses `requireOwnedCompany`)
    - `POST` — invite member by Clerk user ID (owner only); calls existing `addMember()` query
    - `DELETE ?clerkUserId=` — remove member (owner only)
    - _Requirements: 2.14, 3.14_

  - [x] 19.2 Add Team Members section to Settings page
    - File: `src/app/(app)/settings/page.tsx`
    - Add "Team Members" section showing current member list (name, role, status)
    - Add invite input (Clerk user ID or email) with "Invite" button that calls `POST /api/companies/[id]/members`
    - Add remove button per member that calls `DELETE /api/companies/[id]/members?clerkUserId=`
    - _Requirements: 2.14_

- [x] 20. Fix Bug 15 — No variance analysis (actual vs forecast)

  - [x] 20.1 Add 'variance' to ViewType and ViewSwitcher
    - File: `src/components/forecast/ViewSwitcher.tsx`
    - Add `'variance'` to the `ViewType` union
    - Add "Variance" tab to the `views` array
    - _Preservation: Variance view is additive — P&L, BS, CF, and Drivers views unchanged_
    - _Requirements: 2.15, 3.15_

  - [x] 20.2 Implement buildVarianceRows in ForecastGrid
    - File: `src/components/forecast/ForecastGrid.tsx`
    - Add `buildVarianceRows(accounts, engineResult, actuals, monthCount)` function:
      - For each P&L account, for each month: if actual exists, compute `actual − forecast`; else `null`
      - Returns `GridRow[]` with variance values
    - Color-code cells: green when `actual > forecast` (better than expected), red when `actual < forecast` (worse)
    - All monetary values remain integer paise — no floating-point arithmetic
    - _Requirements: 2.15, 3.15, 3.16_

  - [x] 20.3 Wire actuals data into ForecastGrid for variance view
    - File: `src/app/(app)/forecast/page.tsx`
    - Pass `actuals` data from `useActualsStore` into `ForecastGrid` when `view === 'variance'`
    - _Preservation: ForecastGrid P&L, BS, CF views display only forecast values; Variance view is additive_
    - _Requirements: 2.15, 3.15_

<!-- ============================================================
     PHASE 7 — CHECKPOINT
     ============================================================ -->

- [x] 21. Checkpoint — Ensure all tests pass
  - Re-run all exploration tests (tasks 1–4) — all should now PASS (bugs fixed)
  - Re-run all preservation tests (task 5) — all should still PASS (no regressions)
  - Run TypeScript compiler — zero errors and zero unused-variable hints
  - Verify balance sheet invariant: `totalAssets === totalLiabilities + totalEquity` (Req 3.18)
  - Verify forecast engine remains pure — no DB calls inside `runForecastEngine()` (Req 3.17)
  - Verify all period values use `YYYY-MM-01` format (Req 3.19)
  - Verify all monetary values are integer paise — no floating-point arithmetic (Req 3.16)
  - Ensure all tests pass; ask the user if questions arise.
