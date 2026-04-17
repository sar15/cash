# CashFlowIQ Deploy Audit Bugfix Design

## Overview

Seven production-blocking bugs discovered during a final pre-deployment audit. The fixes span:
- **Bug 1**: `useCurrentForecast` calls `POST /api/forecast/result/${company.id}` (path param route using `requireOwnedCompany`), blocking team members — fix is to switch to the query-string route `/api/forecast/result?companyId=...`
- **Bug 2**: 12 stale duplicate files with ` 2.{ext}` names polluting the repository — fix is to delete them
- **Bug 3**: `send.ts` falls back to `onboarding@resend.dev` when `RESEND_FROM_EMAIL` is unset — fix is to remove the hardcoded fallback
- **Bug 4**: `uploadthing` transitive dependency `effect` has 3 high-severity CVEs — fix is to add `npm overrides` pinning `effect>=3.20.0`
- **Bug 5**: `.env.local` is tracked in git, exposing production secrets — fix is `git rm --cached .env.local` and secret rotation
- **Bug 6**: `/api/forecast/result/[companyId]` route uses `requireOwnedCompany` for both GET and POST, blocking team members — fix is to switch to `requireAccessibleCompany`
- **Bug 7**: `.gitignore` lacks an explicit `.env.local` entry — fix is to add one

All fixes must preserve the existing build, typecheck, lint, and 96-test green baseline.

---

## Glossary

- **Bug_Condition (C)**: The condition that triggers a specific bug
- **Property (P)**: The desired correct behavior when the bug condition holds
- **Preservation**: Existing behaviors that must remain unchanged after the fix
- **requireOwnedCompany**: Function in `src/lib/server/auth.ts` that checks `company.clerkUserId === userId` — only passes for the company owner
- **requireAccessibleCompany**: Function in `src/lib/server/auth.ts` that checks `canAccessCompany(companyId, userId)` — passes for owners AND team members
- **resolveAuthedCompany**: Helper in `src/lib/api/helpers.ts` used by the flat `/api/forecast/result` route — resolves company from query string, supports team members
- **apiPost**: Client-side fetch wrapper in `src/lib/api/client.ts` used by `useCurrentForecast`
- **effect**: Transitive npm dependency pulled in by `uploadthing` / `@uploadthing/shared` with known CVEs below version 3.20.0

---

## Bug Details

### Bug 1 — Forecast Save URL Uses Path Param

The bug manifests when a team member (non-owner) triggers a forecast save. The `useCurrentForecast` hook calls `apiPost('/api/forecast/result/${company.id}', ...)` which routes to the `[companyId]` dynamic route. That route calls `requireOwnedCompany`, which throws 401 for any non-owner.

**Formal Specification:**
```
FUNCTION isBugCondition_1(X)
  INPUT: X of type { userId, companyId, isOwner, apiPath }
  OUTPUT: boolean

  RETURN X.isOwner = false
         AND X.apiPath = '/api/forecast/result/' + X.companyId
END FUNCTION
```

**Examples:**
- Team member with `company_members` row triggers forecast save → `POST /api/forecast/result/abc123` → 401 (bug)
- Owner triggers forecast save → `POST /api/forecast/result/abc123` → 201 (no bug, but wrong route)
- After fix: team member triggers forecast save → `POST /api/forecast/result?companyId=abc123` → 201 (correct)

---

### Bug 2 — 12 Duplicate " 2." Files

The bug manifests at repository checkout time. Twelve files with names ending in ` 2.{ext}` exist in `src/` and are tracked by git. They are never imported by any module.

**Formal Specification:**
```
FUNCTION isBugCondition_2(X)
  INPUT: X of type { repositoryFiles }
  OUTPUT: boolean

  RETURN EXISTS file IN X.repositoryFiles WHERE file.name MATCHES / 2\.(tsx?|ts)$/
END FUNCTION
```

**Files to delete:**
- `src/components/forecast/AccountRuleEditor 2.tsx`
- `src/components/forecast/SensitivityPanel 2.tsx`
- `src/components/shared/ErrorBoundary 2.tsx`
- `src/components/shared/Toast 2.tsx`
- `src/components/shared/UserTypeModal 2.tsx`
- `src/components/shared/skeleton 2.tsx`
- `src/lib/__tests__/cashflowiq-final-gaps.test 2.ts`
- `src/lib/email/send 2.ts`
- `src/lib/inngest/client 2.ts`
- `src/lib/reports/pdf-generator 2.ts`
- `src/lib/server/env 2.ts`
- `src/lib/utils/crypto 2.ts`

---

### Bug 3 — `send.ts` Hardcoded Fallback Sender

The bug manifests when `RESEND_FROM_EMAIL` is unset or empty in production. The line `const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'` overrides the env-level guard and sends from Resend's shared test domain, causing spam filtering.

**Formal Specification:**
```
FUNCTION isBugCondition_3(X)
  INPUT: X of type { RESEND_FROM_EMAIL }
  OUTPUT: boolean

  RETURN X.RESEND_FROM_EMAIL = '' OR X.RESEND_FROM_EMAIL = undefined
END FUNCTION
```

**Examples:**
- `RESEND_FROM_EMAIL` unset → `FROM = 'onboarding@resend.dev'` → emails spam-filtered (bug)
- After fix: `RESEND_FROM_EMAIL` unset → `FROM = ''` → resend guard skips sending (correct)
- `RESEND_FROM_EMAIL = 'noreply@cashflowiq.in'` → `FROM = 'noreply@cashflowiq.in'` (no bug, unchanged)

---

### Bug 4 — `effect` Dependency CVEs

The bug manifests when `npm audit` is run. `uploadthing@7.7.4` pulls in a vulnerable version of `effect` via `@uploadthing/shared`, reporting 3 high-severity vulnerabilities.

**Formal Specification:**
```
FUNCTION isBugCondition_4(X)
  INPUT: X of type { installedPackages }
  OUTPUT: boolean

  RETURN 'effect' IN X.installedPackages
         AND X.installedPackages['effect'].version < '3.20.0'
END FUNCTION
```

**Examples:**
- `npm audit` with current lockfile → 3 high CVEs in `effect` (bug)
- After adding `overrides: { "effect": ">=3.20.0" }` → `npm audit` reports 0 high CVEs (correct)

---

### Bug 5 — `.env.local` Committed to Git

The bug manifests when `git ls-files .env.local` returns the filename, confirming live production secrets are tracked in the git index.

**Formal Specification:**
```
FUNCTION isBugCondition_5(X)
  INPUT: X of type { gitTrackedFiles }
  OUTPUT: boolean

  RETURN '.env.local' IN X.gitTrackedFiles
END FUNCTION
```

**Examples:**
- `git ls-files .env.local` → `.env.local` (bug — secrets exposed)
- After `git rm --cached .env.local` → `git ls-files .env.local` → empty (correct)
- File still exists on disk for local dev (correct — only untracked, not deleted)

---

### Bug 6 — `[companyId]` Route Uses `requireOwnedCompany`

The bug manifests when a team member calls GET or POST on `/api/forecast/result/[companyId]`. The route uses `requireOwnedCompany` which only passes for the company owner.

**Formal Specification:**
```
FUNCTION isBugCondition_6(X)
  INPUT: X of type { userId, companyId, isOwner, route }
  OUTPUT: boolean

  RETURN X.isOwner = false
         AND X.route = '/api/forecast/result/[companyId]'
END FUNCTION
```

**Examples:**
- Team member GET `/api/forecast/result/abc123` → 401 (bug)
- Team member POST `/api/forecast/result/abc123` → 401 (bug)
- After fix: team member GET → 200, team member POST → 201 (correct)
- Owner GET/POST → still 200/201 (preserved — `requireAccessibleCompany` passes for owners too)

---

### Bug 7 — `.gitignore` Missing Explicit `.env.local` Entry

The bug manifests because `.env.local` was committed before the `.env*.local` pattern was added to `.gitignore`. Git continues tracking already-committed files regardless of `.gitignore` patterns. After Bug 5 is fixed (file untracked), an explicit entry prevents future accidental re-staging.

**Formal Specification:**
```
FUNCTION isBugCondition_7(X)
  INPUT: X of type { gitignoreContents, envLocalExplicitlyListed }
  OUTPUT: boolean

  RETURN NOT X.envLocalExplicitlyListed
         AND '.env.local' NOT IN X.gitignoreContents AS explicit_entry
END FUNCTION
```

**Examples:**
- `.gitignore` has `.env*.local` but not `.env.local` explicitly → future `git add .env.local` could succeed if file is re-tracked (bug)
- After fix: `.gitignore` has explicit `.env.local` → `git check-ignore -v .env.local` confirms ignored (correct)

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Company owners can continue to save and retrieve forecast results via any route
- Mouse/UI interactions unrelated to forecast saving are completely unaffected
- Email sending continues to work correctly when `RESEND_FROM_EMAIL` is properly configured
- File uploads via UploadThing continue to function without regression
- Local development continues to read secrets from `.env.local` on disk
- `.env.example` remains committed and serves as the reference template
- All 96 existing tests continue to pass
- `npm run build`, `typecheck`, and `lint` continue to exit 0
- The canonical (non-duplicate) source files are unaffected — only ` 2.` duplicates are removed
- Unauthenticated users continue to receive 401 on all protected routes

**Scope:**
All inputs that do NOT match the specific bug conditions above are completely unaffected by these fixes.

---

## Hypothesized Root Cause

### Bug 1
The `useCurrentForecast` hook was written before the flat query-string route (`/api/forecast/result`) existed, or was written assuming only owners would use the app. The path-param route (`[companyId]`) was the only option at the time, and it uses `requireOwnedCompany` by design (write operations on company-owned resources). The flat route with `resolveAuthedCompany` was added later to support team members but the hook was never updated.

### Bug 2
Likely caused by a file manager or IDE "duplicate" operation (macOS Finder appends ` 2` to duplicate filenames). The files were accidentally committed and never cleaned up.

### Bug 3
The `??` fallback was added as a convenience for local development but was never removed before production deployment. The `env.ts` module correctly defaults `RESEND_FROM_EMAIL` to `''`, but `send.ts` bypasses that by reading `process.env` directly with a hardcoded fallback.

### Bug 4
`uploadthing@7.7.4` has a transitive dependency on a vulnerable version of `effect` via `@uploadthing/shared`. The vulnerability was disclosed after the dependency was pinned. The fix is to use npm `overrides` to force a patched version without changing the `uploadthing` version itself.

### Bug 5
`.env.local` was committed to git at some point during development (possibly before `.gitignore` was configured, or the file was force-added). Once a file is tracked, `.gitignore` patterns have no effect on it.

### Bug 6
The `[companyId]` route was written for owner-only access (consistent with other write routes). When team member support was added to the app, this route was not updated. The flat route (`/api/forecast/result`) was created with team-member support, but the `[companyId]` route was left unchanged.

### Bug 7
The `.gitignore` pattern `.env*.local` was added after `.env.local` was already committed. Git ignores `.gitignore` for already-tracked files. An explicit entry is needed as a safety net after the file is untracked via `git rm --cached`.

---

## Correctness Properties

Property 1: Bug Condition — Team Member Forecast Save Succeeds

_For any_ request where the caller is a non-owner team member with a valid `company_members` row and the forecast save is triggered, the fixed `useCurrentForecast` hook SHALL call `POST /api/forecast/result?companyId={id}` (query-string route) and the server SHALL return 201, not 401.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation — Owner Forecast Save Unaffected

_For any_ request where the caller is the company owner, the fixed hook SHALL continue to persist the forecast result successfully via the query-string route, returning 201.

**Validates: Requirements 3.1, 3.2**

Property 3: Bug Condition — No Duplicate Files in Repository

_For any_ checkout of the repository after the fix, the system SHALL NOT contain any file whose name matches the pattern `/ 2\.(tsx?|ts)$/` in the `src/` directory.

**Validates: Requirements 2.3, 2.4**

Property 4: Preservation — Canonical Files Unaffected by Deletion

_For any_ build or typecheck run after the duplicate files are deleted, the system SHALL continue to exit 0 with no errors referencing the deleted files.

**Validates: Requirements 3.3**

Property 5: Bug Condition — No Hardcoded Email Fallback

_For any_ invocation of `send.ts` where `RESEND_FROM_EMAIL` is unset or empty, the fixed `FROM` constant SHALL NOT equal `'onboarding@resend.dev'`; it SHALL be an empty string, causing the existing `resend` guard to skip sending.

**Validates: Requirements 2.5, 2.6**

Property 6: Preservation — Configured Email Address Used As-Is

_For any_ invocation where `RESEND_FROM_EMAIL` is set to a valid address, the fixed code SHALL use that address as the `from` field, identical to the original behavior.

**Validates: Requirements 3.4, 3.5**

Property 7: Bug Condition — Zero High CVEs After Override

_For any_ run of `npm audit` after adding the `effect>=3.20.0` override, the system SHALL report 0 high-severity vulnerabilities related to `uploadthing` or `effect`.

**Validates: Requirements 2.7, 2.8**

Property 8: Preservation — UploadThing Functional After Override

_For any_ file upload operation after the dependency override, the system SHALL continue to upload files via UploadThing without functional regression.

**Validates: Requirements 3.6, 3.7**

Property 9: Bug Condition — `.env.local` Not Git-Tracked

_For any_ run of `git ls-files .env.local` after `git rm --cached .env.local`, the system SHALL return empty output.

**Validates: Requirements 2.9, 2.10, 2.11**

Property 10: Preservation — `.env.local` Remains on Disk

_For any_ local development run after the git untracking, the system SHALL continue to read secrets from `.env.local` on disk (file is only untracked, not deleted).

**Validates: Requirements 3.8, 3.9**

Property 11: Bug Condition — Team Member Access on `[companyId]` Route

_For any_ GET or POST request to `/api/forecast/result/[companyId]` from a non-owner team member with a valid `company_members` row, the fixed route SHALL use `requireAccessibleCompany` and return 200/201, not 401.

**Validates: Requirements 2.12, 2.13**

Property 12: Preservation — Owner and Unauthenticated Access Unchanged

_For any_ request to `/api/forecast/result/[companyId]` from the company owner, the fixed route SHALL continue to return 200/201. For unauthenticated requests, the route SHALL continue to return 401.

**Validates: Requirements 3.10, 3.11**

Property 13: Bug Condition — `.env.local` Explicitly Ignored

_For any_ run of `git check-ignore -v .env.local` after the `.gitignore` fix, the system SHALL confirm the file is explicitly ignored.

**Validates: Requirements 2.14, 2.15**

Property 14: Preservation — `.env.example` Remains Committable

_For any_ `git add .env.example` after the `.gitignore` fix, the file SHALL remain committable (the `!.env.example` negation rule is preserved).

**Validates: Requirements 3.12, 3.13**

---

## Fix Implementation

### Bug 1 — Change `apiPost` URL to Query String

**File**: `src/hooks/use-current-forecast.ts`

**Specific Change**: In the `useEffect` that persists the engine result, change the `apiPost` call from path-param to query-string:

```diff
- apiPost(`/api/forecast/result/${company.id}`, {
+ apiPost(`/api/forecast/result?companyId=${company.id}`, {
```

No other changes needed — the flat route at `src/app/api/forecast/result/route.ts` already exists and uses `resolveAuthedCompany` which supports both owners and team members.

---

### Bug 2 — Delete 12 Duplicate Files

**Action**: Delete all 12 files listed in the Bug Details section. No code changes required — none of these files are imported anywhere.

---

### Bug 3 — Fix `send.ts` Fallback

**File**: `src/lib/email/send.ts`

**Specific Change**: Remove the hardcoded `onboarding@resend.dev` fallback:

```diff
- // Use configured from address, fallback to Resend's onboarding domain for dev
- const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
+ // Use configured from address only — no fallback to test domain
+ const FROM = process.env.RESEND_FROM_EMAIL ?? ''
```

---

### Bug 4 — Add npm `overrides` for `effect`

**File**: `package.json`

**Specific Change**: Add an `overrides` field to force `effect>=3.20.0`:

```json
"overrides": {
  "effect": ">=3.20.0"
}
```

Run `npm install` after this change to regenerate the lockfile.

---

### Bug 5 — `git rm --cached .env.local`

**Action**: Run `git rm --cached .env.local` to remove the file from git tracking while keeping it on disk. Then commit the change. Additionally, rotate all secrets that were exposed: Clerk, Turso, Encryption key, Resend, Inngest, Upstash Redis, Sentry, UploadThing.

---

### Bug 6 — Use `requireAccessibleCompany` in `[companyId]` Route

**File**: `src/app/api/forecast/result/[companyId]/route.ts`

**Specific Changes**:
1. Update the import to include `requireAccessibleCompany`
2. Replace both `requireOwnedCompany` calls (GET and POST) with `requireAccessibleCompany`

```diff
- import { requireOwnedCompany, requireUserId } from '@/lib/server/auth'
+ import { requireAccessibleCompany, requireUserId } from '@/lib/server/auth'

  // In GET:
- const company = await requireOwnedCompany(userId, companyId)
+ const company = await requireAccessibleCompany(userId, companyId)

  // In POST:
- const company = await requireOwnedCompany(userId, companyId)
+ const company = await requireAccessibleCompany(userId, companyId)
```

---

### Bug 7 — Add `.env.local` to `.gitignore`

**File**: `.gitignore`

**Specific Change**: Add an explicit `.env.local` entry near the existing env patterns:

```diff
  .env*.local
+ .env.local
```

---

## Testing Strategy

### Validation Approach

Two-phase approach: first surface counterexamples on unfixed code to confirm root cause, then verify the fix and preservation.

---

### Exploratory Bug Condition Checking

**Goal**: Confirm each bug manifests as described before applying fixes.

**Test Cases**:
1. **Bug 1 — Team member 401**: Call `POST /api/forecast/result/{companyId}` as a non-owner → expect 401 (confirms bug)
2. **Bug 2 — Duplicate files exist**: `git ls-files | grep ' 2\.'` → expect 12 matches (confirms bug)
3. **Bug 3 — Hardcoded fallback**: Read `send.ts` source → expect `onboarding@resend.dev` string present (confirms bug)
4. **Bug 4 — CVE audit**: `npm audit --json` → expect 3 high-severity entries for `effect` (confirms bug)
5. **Bug 5 — Secrets tracked**: `git ls-files .env.local` → expect `.env.local` in output (confirms bug)
6. **Bug 6 — Team member 401 on [companyId]**: Call GET/POST as non-owner → expect 401 (confirms bug)
7. **Bug 7 — No explicit gitignore entry**: Read `.gitignore` → expect no standalone `.env.local` line (confirms bug)

**Expected Counterexamples**:
- Non-owner team members receive 401 on forecast save and retrieve routes
- `onboarding@resend.dev` appears as fallback in `send.ts`
- `npm audit` reports high CVEs

---

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition_1(X) DO
  result := useCurrentForecast_fixed(X)
  ASSERT result.apiCallPath CONTAINS '?companyId='
  ASSERT result.status ≠ 401
END FOR

FOR ALL X WHERE isBugCondition_3(X) DO
  result := resolveFromAddress_fixed(X)
  ASSERT result ≠ 'onboarding@resend.dev'
END FOR

FOR ALL X WHERE isBugCondition_5(X) DO
  ASSERT git_ls_files('.env.local') = ''
END FOR

FOR ALL X WHERE isBugCondition_6(X) DO
  result := routeHandler_fixed(X)
  ASSERT result.status ≠ 401
END FOR
```

---

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition_1(X) DO
  ASSERT routeHandler_original(X) = routeHandler_fixed(X)
END FOR

FOR ALL X WHERE NOT isBugCondition_3(X) DO
  ASSERT resolveFromAddress_original(X) = resolveFromAddress_fixed(X)
END FOR

FOR ALL X WHERE NOT isBugCondition_6(X) DO
  ASSERT routeHandler_original(X) = routeHandler_fixed(X)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because it generates many test cases automatically and catches edge cases that manual unit tests might miss.

---

### Unit Tests

- Verify `useCurrentForecast` constructs the URL with `?companyId=` query string, not path param
- Verify `send.ts` `FROM` constant is `''` when `RESEND_FROM_EMAIL` is unset
- Verify `send.ts` `FROM` constant equals the env value when `RESEND_FROM_EMAIL` is set
- Verify `requireAccessibleCompany` is called (not `requireOwnedCompany`) in the `[companyId]` route source
- Verify `.gitignore` contains an explicit `.env.local` line
- Verify none of the 12 duplicate files exist in the filesystem

### Property-Based Tests

- Generate random `companyId` strings and verify the constructed URL always uses `?companyId=` format
- Generate random `RESEND_FROM_EMAIL` values (including empty/undefined) and verify `FROM` never equals `'onboarding@resend.dev'`
- Generate random authenticated user contexts (owner vs team member) and verify the `[companyId]` route returns non-401 for all users with valid `company_members` rows

### Integration Tests

- Full forecast save flow as team member: engine runs → debounced save → `POST /api/forecast/result?companyId=...` → 201
- Full forecast retrieve flow as team member: `GET /api/forecast/result/[companyId]` → 200
- Email send with configured address: verify correct `from` field used
- `npm run build` exits 0 after all fixes applied
- `npm audit` reports 0 high CVEs after `effect` override
