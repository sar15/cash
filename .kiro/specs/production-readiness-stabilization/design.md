# Production Readiness Stabilization — Bugfix Design

## Overview

CashFlowIQ has a broken production build and a cluster of medium-risk issues that must be resolved before the app can be safely deployed. The fix strategy is surgical: address each defect at its root, validate with targeted tests, and confirm that the 90 currently-passing tests continue to pass. No feature work is in scope.

The bug condition spans multiple independent defects. Each is treated as its own sub-condition with its own fix and preservation check.

---

## Glossary

- **Bug_Condition (C)**: Any input or startup state that triggers one of the 19 defects catalogued in the requirements document
- **Property (P)**: The desired observable behavior after the fix — build exits 0, lint reports 0 errors, all 101 tests pass, startup validates env, CSP has no unsafe directives in production
- **Preservation**: The 90 currently-passing tests, correct PDF download behavior, email sending when configured, rate limiting when Redis is present, and all authenticated API routes continue to work exactly as before
- **proxy.ts**: The Next 16 replacement for `middleware.ts` — exports a named `proxy` function instead of `middleware`; file lives at `src/proxy.ts`
- **instrumentation.ts**: Next.js server entry point called once at startup before any request is served; the correct place to import `env.ts` for fail-fast validation
- **isBugCondition(input)**: Pseudocode predicate that returns true when an input triggers one of the catalogued defects
- **Serwist**: The recommended Next 16 PWA/service-worker library (replaces `next-pwa`); see `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`

---

## Bug Details

### Bug Condition

The production readiness defects manifest across build, typecheck, lint, test, dependency, env-validation, middleware, CSP, silent-failure, rate-limit, CI, auth, and workspace layers.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type AppState | BuildInvocation | Request | StartupEvent
  OUTPUT: boolean

  RETURN (
    -- Hard Blocker 1a
    (input IS BuildInvocation AND route "download/route.ts" uses new NextResponse(buffer, {headers}))
    OR
    -- Hard Blocker 1b
    (input IS TypecheckInvocation AND typecheck exits non-zero)
    OR
    -- Hard Blocker 2
    (input IS LintInvocation AND linter reports errors > 0)
    OR
    -- Hard Blocker 3
    (input IS TestInvocation AND failingTestCount > 0)
    OR
    -- Hard Blocker 4
    (input IS BuildInvocation AND vulnerableDependencyPresent(next@16.2.2 OR xlsx@0.18.5 OR next-pwa@5.6.0))
    OR
    -- Hard Blocker 5
    (input IS StartupEvent AND env.ts NOT imported in instrumentation.ts)
    OR
    -- Medium Risk 1
    (input IS Request AND middleware.ts exports "middleware" function instead of "proxy")
    OR
    -- Medium Risk 2
    (input IS Request AND CSP script-src contains 'unsafe-eval' OR 'unsafe-inline' in production)
    OR
    -- Medium Risk 3a
    (input IS EmailSendAttempt AND RESEND_API_KEY missing AND NODE_ENV = production AND logLevel = "log")
    OR
    -- Medium Risk 3b
    (input IS WebhookRequest AND CLERK_WEBHOOK_SECRET missing AND returns 200 silently)
    OR
    -- Medium Risk 3c
    (input IS APIRequest AND unhandledError AND response is plain-text not JSON)
    OR
    -- Medium Risk 4
    (input IS StartupEvent AND UPSTASH_REDIS_REST_URL missing AND NODE_ENV = production AND noStartupLog)
    OR
    -- Medium Risk 5
    (input IS PushEvent AND noCIWorkflowFile)
    OR
    -- Medium Risk 6
    (input IS APIRequest AND route lacks shared auth/company helpers)
    OR
    -- Medium Risk 7
    (input IS BuildInvocation AND duplicateGeneratedFilesPresent)
  )
END FUNCTION
```

### Examples

- `npm run build` exits 1 — `new NextResponse(buffer, { headers })` is not assignable to `Response` in Next 16's stricter route handler types; fix: use `new Response(buffer, { headers })`
- `npm run typecheck` exits 1 — independent type errors beyond the build failure; fix: resolve each error individually
- `npm run lint` reports 31 errors — React hooks called conditionally or inside callbacks in `use-current-forecast.ts` line 176, `AppTopbar.tsx` line 96, `reconciliation/page.tsx` line 28; fix: restructure to unconditional hook calls
- Crypto tests fail with `Error: ENCRYPTION_KEY environment variable not set` — no Vitest setup file provisions the key; fix: add `vitest.setup.ts` that sets `process.env.ENCRYPTION_KEY`
- App starts in production with missing `TURSO_DATABASE_URL` and only crashes on first DB query — `env.ts` is never imported; fix: import in `instrumentation.ts`

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- A valid authenticated GET to `/api/reports/download?key=reports/{companyId}/...` SHALL continue to return the PDF buffer with `Content-Type: application/pdf`, `Content-Disposition: attachment`, and `Cache-Control: private, max-age=3600`
- When `RESEND_API_KEY` is set and valid, `sendComplianceReminder`, `sendWelcomeEmail`, and `sendImportSuccessEmail` SHALL continue to send emails via Resend with the same HTML templates
- When `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, the distributed Upstash rate limiter SHALL continue to enforce 100 req/min (general) and 10/hour (import) sliding-window limits
- When all required env vars are present, the app SHALL start normally with no new errors or warnings
- All 90 currently-passing tests SHALL continue to pass after every fix
- The PWA service worker SHALL continue to register and support offline functionality after the `next-pwa` → Serwist migration
- `encryptToken` / `decryptToken` SHALL continue to use XChaCha20-Poly1305 with the same base64 output format
- All non-public routes SHALL continue to be protected by Clerk auth via the proxy (formerly middleware)

**Scope:**
All inputs that do NOT match `isBugCondition` are completely unaffected by these fixes.

---

## Hypothesized Root Cause

1. **Binary Response Type (1a)**: Next 16 tightened route handler return types. `NextResponse` constructor accepts `BodyInit | null` but TypeScript now enforces that route handlers return `Response`, not `NextResponse`, when passing a raw `Buffer`. The fix is to use the standard Web API `new Response(buffer, { headers })` which is the correct type for binary route responses.

2. **Independent Type Errors (1b)**: Accumulated type drift from dependency upgrades (React 19, Clerk 7, Zod 4, Lucide 1.x). Each must be identified via `tsc --noEmit` output and fixed individually.

3. **React Render-Pattern Lint Violations (2)**: The three flagged files call hooks or render JSX inside callbacks/conditions. `use-current-forecast.ts` line 176 likely has a hook call inside a `.map()` or conditional. `AppTopbar.tsx` line 96 likely renders a component inside an event handler. `reconciliation/page.tsx` line 28 likely has a hook call inside a conditional block. Each must be refactored to move the hook call to the top level.

4. **Stale Test Expectations (3a)**: Tests in `cashflowiq-final-gaps.test.ts` assert `apiPost` uses a query-string URL (`/api/forecast/result?companyId=`) but the hook was already fixed to use a path param (`/api/forecast/result/${company.id}`). The test expectation is inverted — it asserts the old (buggy) pattern. These tests need their assertions flipped to match the current correct code.

5. **Missing ENCRYPTION_KEY in Tests (3b)**: `encryptToken` / `decryptToken` call `getEncryptionKey()` which throws if `process.env.ENCRYPTION_KEY` is unset. Vitest has no setup file that provisions this key. Fix: create `vitest.setup.ts` at the project root that sets a deterministic 64-hex-char test key, and reference it in a `vitest` config block in `package.json`.

6. **Vulnerable Dependencies (4)**: `next@16.2.2` has a known DoS advisory fixed in `16.2.3`. `xlsx@0.18.5` has prototype-pollution and ReDoS advisories. `next-pwa@5.6.0` pulls in a vulnerable `serialize-javascript` via Workbox. The Next 16 PWA guide recommends Serwist as the replacement.

7. **env.ts Never Imported (5)**: `src/lib/server/env.ts` exports an `env` object but is never imported at the server entry point. Next.js calls `instrumentation.ts`'s `register()` function once at startup before any request — this is the correct place to `await import('@/lib/server/env')`.

8. **Middleware → Proxy Migration (M1)**: Next 16 deprecated `middleware.ts` and renamed the convention to `proxy.ts` with a named `proxy` export. The existing `middleware.ts` still works via backward compatibility but emits deprecation warnings. The codemod `npx @next/codemod@canary middleware-to-proxy .` handles the rename automatically.

9. **Unsafe CSP (M2)**: `next.config.ts` sets `'unsafe-eval'` and `'unsafe-inline'` globally in `script-src`. Next 16's CSP guide recommends moving CSP generation to `proxy.ts` using per-request nonces (`crypto.randomUUID()` → base64), setting `x-nonce` header, and using `'nonce-{value}' 'strict-dynamic'` in `script-src`. `'unsafe-eval'` is only needed in development. Static assets and API routes should be excluded from the nonce matcher.

10. **Silent Email Failure (M3a)**: `send.ts` line 31 uses `console.log` when `resend` is null in production. Should be `console.error` and should only skip silently in development.

11. **Silent Webhook No-op (M3b)**: `webhooks/clerk/route.ts` returns `{ received: true }` with 200 when `CLERK_WEBHOOK_SECRET` is missing. In production this silently drops all user lifecycle events. Should return 500 with an error log in production.

12. **Plain-text API Errors (M3c)**: `handleRouteError` in `api.ts` calls `textError('Internal Error', 500)` which returns `Content-Type: text/plain`. Clients expect JSON. Should call `jsonError` instead.

13. **In-Memory Rate Limit Startup Warning (M4)**: `rate-limit.ts` logs `console.warn` at module load time when Redis is absent in production. The requirements ask for `console.error` at startup, with hard failure only when `STRICT_PROD_GUARDS=true`.

14. **No CI Pipeline (M5)**: No `.github/workflows/` directory exists. A `ci.yml` workflow must run `typecheck`, `lint`, `test --run`, and `build` on push and pull_request.

15. **Auth Consistency Drift (M6)**: Some API routes use `auth()` directly instead of `resolveAuthedCompany`. An audit of all `src/app/api/**/route.ts` files is needed to identify routes that bypass the shared helper.

16. **Workspace Artifacts (M7)**: `.next/dev/types/` may contain `* 2.ts` duplicate files from macOS copy operations. These should be deleted and `.gitignore` updated to exclude `.next/`.

---

## Correctness Properties

Property 1: Bug Condition — Build, Typecheck, Lint, Test, and Startup All Pass

_For any_ invocation of `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test --run`, or a production server startup, the fixed codebase SHALL complete with exit code 0 and zero errors, with all 101 tests passing and the server validating all required env vars before serving any request.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**

Property 2: Preservation — Existing Correct Behaviors Unchanged

_For any_ input where the bug condition does NOT hold (authenticated PDF download, email send with valid key, rate limiting with Redis configured, all 90 passing tests), the fixed code SHALL produce exactly the same result as the original code, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

---

## Fix Implementation

### 1a — Binary Response in `src/app/api/reports/download/route.ts`

**Root cause**: `new NextResponse(buffer, { headers })` — `NextResponse` constructor is typed for middleware use; route handlers must return a plain `Response`.

**Change**:
```typescript
// Before (line 21):
return new NextResponse(buffer, { headers: { ... } })

// After:
return new Response(buffer, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, max-age=3600',
  },
})
```

The `getFile(key)` return type must be confirmed as `Buffer | Uint8Array | ArrayBuffer` — all are valid `BodyInit`. No other changes to the route.

### 1b — Independent TypeCheck Failures

Run `npx tsc --noEmit 2>&1` and fix each error. Common patterns to expect:
- Zod 4 changed `z.ZodError` shape — `z.flattenError` may need type adjustment
- React 19 stricter `ref` types on DOM elements
- Clerk 7 changed some auth helper return types
- Lucide 1.x icon prop types changed

Each fix is local to the file reporting the error. No architectural changes.

### 2 — Lint Errors

**`src/hooks/use-current-forecast.ts` line 176**: Likely a hook called inside a callback. Refactor so all hooks are called unconditionally at the top of the component/hook body. Extract the callback logic into a non-hook helper.

**`src/components/layout/AppTopbar.tsx` line 96**: The `NotificationBell` component is defined inside `AppTopbar`. React lint rules flag components defined inside other components. Move `NotificationBell` to module scope (above `AppTopbar`).

**`src/app/(app)/reconciliation/page.tsx` line 28**: Likely a hook called inside a conditional. Move the hook call above the conditional return.

For all 31 errors + 22 warnings: run `npx eslint . --format=json` to get the full list, then fix each. Common patterns: missing `key` props, `useEffect` dependency arrays, `no-unused-vars`.

### 3 — Failing Tests

**Stale URL assertions** (`cashflowiq-final-gaps.test.ts`): The test at line ~30 asserts the old query-string URL pattern. The hook already uses the path-param pattern. Flip the assertion:
```typescript
// Fix: assert the CORRECT (current) pattern
expect(src).toContain('`/api/forecast/result/${company.id}`')
expect(src).not.toContain('`/api/forecast/result?companyId=')
```

**Missing ENCRYPTION_KEY**: Create `vitest.setup.ts`:
```typescript
// vitest.setup.ts
process.env.ENCRYPTION_KEY = 'a'.repeat(64) // 32 bytes of 0xaa — deterministic test key
```

Add to `package.json` under a `"vitest"` config key:
```json
"vitest": {
  "setupFiles": ["./vitest.setup.ts"]
}
```

**`integrationResults` vs `rawIntegrationResults`**: `cashflowiq-final-gaps.test.ts` line ~180 references `result1.integrationResults` but the engine returns `rawIntegrationResults`. Update the test to use the correct property name.

### 4 — Dependency Upgrades

**`next@16.2.2` → `16.2.3`**: `npm install next@16.2.3 eslint-config-next@16.2.3`

**`xlsx@0.18.5`**: Replace with `exceljs` (no known high-severity advisories) or pin to a patched fork. If keeping xlsx, add input validation (file size limit, sheet count limit) before parsing to mitigate ReDoS. Preferred: migrate import path to use `exceljs` which has an actively maintained security posture.

**`next-pwa@5.6.0`**: Remove and replace with Serwist per the Next 16 PWA guide. Steps:
1. `npm uninstall next-pwa`
2. `npm install @serwist/next serwist`
3. Remove `withPWAInit` wrapper from `next.config.ts`
4. Add Serwist plugin per its Next.js integration docs
5. Create `src/app/sw.ts` service worker entry
6. Move `public/manifest.json` to `app/manifest.ts` (Next 16 built-in manifest support)

### 5 — Environment Validation

**Create `src/instrumentation.ts`**:
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/server/env')
  }
}
```

**Update `src/lib/server/env.ts`** — add two-tier validation:
- Tier 1 (always required in production): `TURSO_DATABASE_URL`, `CLERK_SECRET_KEY`
- Tier 2 (required when feature is enabled): `ENCRYPTION_KEY` (when `ZOHO_CLIENT_ID` is set), `RESEND_FROM_EMAIL` (when `RESEND_API_KEY` is set), `INNGEST_*` (when `INNGEST_EVENT_KEY` is set), `R2_*` (when `R2_ENDPOINT` is set), `UPSTASH_*` (when `UPSTASH_REDIS_REST_URL` is set)

`ENCRYPTION_KEY` should be validated at startup (not call time) when any Zoho env var is present, since it is required for the Zoho integration to function.

### M1 — Middleware → Proxy Migration

Run the official codemod:
```bash
npx @next/codemod@canary middleware-to-proxy .
```

This renames `src/middleware.ts` → `src/proxy.ts` and changes `export function middleware` → `export function proxy`. The `config` export and all logic remain identical. Verify the Clerk `clerkMiddleware` wrapper still works — Clerk 7 supports the proxy convention.

### M2 — CSP Nonces via proxy.ts

Move CSP generation from `next.config.ts` static headers into `proxy.ts`. Per the Next 16 CSP guide:

```typescript
// src/proxy.ts (merged with existing auth/rate-limit logic)
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} https://clerk.cashflowiq.in https://*.clerk.accounts.dev`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://img.clerk.com",
    "connect-src 'self' https://*.clerk.accounts.dev https://*.ingest.sentry.io wss://*.clerk.accounts.dev",
    "frame-src 'self' https://*.clerk.accounts.dev",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}
```

Remove the static `Content-Security-Policy` entry from `next.config.ts` `headers()`. Keep all other security headers there (X-Frame-Options, HSTS, etc.).

The nonce matcher must exclude API routes, static files, and image optimization to avoid overhead:
```typescript
export const config = {
  matcher: [{
    source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
    missing: [
      { type: 'header', key: 'next-router-prefetch' },
      { type: 'header', key: 'purpose', value: 'prefetch' },
    ],
  }],
}
```

Pages that use inline scripts must call `await connection()` to force dynamic rendering (required for nonce injection).

### M3 — Silent Failure Modes

**`src/lib/email/send.ts`**: Change `console.log` → `console.error` when `resend` is null AND `NODE_ENV === 'production'`. In development, keep the existing `console.log` skip behavior.

**`src/app/api/webhooks/clerk/route.ts`**: When `webhookSecret` is missing in production, return `NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })` and log `console.error`. In development, keep the silent skip.

**`src/lib/server/api.ts`**: Change `textError('Internal Error', 500)` → `jsonError('Internal Error', 500)` in `handleRouteError`. This ensures all unhandled errors return `Content-Type: application/json`.

### M4 — Rate Limit Startup Signal

**`src/lib/rate-limit.ts`**: Change the bottom-of-file warning from `console.warn` → `console.error`. Add hard-fail when `STRICT_PROD_GUARDS=true`:
```typescript
if (!redis && process.env.NODE_ENV === 'production') {
  console.error('[RateLimit] UPSTASH_REDIS_REST_URL not configured...')
  if (process.env.STRICT_PROD_GUARDS === 'true') {
    throw new Error('Rate limiting requires Redis in strict production mode')
  }
}
```

### M5 — CI Pipeline

Create `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test -- --run
      - run: npm run build
    env:
      ENCRYPTION_KEY: ${{ secrets.CI_ENCRYPTION_KEY || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }}
      TURSO_DATABASE_URL: file:ci.db
      CLERK_SECRET_KEY: sk_test_ci
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_ci
```

### M6 — Auth Consistency

Audit all `src/app/api/**/route.ts` files. Any route that calls `auth()` directly without going through `resolveAuthedCompany` must either:
1. Be migrated to use `resolveAuthedCompany` + `isErrorResponse` guard, OR
2. Have an explicit comment explaining why it is an owner-only or public exception

### M7 — Workspace Cleanliness

Add `.next/` to `.gitignore` if not already present. Delete any `* 2.ts` files under `.next/dev/types/`. Add a CI step or pre-commit hook that fails if `.next/` contains files tracked by git.

### Operational Readiness

**Migrations**: Run `npm run db:migrate` before deploying new code. Verify with `drizzle-kit status` that all migrations are applied.

**Rollback**: Keep the previous deployment artifact. Vercel/Fly.io instant rollback via dashboard. For DB: Turso point-in-time restore.

**Turso Backup**: `turso db shell <db-name> .dump > backup-$(date +%Y%m%d).sql` before each production deploy.

**Post-deploy smoke test checklist**:
1. `GET /api/health` → 200
2. Sign in → dashboard loads
3. Import a CSV → forecast renders
4. Download a report → PDF downloads
5. Check Sentry for new errors in the 5 minutes post-deploy

**Sentry**: Verify `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are set. The existing `withSentryConfig` wrapper in `next.config.ts` is already correct. Add a test error in `instrumentation.ts` that is caught and reported on first startup.

**Health endpoint**: `src/app/api/health/route.ts` should return `{ status: 'ok', ts: new Date().toISOString() }` with 200. Verify it is in the `isPublicRoute` matcher in `proxy.ts`.

---

## Testing Strategy

### Validation Approach

Two-phase: first run tests on the unfixed code to confirm failures match the bug condition, then apply fixes and verify all 101 tests pass with no regressions.

### Exploratory Bug Condition Checking

**Goal**: Confirm each defect is observable before fixing it.

**Test Cases**:
1. **Build failure**: `npm run build` exits non-zero — confirms 1a
2. **Typecheck failure**: `npm run typecheck` exits non-zero — confirms 1b
3. **Lint failure**: `npm run lint` reports errors — confirms 2
4. **Crypto test failure**: `npm test -- --run src/lib/__tests__/cashflowiq-final-gaps.test.ts` fails with `ENCRYPTION_KEY not set` — confirms 3b
5. **Stale URL test failure**: same test file fails on URL assertion — confirms 3a
6. **Dependency audit**: `npm audit --audit-level=high` reports vulnerabilities — confirms 4
7. **Startup without env**: start with `TURSO_DATABASE_URL` unset, observe no startup error — confirms 5

**Expected Counterexamples**:
- Build exits 1 with TypeScript error on `new NextResponse(buffer, ...)`
- Tests fail with `Error: ENCRYPTION_KEY environment variable not set`
- `npm audit` reports ≥3 high-severity advisories

### Fix Checking

**Goal**: After each fix, verify the specific defect is resolved.

```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedApp(input)
  ASSERT expectedBehavior(result)  -- exit 0, 0 errors, 101 passing tests
END FOR
```

### Preservation Checking

**Goal**: Verify the 90 passing tests still pass and runtime behaviors are unchanged.

```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalApp(input) = fixedApp(input)
END FOR
```

Property-based testing is used for the crypto round-trip (already in `cashflowiq-final-gaps.test.ts`) — 50 random token strings of length 1–512 must round-trip losslessly through `encryptToken` / `decryptToken`.

**Test Plan**: Run the full suite after each fix group. Fix groups should be applied in dependency order: 1a → 1b → 2 → 3 → 4 → 5 → M1 → M2 → M3 → M4 → M5 → M6 → M7.

**Preservation Test Cases**:
1. **PDF download**: authenticated GET to `/api/reports/download` returns binary PDF with correct headers
2. **Email send**: `sendWelcomeEmail` with valid `RESEND_API_KEY` calls Resend API (mock in test)
3. **Rate limiting**: `checkRateLimit` with Redis configured uses distributed limiter
4. **Crypto round-trip**: 50 random tokens round-trip losslessly (existing PBT)
5. **Engine purity**: `runScenarioForecastEngine` is deterministic for same inputs (existing test)
6. **Auth protection**: non-public routes return 401 without Clerk session

### Unit Tests

- Test `new Response(buffer, { headers })` returns correct Content-Type and Content-Disposition
- Test `handleRouteError` returns JSON (not plain text) for unhandled errors
- Test `sendComplianceReminder` logs `console.error` (not `console.log`) when `resend` is null in production
- Test webhook handler returns 500 when `CLERK_WEBHOOK_SECRET` is missing in production
- Test `checkRateLimit` logs `console.error` at startup when Redis is absent in production

### Property-Based Tests

- Crypto round-trip: `decrypt(encrypt(t)) === t` for 50 random token strings (existing, will pass once `ENCRYPTION_KEY` is provisioned in setup)
- Engine determinism: same inputs produce same outputs across multiple invocations (existing)

### Integration Tests

- Full build passes: `npm run build` exits 0
- Full typecheck passes: `npm run typecheck` exits 0
- Full lint passes: `npm run lint` exits 0
- Full test suite passes: `npm test -- --run` reports 101/101
- CSP nonce is present in HTML response headers for page routes
- CSP does not contain `unsafe-eval` or `unsafe-inline` in production mode
- `GET /api/health` returns 200 after startup
