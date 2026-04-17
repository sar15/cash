# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Team Member 401 / Duplicate Files / Hardcoded Fallback / Secrets Tracked / [companyId] Route 401
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Bug 1: Test that `useCurrentForecast` constructs URL with path param `'/api/forecast/result/' + companyId` (not query string) — assert the constructed URL contains `?companyId=` (will FAIL on unfixed code)
  - Bug 2: Test that none of the 12 ` 2.{ext}` files exist in `src/` — assert `existsSync` returns false for each (will FAIL on unfixed code)
  - Bug 3: Test that when `RESEND_FROM_EMAIL` is `''` or `undefined`, the `FROM` constant in `send.ts` does NOT equal `'onboarding@resend.dev'` — assert `FROM !== 'onboarding@resend.dev'` (will FAIL on unfixed code)
  - Bug 5: Test that `git ls-files .env.local` returns empty output — assert output is `''` (will FAIL on unfixed code)
  - Bug 6: Test that the `[companyId]` route source does NOT contain `requireOwnedCompany` — assert source contains `requireAccessibleCompany` (will FAIL on unfixed code)
  - Bug 7: Test that `.gitignore` contains an explicit standalone `.env.local` line — assert file content includes `\n.env.local\n` (will FAIL on unfixed code)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves the bugs exist)
  - Document counterexamples found (e.g., URL uses path param, 12 duplicate files present, `onboarding@resend.dev` in source, `.env.local` tracked, `requireOwnedCompany` in route, no explicit gitignore entry)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14_

- [x] 2. Write preservation property tests (BEFORE implementing fixes)
  - **Property 2: Preservation** - Owner Forecast Save / Canonical Files / Configured Email / UploadThing / Local Dev / Unauthenticated 401
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: company owner forecast save succeeds on unfixed code (returns 201 via path-param route)
  - Observe: canonical source files (non-` 2.` versions) compile and pass typecheck on unfixed code
  - Observe: when `RESEND_FROM_EMAIL` is set to a valid address, `FROM` equals that address on unfixed code
  - Observe: unauthenticated requests to `[companyId]` route return 401 on unfixed code
  - Observe: `.env.example` is committable (not ignored) on unfixed code
  - Write property-based tests:
    - For all `companyId` strings (owner context): verify the route handler returns non-401 — `requireOwnedCompany` passes for owners
    - For all valid `RESEND_FROM_EMAIL` values (non-empty strings): verify `FROM` equals the env value, never `'onboarding@resend.dev'`
    - For all unauthenticated requests to `[companyId]` route: verify 401 is returned
    - For all `companyId` strings (owner context on fixed route): verify `requireAccessibleCompany` also passes for owners
  - Verify tests PASS on UNFIXED code (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13_

- [x] 3. Fix all seven production-blocking bugs

  - [x] 3.1 Fix Bug 1 — Switch forecast save URL to query-string route
    - In `src/hooks/use-current-forecast.ts`, change `apiPost('/api/forecast/result/${company.id}', ...)` to `apiPost('/api/forecast/result?companyId=${company.id}', ...)`
    - No other changes needed — the flat route at `src/app/api/forecast/result/route.ts` already uses `resolveAuthedCompany`
    - _Bug_Condition: isBugCondition_1(X) where X.isOwner = false AND X.apiPath = '/api/forecast/result/' + X.companyId_
    - _Expected_Behavior: apiPost URL contains '?companyId=' and server returns 201 for both owners and team members_
    - _Preservation: Owner forecast save continues to succeed; debounce (800 ms) and silent error swallowing are unaffected_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.2 Fix Bug 2 — Delete 12 duplicate " 2." files
    - Delete all 12 stale duplicate files: `src/components/forecast/AccountRuleEditor 2.tsx`, `src/components/forecast/SensitivityPanel 2.tsx`, `src/components/shared/ErrorBoundary 2.tsx`, `src/components/shared/Toast 2.tsx`, `src/components/shared/UserTypeModal 2.tsx`, `src/components/shared/skeleton 2.tsx`, `src/lib/__tests__/cashflowiq-final-gaps.test 2.ts`, `src/lib/email/send 2.ts`, `src/lib/inngest/client 2.ts`, `src/lib/reports/pdf-generator 2.ts`, `src/lib/server/env 2.ts`, `src/lib/utils/crypto 2.ts`
    - No code changes required — none of these files are imported anywhere
    - _Bug_Condition: isBugCondition_2(X) where EXISTS file IN X.repositoryFiles WHERE file.name MATCHES / 2\.(tsx?|ts)$/_
    - _Expected_Behavior: No file in src/ matches the / 2\.(tsx?|ts)$/ pattern_
    - _Preservation: Canonical (non-duplicate) source files are unaffected; build, typecheck, lint continue to exit 0_
    - _Requirements: 2.3, 2.4, 3.3_

  - [x] 3.3 Fix Bug 3 — Remove hardcoded `onboarding@resend.dev` fallback in `send.ts`
    - In `src/lib/email/send.ts`, change `process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'` to `process.env.RESEND_FROM_EMAIL ?? ''`
    - _Bug_Condition: isBugCondition_3(X) where X.RESEND_FROM_EMAIL = '' OR X.RESEND_FROM_EMAIL = undefined_
    - _Expected_Behavior: FROM = '' when RESEND_FROM_EMAIL is unset, causing existing resend guard to skip sending_
    - _Preservation: When RESEND_FROM_EMAIL is set to a valid address, FROM equals that address; RESEND_API_KEY absence guard is unaffected_
    - _Requirements: 2.5, 2.6, 3.4, 3.5_

  - [x] 3.4 Fix Bug 4 — Add npm `overrides` to pin `effect>=3.20.0`
    - In `package.json`, add `"overrides": { "effect": ">=3.20.0" }` field
    - Run `npm install` to regenerate the lockfile with the patched `effect` version
    - _Bug_Condition: isBugCondition_4(X) where 'effect' IN X.installedPackages AND version < '3.20.0'_
    - _Expected_Behavior: npm audit reports 0 high-severity vulnerabilities related to uploadthing or effect_
    - _Preservation: UploadThing file uploads continue to function; npm run build exits 0_
    - _Requirements: 2.7, 2.8, 3.6, 3.7_

  - [x] 3.5 Fix Bug 5 — Remove `.env.local` from git tracking
    - Run `git rm --cached .env.local` to untrack the file while keeping it on disk
    - Commit the removal
    - Rotate ALL exposed secrets in their respective dashboards: Clerk, Turso, Encryption key, Resend, Inngest, Upstash Redis, Sentry, UploadThing
    - _Bug_Condition: isBugCondition_5(X) where '.env.local' IN X.gitTrackedFiles_
    - _Expected_Behavior: git ls-files .env.local returns empty output; all exposed secrets are rotated_
    - _Preservation: .env.local remains on disk for local development; .env.example remains committed_
    - _Requirements: 2.9, 2.10, 2.11, 3.8, 3.9_

  - [x] 3.6 Fix Bug 6 — Replace `requireOwnedCompany` with `requireAccessibleCompany` in `[companyId]` route
    - In `src/app/api/forecast/result/[companyId]/route.ts`, update import to use `requireAccessibleCompany` instead of `requireOwnedCompany`
    - Replace both `requireOwnedCompany(userId, companyId)` calls (GET and POST handlers) with `requireAccessibleCompany(userId, companyId)`
    - _Bug_Condition: isBugCondition_6(X) where X.isOwner = false AND X.route = '/api/forecast/result/[companyId]'_
    - _Expected_Behavior: Team member GET returns 200, team member POST returns 201; requireAccessibleCompany checks company_members_
    - _Preservation: Owner GET/POST continue to return 200/201; unauthenticated requests continue to return 401_
    - _Requirements: 2.12, 2.13, 3.10, 3.11_

  - [x] 3.7 Fix Bug 7 — Add explicit `.env.local` entry to `.gitignore`
    - In `.gitignore`, add an explicit `.env.local` line near the existing `.env*.local` pattern
    - Verify `git check-ignore -v .env.local` confirms the file is ignored after Bug 5 fix
    - _Bug_Condition: isBugCondition_7(X) where NOT X.envLocalExplicitlyListed_
    - _Expected_Behavior: git check-ignore -v .env.local confirms file is explicitly ignored_
    - _Preservation: .env.example remains committable (!.env.example negation rule preserved); other .env.* patterns unaffected_
    - _Requirements: 2.14, 2.15, 3.12, 3.13_

  - [x] 3.8 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - All Seven Bug Conditions Resolved
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior for all seven bugs
    - When these tests pass, it confirms all expected behaviors are satisfied
    - Run all bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: All tests PASS (confirms all bugs are fixed)
    - _Requirements: 2.1, 2.3, 2.5, 2.7, 2.9, 2.12, 2.14_

  - [x] 3.9 Verify preservation tests still pass
    - **Property 2: Preservation** - No Regressions Introduced
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run all preservation property tests from step 2
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions)
    - Confirm all 96 existing tests still pass after fixes (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run `npm run build` and verify it exits 0
  - Run `npm run typecheck` (or equivalent) and verify it exits 0
  - Run `npm run lint` and verify it exits 0
  - Run the full test suite and verify all 96 tests pass
  - Run `npm audit` and verify 0 high-severity vulnerabilities
  - Ensure all tests pass; ask the user if questions arise.
