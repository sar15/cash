# Bugfix Requirements Document

## Introduction

CashFlowIQ is a Next.js 16 financial forecasting app for Indian SMEs. A production readiness audit identified multiple hard blockers and medium risks that prevent safe deployment. These include a broken production build, a failing typecheck, 31 lint errors, 11 failing tests (including crypto tests missing env setup), 7 high-severity dependency vulnerabilities, incomplete environment validation, insecure CSP headers, silent failure modes in critical paths, auth consistency drift across routes, and missing CI enforcement. This document captures all defects and the expected correct behavior needed to bring the app to production-ready status.

---

## Bug Analysis

### Current Behavior (Defect)

**Hard Blocker 1a — Production Build Failure**

1.1 WHEN `npm run build` is executed THEN the build exits non-zero because `new NextResponse(buffer, { headers })` in `src/app/api/reports/download/route.ts` (line 21) does not typecheck under the Next 16 setup

**Hard Blocker 1b — TypeCheck Failure**

1.2 WHEN `npm run typecheck` is executed independently THEN it fails with type errors, blocking CI and developer workflows independently of the build step

**Hard Blocker 2 — Lint Errors**

1.3 WHEN the linter runs THEN it reports 31 errors and 22 warnings, including React render-pattern violations in `src/hooks/use-current-forecast.ts` (line 176), `src/components/layout/AppTopbar.tsx` (line 96), and `src/app/(app)/reconciliation/page.tsx` (line 28)

**Hard Blocker 3 — Failing Tests**

1.4 WHEN the test suite runs THEN 11 out of 101 tests fail due to stale test expectations against renamed APIs or changed route shapes; additionally, several crypto tests fail because `ENCRYPTION_KEY` is missing at test time in `src/lib/utils/crypto.ts` (line 50), causing failures on missing env setup rather than on actual behavior

**Hard Blocker 4 — High-Severity Dependency Vulnerabilities**

1.5 WHEN the app is deployed with `next@16.2.2` THEN it is exposed to a high-severity DoS advisory that is fixed in `next@16.2.3`

1.6 WHEN a user uploads or imports a file THEN the app processes it using `xlsx@0.18.5`, which has known high-severity advisories on the import/upload path

1.7 WHEN the PWA service worker is active THEN `next-pwa` pulls a vulnerable Workbox / `serialize-javascript` chain into the production bundle

**Hard Blocker 5 — Incomplete Environment Validation**

1.8 WHEN the app starts in production THEN `src/lib/server/env.ts` (line 25) is not imported anywhere, so the fail-fast validator never runs and missing env vars are not caught at startup

1.9 WHEN `TURSO_DATABASE_URL` is missing in production THEN `src/lib/db/index.ts` (line 9) throws only for that one variable, leaving other critical vars (e.g. `ENCRYPTION_KEY`, `CLERK_SECRET_KEY`) unvalidated until call time

1.10 WHEN `ENCRYPTION_KEY` is missing THEN `src/lib/utils/crypto.ts` (line 50) throws only at the moment `encryptToken` or `decryptToken` is called, not at startup

**Medium Risk 1 — Deprecated Middleware Convention**

1.11 WHEN the app runs under Next 16 THEN `src/middleware.ts` (line 1) uses a deprecated middleware convention that Next 16 local docs recommend migrating away from

**Medium Risk 2 — Insecure CSP Headers**

1.12 WHEN any page is served THEN `next.config.ts` (line 25) sets `'unsafe-eval'` and `'unsafe-inline'` globally in the `script-src` directive, weakening the Content Security Policy for all routes

**Medium Risk 3 — Silent Failure Modes (Production Only)**

1.13 WHEN `RESEND_API_KEY` is not set in production mode THEN `src/lib/email/send.ts` (line 31) silently skips sending emails with only a `console.log`, giving no observable signal that email delivery is broken

1.14 WHEN `CLERK_WEBHOOK_SECRET` is not set in production mode THEN the Clerk webhook handler becomes a no-op (line 18 of the webhook route), silently dropping user lifecycle events without any warning

1.15 WHEN an unhandled error occurs in an API route THEN `src/lib/server/api.ts` (line 76) returns a plain-text `"Internal Error"` response instead of a structured JSON error, breaking clients that expect JSON

**Medium Risk 4 — In-Memory Rate Limiting in Production**

1.16 WHEN `UPSTASH_REDIS_REST_URL` is absent in production THEN `src/lib/rate-limit.ts` (line 118) silently falls back to an in-memory store that does not work correctly across multiple serverless instances

**Medium Risk 5 — No CI Pipeline**

1.17 WHEN code is pushed or a pull request is opened THEN there is no `.github/workflows` CI pipeline to enforce that typecheck, build, lint, and tests pass before deployment

**Medium Risk 6 — Auth Consistency Drift**

1.18 WHEN API routes are added or modified THEN some routes do not use the shared auth/company helpers, causing inconsistent authentication and company isolation enforcement across the API surface

**Medium Risk 7 — Workspace Cleanliness**

1.19 WHEN the build or CI runs THEN generated artifacts such as duplicate `.next/dev/types/* 2.ts` files and accidental duplicate sourcemaps may be present in the working tree or CI environment, poisoning type checks and build outputs

---

### Expected Behavior (Correct)

**Hard Blocker 1a — Production Build**

2.1 WHEN `npm run build` is executed THEN the build SHALL complete with exit code 0, with `src/app/api/reports/download/route.ts` using a type-safe method to return binary responses compatible with Next 16

**Hard Blocker 1b — TypeCheck**

2.2 WHEN `npm run typecheck` is executed THEN it SHALL pass with zero type errors

**Hard Blocker 2 — Lint**

2.3 WHEN the linter runs THEN it SHALL report zero errors, with all React render-pattern violations in `use-current-forecast.ts`, `AppTopbar.tsx`, and `reconciliation/page.tsx` resolved

**Hard Blocker 3 — Tests**

2.4 WHEN the test suite runs THEN all 101 tests SHALL pass, with stale test expectations updated to match current API and route shapes; a Vitest setup file or deterministic test env key SHALL be provisioned so crypto-related tests validate actual encryption/decryption behavior rather than failing on missing env setup

**Hard Blocker 4 — Dependencies**

2.5 WHEN the app is deployed THEN `next` SHALL be upgraded to `16.2.3` or later to eliminate the DoS advisory

2.6 WHEN a user uploads or imports a file THEN the app SHALL use a version of `xlsx` (or a replacement) that has no known high-severity advisories, or the import path SHALL be sandboxed/validated to mitigate the risk

2.7 WHEN the PWA service worker is active THEN `next-pwa` SHALL be upgraded or replaced so that no vulnerable Workbox / `serialize-javascript` version is included in the production bundle

**Hard Blocker 5 — Environment Validation**

2.8 WHEN the app starts in production THEN `src/lib/server/env.ts` SHALL be imported in the Next.js server entry point (e.g. `instrumentation.ts`) so the fail-fast validator runs before any request is served

2.9 WHEN any required environment variable is missing at startup THEN the app SHALL throw a clear, descriptive error immediately, covering two tiers:
- Always required in production: `TURSO_DATABASE_URL`, `CLERK_SECRET_KEY`
- Required when the associated feature is enabled: `ENCRYPTION_KEY`, `ZOHO_*`, `RESEND_*`, `INNGEST_*`, `R2_*`, `UPSTASH_*`

2.10 WHEN `ENCRYPTION_KEY` is missing THEN the app SHALL fail at startup rather than at call time

**Medium Risk 1 — Middleware**

2.11 WHEN the app runs under Next 16 THEN `src/middleware.ts` SHALL use the current, non-deprecated middleware convention as documented in `node_modules/next/dist/docs/`

**Medium Risk 2 — CSP Headers**

2.12 WHEN any page is served THEN the `script-src` directive in `next.config.ts` SHALL NOT include `'unsafe-eval'` or `'unsafe-inline'` globally; nonces or hashes SHALL be used where inline scripts are required

**Medium Risk 3 — Silent Failures (Production Only)**

2.13 WHEN `RESEND_API_KEY` is not set in production mode THEN `src/lib/email/send.ts` SHALL log a `console.error` (not `console.log`) and SHALL surface the misconfiguration clearly so operators are alerted

2.14 WHEN `CLERK_WEBHOOK_SECRET` is not set in production mode THEN the webhook handler SHALL return a `500` or `503` response and log an error, rather than silently becoming a no-op

2.15 WHEN an unhandled error occurs in an API route THEN `src/lib/server/api.ts` SHALL return a structured JSON error response (e.g. `{ "error": "Internal Error" }`) with the appropriate HTTP status code

**Medium Risk 4 — Rate Limiting**

2.16 WHEN `UPSTASH_REDIS_REST_URL` is absent in production THEN `src/lib/rate-limit.ts` SHALL log a `console.error` at startup; the app SHALL fail hard only when `STRICT_PROD_GUARDS=true` or when a multi-instance production environment is expected, rather than silently degrading in all cases

**Medium Risk 5 — CI Pipeline**

2.17 WHEN code is pushed or a pull request is opened THEN a `.github/workflows/ci.yml` pipeline SHALL run `typecheck`, `lint`, `test`, AND `build` and SHALL block merging if any step fails

**Medium Risk 6 — Auth Consistency**

2.18 WHEN any API route handles a request THEN it SHALL use the shared auth/company helpers for authentication and company isolation, OR explicitly document in code comments why it is an owner-only exception — to prevent drift across routes

**Medium Risk 7 — Workspace Cleanliness**

2.19 WHEN the build or CI runs THEN generated artifacts such as duplicate `.next/dev/types/* 2.ts` files and accidental duplicate sourcemaps SHALL NOT be present in the working tree or CI environment

**Test Harness**

2.20 WHEN the test suite runs THEN crypto-related tests SHALL have `ENCRYPTION_KEY` provisioned (via Vitest setup file or `.env.test`) so the suite validates actual encryption/decryption behavior instead of failing on missing env setup

**Monitoring**

2.21 WHEN the app is deployed to production THEN Sentry SHALL be configured and verified to capture unhandled errors

2.22 WHEN a health endpoint is hit THEN it SHALL return a `200` with basic service status

2.23 WHEN email sending fails, a webhook is dropped, or a background job fails THEN the system SHALL emit an observable error signal (log at `error` level or Sentry event) so operators are alerted

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a valid authenticated user requests a report download THEN the system SHALL CONTINUE TO return the PDF file with correct `Content-Type`, `Content-Disposition`, and `Cache-Control` headers

3.2 WHEN `RESEND_API_KEY` is set and valid THEN the system SHALL CONTINUE TO send compliance reminder, welcome, and import success emails as before

3.3 WHEN `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set THEN the system SHALL CONTINUE TO use the distributed Upstash rate limiter with the same sliding-window limits (100 req/min general, 10/hour import)

3.4 WHEN all required environment variables are present THEN the system SHALL CONTINUE TO start normally without any new errors or warnings introduced by the env validation changes

3.5 WHEN a user authenticates via Clerk THEN the system SHALL CONTINUE TO protect all non-public routes using the existing `isPublicRoute` matcher logic

3.6 WHEN the app runs in development mode THEN the system SHALL CONTINUE TO use fallback values for optional env vars and SHALL CONTINUE TO skip rate limiting for faster iteration

3.7 WHEN `CLERK_WEBHOOK_SECRET` is set and a valid webhook arrives THEN the system SHALL CONTINUE TO process Clerk user lifecycle events correctly

3.8 WHEN the 90 currently-passing tests are run after fixes THEN the system SHALL CONTINUE TO pass all 90 of those tests without regression

3.9 WHEN the PWA is loaded in a browser THEN the system SHALL CONTINUE TO register the service worker and support offline functionality (assuming the updated `next-pwa` or replacement supports it)

3.10 WHEN `ENCRYPTION_KEY` is set and valid THEN `encryptToken` and `decryptToken` SHALL CONTINUE TO work correctly with the same XChaCha20-Poly1305 algorithm and base64 encoding format

---

### Operational Readiness

3.11 WHEN a new version is deployed to production THEN database migrations SHALL be run and verified before the new code goes live

3.12 WHEN a deployment is planned THEN a documented rollback procedure SHALL exist and be verified for that deployment

3.13 WHEN the Turso database is in use in production THEN a backup and restore procedure SHALL be documented and tested

3.14 WHEN a production deployment completes THEN a post-deploy smoke test checklist of critical paths SHALL be executed to verify the deployment is healthy
