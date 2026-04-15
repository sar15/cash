eu# CashFlowIQ Final Gaps Bugfix Design

## Overview

Four production bugs are addressed in this spec. Each is a targeted, minimal fix:

- **Gap 1**: `useCurrentForecast` appends `company.id` to the forecast result POST URL, hitting a non-existent route and silently dropping every forecast cache write. Fix: remove the path param and pass `companyId` as a query string instead (matching how `resolveAuthedCompany` reads it).
- **Gap 2**: Zoho OAuth tokens are stored as plaintext in the `integrations` table. Fix: add AES-256-GCM encrypt/decrypt helpers and apply them at the two write sites (callback route) and two read sites (sync.ts, client.ts token refresh).
- **Gap 4**: `addMember()` inserts with `acceptedAt = null`, so `canAccessCompany()` always returns `false` for invited members. Fix: set `acceptedAt` to the current timestamp at insert time.
- **Gap 6**: `RESEND_FROM_EMAIL` falls back to `'onboarding@resend.dev'` (Resend's shared test domain) with no warning. Fix: change fallback to `''` and emit a `console.warn` in production when it is empty.

---

## Glossary

- **Bug_Condition (C)**: The specific input state that triggers each defect
- **Property (P)**: The correct observable behavior once the fix is applied
- **Preservation**: Existing behaviors that must remain byte-for-byte identical after the fix
- **resolveAuthedCompany**: Helper in `src/lib/api/helpers.ts` that resolves `companyId` from the query string (`?companyId=`) or `x-company-id` header — it does NOT read the request body
- **isBugCondition**: Pseudocode predicate identifying inputs that trigger the bug
- **ENCRYPTION_KEY**: Environment variable holding the 32-byte hex key used for AES-256-GCM token encryption
- **acceptedAt**: Column on `companyMembers` that gates access via `canAccessCompany()`

---

## Bug Details

### Gap 1 — Forecast Result API Route Mismatch

#### Bug Condition

The bug manifests when `useCurrentForecast` debounces a forecast save. The `apiPost` call appends `company.id` to the path, producing `/api/forecast/result/<uuid>`, which has no matching Next.js route handler and returns HTTP 404. The `.catch(() => {})` silently discards the error.

**Formal Specification:**
```
FUNCTION isBugCondition_Gap1(call)
  INPUT: call — an apiPost invocation from useCurrentForecast
  OUTPUT: boolean

  RETURN call.url MATCHES pattern '/api/forecast/result/' + UUID
END FUNCTION
```

**Examples:**
- `apiPost('/api/forecast/result/abc-123', body)` → 404, forecast never cached
- `apiPost('/api/forecast/result/xyz-789', body)` → 404, forecast never cached
- `apiPost('/api/forecast/result?companyId=abc-123', body)` → 200/201, forecast cached ✓

---

### Gap 2 — Zoho OAuth Tokens Stored as Plaintext

#### Bug Condition

The bug manifests when the Zoho OAuth callback stores tokens. `tokens.accessToken` and `tokens.refreshToken` are written directly to the `integrations` table columns without encryption.

**Formal Specification:**
```
FUNCTION isBugCondition_Gap2(storedValue, originalToken)
  INPUT: storedValue — value read from integrations.access_token or integrations.refresh_token
         originalToken — the plaintext token returned by Zoho
  OUTPUT: boolean

  RETURN storedValue = originalToken  // stored as-is, not encrypted
END FUNCTION
```

**Examples:**
- Zoho returns `accessToken = "1000.abc..."` → DB stores `"1000.abc..."` verbatim (bug)
- After fix: DB stores `"<iv>:<ciphertext>"`, decrypt gives back `"1000.abc..."` ✓
- When `ENCRYPTION_KEY` is absent: log warning, store plaintext (graceful degradation)

---

### Gap 4 — Member Invite Has No Acceptance Flow

#### Bug Condition

The bug manifests when `addMember()` is called. The insert omits `acceptedAt`, so the column defaults to `null`. Any subsequent call to `canAccessCompany()` for that member evaluates `!!member?.acceptedAt` → `false`.

**Formal Specification:**
```
FUNCTION isBugCondition_Gap4(member)
  INPUT: member — a companyMembers row just inserted by addMember()
  OUTPUT: boolean

  RETURN member.acceptedAt IS NULL
END FUNCTION
```

**Examples:**
- `addMember('co-1', 'user-1', 'editor', 'owner-1')` → `acceptedAt = null` → `canAccessCompany` returns `false` (bug)
- After fix: `acceptedAt = '2024-01-15T10:00:00.000Z'` → `canAccessCompany` returns `true` ✓
- Owner check is unaffected — `canAccessCompany` checks direct ownership first

---

### Gap 6 — RESEND_FROM_EMAIL Fallback Is Test Domain

#### Bug Condition

The bug manifests at module load time when `RESEND_FROM_EMAIL` is not set. `optionalEnv` returns `'onboarding@resend.dev'`, which is Resend's shared test domain. Production emails are silently sent from this address.

**Formal Specification:**
```
FUNCTION isBugCondition_Gap6(env)
  INPUT: env — process.env at module evaluation time
  OUTPUT: boolean

  RETURN env.RESEND_FROM_EMAIL IS undefined OR env.RESEND_FROM_EMAIL = ''
         AND env.NODE_ENV = 'production'
END FUNCTION
```

**Examples:**
- `RESEND_FROM_EMAIL` unset, `NODE_ENV=production` → fallback `'onboarding@resend.dev'`, no warning (bug)
- After fix: fallback `''`, `console.warn` emitted in production ✓
- `RESEND_FROM_EMAIL=noreply@myapp.com` → used as-is, no warning ✓

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The forecast engine (`runScenarioForecastEngine`) remains a pure function with no DB calls inside it
- All monetary values remain integer paise — no floating-point arithmetic introduced
- Balance sheet identity (`totalAssets === totalLiabilities + totalEquity`) is unaffected
- Period values continue to use `YYYY-MM-01` format exclusively
- Every DB write continues to verify `clerkUserId` ownership before mutating data
- Inngest functions remain idempotent
- When `RESEND_FROM_EMAIL` is explicitly set, it is used without modification
- Company owner access via `canAccessCompany()` continues to work via the direct ownership check, unaffected by member table changes
- Zoho API calls continue to work correctly after the encrypt/decrypt round-trip (tokens are transparently decrypted before use)
- `POST /api/forecast/result` continues to upsert keyed on `(companyId, scenarioId)` without duplicates

**Scope:**
All inputs that do NOT match the four bug conditions above are completely unaffected by these fixes.

---

## Hypothesized Root Cause

### Gap 1
The developer likely copied a pattern from other routes that use path params (e.g., `/api/companies/[id]`) without checking that the forecast result route has no `[id]` segment. Additionally, `resolveAuthedCompany` reads `companyId` from the query string or header — never from the URL path — so even if a `[companyId]` segment existed, it would not be picked up automatically.

### Gap 2
Token encryption was noted as a TODO ("All tokens are stored encrypted in the DB" comment in `client.ts` header) but never implemented. The `integrations` table schema stores `access_token` and `refresh_token` as plain `text` columns with no encryption layer.

### Gap 4
`addMember()` was written to support a future email-invite flow where the user would click a link to accept. The `acceptedAt` field was intentionally left null to represent "pending". However, no acceptance endpoint was ever built, leaving all invited members permanently locked out.

### Gap 6
`onboarding@resend.dev` is Resend's documented test sender for development. It was used as a convenient fallback during development but was never updated to a safe production default (empty string with a warning).

---

## Correctness Properties

Property 1: Bug Condition — Forecast Save Reaches Correct Route

_For any_ forecast engine result where `company.id` is available, the fixed `useCurrentForecast` SHALL call `POST /api/forecast/result?companyId=<id>` (no path segment after `result`), receive a 2xx response, and the `forecast_results` table SHALL contain a row for that `companyId`.

**Validates: Requirements 2.1, 2.2**

---

Property 2: Bug Condition — Zoho Tokens Are Encrypted at Rest

_For any_ plaintext OAuth token string `t` written via the Zoho callback route, the fixed code SHALL store a value `s` in `integrations.access_token` / `integrations.refresh_token` such that `s ≠ t` AND `decrypt(s, ENCRYPTION_KEY) = t`.

**Validates: Requirements 2.3, 2.4**

---

Property 3: Bug Condition — Invited Member Can Access Company

_For any_ `(companyId, clerkUserId)` pair inserted via the fixed `addMember()`, `canAccessCompany(companyId, clerkUserId)` SHALL return `true` immediately after insertion, without any additional acceptance step.

**Validates: Requirements 2.5, 2.6**

---

Property 4: Bug Condition — RESEND_FROM_EMAIL Has Safe Fallback

_For any_ environment where `RESEND_FROM_EMAIL` is unset and `NODE_ENV === 'production'`, the fixed `env.ts` SHALL set `env.RESEND_FROM_EMAIL` to `''` (not `'onboarding@resend.dev'`) AND SHALL have called `console.warn` at module load time.

**Validates: Requirements 2.7, 2.8**

---

Property 5: Preservation — Encrypt/Decrypt Round-Trip Is Lossless

_For any_ plaintext string `t` (token value), `decrypt(encrypt(t, key), key) === t` SHALL hold for all valid `ENCRYPTION_KEY` values. The Zoho API calls that receive the decrypted token SHALL behave identically to calls that received the original plaintext token.

**Validates: Requirements 3.9**

---

Property 6: Preservation — Non-Buggy Inputs Are Unaffected

_For any_ input that does NOT match any of the four bug conditions (Gap 1–6), the fixed code SHALL produce exactly the same observable result as the original code — including forecast engine purity, paise arithmetic, balance sheet identity, period format, ownership checks, and Inngest idempotency.

**Validates: Requirements 3.1–3.10**

---

## Fix Implementation

### Gap 1 — `src/hooks/use-current-forecast.ts`

**Function**: `useCurrentForecast` (the `useEffect` that calls `apiPost`)

**Specific Changes:**
1. Change `apiPost('/api/forecast/result/${company.id}', { ... })` to `apiPost('/api/forecast/result?companyId=${company.id}', { ... })`
2. Remove `companyId` from the body — `resolveAuthedCompany` reads it from the query string, not the body. The body already contains `scenarioId`, `plData`, `bsData`, `cfData`, `compliance`, `metrics` which is all the route handler needs.

---

### Gap 2 — `src/lib/utils/crypto.ts` (new file)

**New helpers:**
```typescript
// AES-256-GCM encrypt/decrypt using @noble/ciphers
export function encrypt(plaintext: string, keyHex: string): string
export function decrypt(ciphertext: string, keyHex: string): string
```

**Format**: `<12-byte-iv-hex>:<ciphertext-hex>` stored as a single string.

**Graceful degradation**: if `ENCRYPTION_KEY` is not set, log a warning once and return plaintext unchanged (so existing dev setups don't break).

**Call sites:**
- `src/app/api/integrations/zoho/callback/route.ts` — encrypt before the two `.values({...})` and `.set({...})` writes
- `src/lib/integrations/zoho-books/sync.ts` — decrypt `integration.accessToken` and `integration.refreshToken` in `getValidToken()` before use, and encrypt the refreshed `accessToken` before writing back to DB
- `src/lib/integrations/zoho-books/client.ts` — no change needed (receives already-decrypted tokens from callers)

---

### Gap 4 — `src/lib/db/queries/company-members.ts`

**Function**: `addMember()`

**Specific Change:**
Add `acceptedAt: new Date().toISOString()` to the `.values({...})` object in the insert. The `onConflictDoUpdate` set clause does not need to update `acceptedAt` (existing members keep their original acceptance timestamp).

---

### Gap 6 — `src/lib/server/env.ts`

**Specific Changes:**
1. Change `optionalEnv('RESEND_FROM_EMAIL', 'onboarding@resend.dev')` to `optionalEnv('RESEND_FROM_EMAIL', '')`
2. Add a production warning block after the existing Inngest warning:
```typescript
if (isProduction && !process.env.RESEND_FROM_EMAIL) {
  console.warn('[CashFlowIQ] RESEND_FROM_EMAIL is not set — email sending will fail in production')
}
```

---

## Testing Strategy

### Validation Approach

Two-phase approach for each gap: first run exploratory tests on unfixed code to confirm the root cause, then verify the fix and preservation.

---

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug on unfixed code.

**Gap 1 Test Plan**: Mock `apiPost` and assert the URL it receives. On unfixed code, the URL will contain the company UUID as a path segment.

**Gap 2 Test Plan**: After the Zoho callback handler runs on unfixed code, read the `integrations` row and assert `accessToken === originalToken`. This will pass (confirming the bug — tokens are stored as-is).

**Gap 4 Test Plan**: Call `addMember()` then `canAccessCompany()` on unfixed code. `canAccessCompany` will return `false`.

**Gap 6 Test Plan**: Evaluate `env.ts` with `RESEND_FROM_EMAIL` unset. On unfixed code, `env.RESEND_FROM_EMAIL === 'onboarding@resend.dev'`.

**Expected Counterexamples:**
- Gap 1: URL is `/api/forecast/result/<uuid>` instead of `/api/forecast/result?companyId=<uuid>`
- Gap 2: Stored token equals plaintext input
- Gap 4: `canAccessCompany` returns `false` for a freshly invited member
- Gap 6: Fallback is `'onboarding@resend.dev'`, no warning emitted

---

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL call WHERE isBugCondition_Gap1(call) DO
  result := useCurrentForecast_fixed(call)
  ASSERT result.url = '/api/forecast/result?companyId=' + companyId
  ASSERT forecastResults HAS row FOR companyId
END FOR

FOR ALL token WHERE isBugCondition_Gap2(token) DO
  stored := integrations_fixed.access_token
  ASSERT stored ≠ token
  ASSERT decrypt(stored, ENCRYPTION_KEY) = token
END FOR

FOR ALL member WHERE isBugCondition_Gap4(member) DO
  result := canAccessCompany_fixed(member.companyId, member.clerkUserId)
  ASSERT result = true
END FOR

FOR ALL env WHERE isBugCondition_Gap6(env) DO
  ASSERT env_fixed.RESEND_FROM_EMAIL = ''
  ASSERT console.warn WAS called
END FOR
```

---

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT original(input) = fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for the encrypt/decrypt round-trip (Property 5) because it generates many random token strings and verifies lossless round-trips. Example-based tests cover the other preservation cases.

**Preservation Test Cases:**
1. **Owner access unaffected**: `canAccessCompany` for a company owner (not a member row) still returns `true` after the `addMember` fix
2. **Explicit RESEND_FROM_EMAIL respected**: When env var is set, `env.RESEND_FROM_EMAIL` equals the set value, no warning
3. **Encrypt/decrypt round-trip**: For random token strings, `decrypt(encrypt(t, key), key) === t`
4. **Forecast engine purity**: `runScenarioForecastEngine` produces identical output before and after the URL fix (no engine code touched)
5. **Token refresh write-back**: After a token refresh in `sync.ts`, the new access token is re-encrypted before DB write

---

### Unit Tests

- Gap 1: Assert `apiPost` is called with URL matching `/api/forecast/result?companyId=<id>` (not a path param)
- Gap 2: `encrypt(t, key) !== t` for any non-empty `t`; `decrypt(encrypt(t, key), key) === t`
- Gap 2: Graceful degradation — when `ENCRYPTION_KEY` absent, `encrypt` returns plaintext and logs warning
- Gap 4: After `addMember()`, the returned row has a non-null `acceptedAt` ISO string
- Gap 4: `canAccessCompany()` returns `true` for a member inserted via fixed `addMember()`
- Gap 6: `env.RESEND_FROM_EMAIL` is `''` when env var is unset
- Gap 6: `console.warn` is called in production when `RESEND_FROM_EMAIL` is empty

### Property-Based Tests

- **Property 2 (Encrypt/Decrypt)**: For any string `t` of length 1–512, `decrypt(encrypt(t, key), key) === t` — verifies lossless round-trip across the full token character space
- **Property 3 (Member Access)**: For any valid `(companyId, clerkUserId, role)` triple, `addMember()` followed by `canAccessCompany()` returns `true`
- **Property 5 (Preservation)**: For any token string `t`, the Zoho sync path that decrypts before use produces the same API call as if the plaintext token had been passed directly

### Integration Tests

- Gap 1: Full forecast save flow — engine runs, debounce fires, POST hits `/api/forecast/result?companyId=`, row appears in `forecast_results`
- Gap 2: Full Zoho OAuth flow — callback stores encrypted tokens, sync reads and decrypts them, Zoho API call succeeds
- Gap 4: Full member invite flow — `addMember()` called, invited user immediately accesses a protected route and gets 200
- Gap 6: App startup in production mode with `RESEND_FROM_EMAIL` unset — warning appears in logs, no crash
