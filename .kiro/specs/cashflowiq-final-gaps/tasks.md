# Implementation Plan

- [x] 1. Write bug condition exploration tests (expected to FAIL on unfixed code)
  - **Property 1: Bug Condition** - Forecast URL Path Param / Plaintext Tokens / Null acceptedAt / Wrong Email Fallback
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **GOAL**: Surface counterexamples that demonstrate each bug exists

  - [x] 1.1 Gap 1 — assert `apiPost` is called with company ID in path (not query string)
    - Mock `apiPost` and capture the URL argument from the debounced save in `useCurrentForecast`
    - Assert URL matches `/api/forecast/result/<uuid>` pattern (path param present)
    - Run on UNFIXED code — **EXPECTED OUTCOME**: test PASSES (confirms bug: path param is used)
    - Document counterexample: `apiPost('/api/forecast/result/abc-123', ...)` instead of `?companyId=abc-123`
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Gap 2 — assert tokens are stored as plaintext in integrations table
    - Simulate Zoho callback handler writing tokens to DB
    - Read back `integrations.accessToken` and assert it equals the original plaintext token string
    - Run on UNFIXED code — **EXPECTED OUTCOME**: test PASSES (confirms bug: stored value equals plaintext)
    - Document counterexample: `storedValue === '1000.abc...'` (no encryption applied)
    - _Requirements: 2.1, 2.2_

  - [x] 1.3 Gap 4 — assert `canAccessCompany` returns `false` for freshly invited member
    - Call `addMember('co-1', 'user-1', 'editor', 'owner-1')` then `canAccessCompany('co-1', 'user-1')`
    - Assert result is `false`
    - Run on UNFIXED code — **EXPECTED OUTCOME**: test PASSES (confirms bug: `acceptedAt` is null)
    - Document counterexample: `canAccessCompany` returns `false` immediately after invite
    - _Requirements: 4.1, 4.2_

  - [x] 1.4 Gap 6 — assert `RESEND_FROM_EMAIL` fallback is `'onboarding@resend.dev'` with no warning
    - Load `env.ts` with `RESEND_FROM_EMAIL` unset and `NODE_ENV=production`
    - Assert `env.RESEND_FROM_EMAIL === 'onboarding@resend.dev'`
    - Assert `console.warn` was NOT called for the email fallback
    - Run on UNFIXED code — **EXPECTED OUTCOME**: test PASSES (confirms bug: wrong fallback, no warning)
    - Document counterexample: fallback is test domain, no production warning emitted
    - _Requirements: 6.1_

- [x] 2. Write preservation property tests (BEFORE implementing fixes)
  - **Property 2: Preservation** - Non-Buggy Inputs Are Unaffected
  - **IMPORTANT**: Follow observation-first methodology — observe UNFIXED code behavior first
  - Run tests on UNFIXED code — **EXPECTED OUTCOME**: Tests PASS (confirms baseline to preserve)

  - [x] 2.1 Owner access unaffected by `addMember` fix
    - Observe: `canAccessCompany` for a company owner (no member row) returns `true` on unfixed code
    - Write test: owner access still returns `true` after fix is applied
    - _Requirements: 3.8_

  - [x] 2.2 Explicit `RESEND_FROM_EMAIL` is used as-is, no warning
    - Observe: when `RESEND_FROM_EMAIL=noreply@myapp.com` is set, `env.RESEND_FROM_EMAIL` equals that value on unfixed code
    - Write test: same behavior holds after fix; `console.warn` is NOT called when value is set
    - _Requirements: 3.7_

  - [x] 2.3 **Property 2: Preservation** — Encrypt/decrypt round-trip is lossless
    - **Scoped PBT Approach**: For any string `t` of length 1–512 chars, `decrypt(encrypt(t, key), key) === t`
    - Use property-based testing to generate random token strings across the full character space
    - Verify on unfixed code that the crypto helpers (once written) satisfy this invariant
    - Verify tests PASS before and after fix
    - _Requirements: 3.9_

  - [x] 2.4 Forecast engine purity unaffected by URL fix
    - Observe: `runScenarioForecastEngine` produces identical output regardless of URL change (engine code untouched)
    - Write test: engine output is byte-for-byte identical before and after Gap 1 fix
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix Gap 1 — Forecast result API route mismatch (`src/hooks/use-current-forecast.ts`)

  - [x] 3.1 Change path param to query string in `apiPost` call
    - In the `useEffect` debounce block, change:
      `apiPost(\`/api/forecast/result/${company.id}\`, { ... })`
      to:
      `apiPost(\`/api/forecast/result?companyId=${company.id}\`, { ... })`
    - Remove `companyId` from the body if present — `resolveAuthedCompany` reads it from query string only
    - _Bug_Condition: isBugCondition_Gap1 — call.url matches `/api/forecast/result/<uuid>` path pattern_
    - _Expected_Behavior: URL is `/api/forecast/result?companyId=<uuid>`, returns 2xx, row written to forecast_results_
    - _Preservation: forecast engine remains pure, paise arithmetic unchanged, upsert keyed on (companyId, scenarioId)_
    - _Requirements: 2.1, 2.2, 3.1, 3.10_

  - [x] 3.2 Verify bug condition exploration test now passes (Gap 1)
    - **Property 1: Expected Behavior** — Forecast URL uses query string
    - **IMPORTANT**: Re-run the SAME test from task 1.1 — do NOT write a new test
    - Assert `apiPost` is called with `/api/forecast/result?companyId=<uuid>` (no path segment)
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass (Gap 1)
    - **Property 2: Preservation** — Forecast engine purity
    - Re-run tests from task 2.4
    - **EXPECTED OUTCOME**: Tests PASS (no regressions)

- [x] 4. Fix Gap 2 — Zoho OAuth tokens stored as plaintext

  - [x] 4.1 Install `@noble/ciphers` package
    - Run `npm install @noble/ciphers`
    - Verify package appears in `package.json` dependencies
    - _Requirements: 2.3_

  - [x] 4.2 Create `src/lib/utils/crypto.ts` with AES-256-GCM helpers
    - Implement `encrypt(plaintext: string, keyHex: string): string` — format: `<12-byte-iv-hex>:<ciphertext-hex>`
    - Implement `decrypt(ciphertext: string, keyHex: string): string`
    - Graceful degradation: if `ENCRYPTION_KEY` env var is absent, log warning once and return plaintext unchanged
    - _Bug_Condition: isBugCondition_Gap2 — storedValue equals originalToken (no encryption applied)_
    - _Expected_Behavior: stored value ≠ plaintext; decrypt(stored, key) = plaintext_
    - _Preservation: encrypt/decrypt round-trip is lossless for all valid token strings_
    - _Requirements: 2.3, 2.4, 3.9_

  - [x] 4.3 Apply `encrypt` at Zoho callback write sites (`src/app/api/integrations/zoho/callback/route.ts`)
    - Import `encrypt` from `@/lib/utils/crypto`
    - In the `.values({...})` block: wrap `tokens.accessToken` and `tokens.refreshToken` with `encrypt(..., process.env.ENCRYPTION_KEY ?? '')`
    - Apply the same wrapping in the `.onConflictDoUpdate` `.set({...})` block
    - _Requirements: 2.3_

  - [x] 4.4 Apply `decrypt` at sync read sites (`src/lib/integrations/zoho-books/sync.ts`)
    - Import `decrypt` from `@/lib/utils/crypto`
    - In `getValidToken()`: decrypt `integration.accessToken` before returning it (when not expired)
    - Decrypt `integration.refreshToken` before passing to `refreshAccessToken()`
    - Re-encrypt the refreshed `accessToken` before writing back to DB in the token refresh path
    - _Requirements: 2.4, 3.9_

  - [x] 4.5 Verify bug condition exploration test now passes (Gap 2)
    - **Property 1: Expected Behavior** — Tokens are encrypted at rest
    - Re-run the SAME test from task 1.2
    - Assert stored value ≠ plaintext AND `decrypt(stored, key) === plaintext`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.3, 2.4_

  - [x] 4.6 Verify preservation tests still pass (Gap 2)
    - **Property 2: Preservation** — Encrypt/decrypt round-trip
    - Re-run tests from task 2.3
    - **EXPECTED OUTCOME**: Tests PASS (no regressions)

- [x] 5. Fix Gap 4 — Member invite has no acceptance flow (`src/lib/db/queries/company-members.ts`)

  - [x] 5.1 Add `acceptedAt` to `addMember()` insert values
    - In the `.values({...})` object, add: `acceptedAt: new Date().toISOString()`
    - The `onConflictDoUpdate` set clause does NOT need to update `acceptedAt` (existing members keep original timestamp)
    - _Bug_Condition: isBugCondition_Gap4 — member.acceptedAt IS NULL after addMember()_
    - _Expected_Behavior: acceptedAt is a non-null ISO string; canAccessCompany returns true immediately_
    - _Preservation: owner access via direct ownership check is unaffected_
    - _Requirements: 2.5, 2.6, 3.8_

  - [x] 5.2 Verify bug condition exploration test now passes (Gap 4)
    - **Property 1: Expected Behavior** — Invited member can access company
    - Re-run the SAME test from task 1.3
    - Assert `canAccessCompany` returns `true` immediately after `addMember()`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.5, 2.6_

  - [x] 5.3 Verify preservation tests still pass (Gap 4)
    - **Property 2: Preservation** — Owner access unaffected
    - Re-run tests from task 2.1
    - **EXPECTED OUTCOME**: Tests PASS (no regressions)

- [x] 6. Fix Gap 6 — RESEND_FROM_EMAIL fallback is test domain (`src/lib/server/env.ts`)

  - [x] 6.1 Change fallback and add production warning
    - Change `optionalEnv('RESEND_FROM_EMAIL', 'onboarding@resend.dev')` to `optionalEnv('RESEND_FROM_EMAIL', '')`
    - Add warning block after the existing Inngest warning:
      ```typescript
      if (isProduction && !process.env.RESEND_FROM_EMAIL) {
        console.warn('[CashFlowIQ] RESEND_FROM_EMAIL is not set — email sending will fail in production')
      }
      ```
    - _Bug_Condition: isBugCondition_Gap6 — RESEND_FROM_EMAIL unset in production, fallback is test domain_
    - _Expected_Behavior: fallback is '', console.warn emitted in production when unset_
    - _Preservation: when RESEND_FROM_EMAIL is explicitly set, it is used as-is with no warning_
    - _Requirements: 2.7, 2.8, 3.7_

  - [x] 6.2 Verify bug condition exploration test now passes (Gap 6)
    - **Property 1: Expected Behavior** — Safe email fallback with production warning
    - Re-run the SAME test from task 1.4
    - Assert `env.RESEND_FROM_EMAIL === ''` and `console.warn` was called
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.7, 2.8_

  - [x] 6.3 Verify preservation tests still pass (Gap 6)
    - **Property 2: Preservation** — Explicit env var respected
    - Re-run tests from task 2.2
    - **EXPECTED OUTCOME**: Tests PASS (no regressions)

- [x] 7. Checkpoint — Ensure all tests pass
  - Re-run the full test suite covering all four gaps
  - Confirm exploration tests (tasks 1.1–1.4) now PASS after fixes
  - Confirm preservation tests (tasks 2.1–2.4) still PASS
  - Confirm no TypeScript errors in modified files: `use-current-forecast.ts`, `crypto.ts`, `callback/route.ts`, `sync.ts`, `company-members.ts`, `env.ts`
  - Ask the user if any questions arise
