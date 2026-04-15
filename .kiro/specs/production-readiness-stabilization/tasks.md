# Production Readiness Stabilization — Implementation Tasks

## Tasks

- [x] 1. Fix binary response type error in download route
  - [x] 1.1 Read `src/app/api/reports/download/route.ts` and replace `new NextResponse(buffer, { headers })` with `new Response(buffer, { headers })` on line 21
  - [x] 1.2 Verify `getFile()` return type is `Buffer | Uint8Array | ArrayBuffer` (all valid `BodyInit`)
  - [x] 1.3 Run `npm run build` and confirm exit code 0

- [x] 2. Fix independent typecheck failures
  - [x] 2.1 Run `npx tsc --noEmit` and capture all type errors
  - [x] 2.2 Fix Zod 4 type drift (z.ZodError shape, z.flattenError usage)
  - [x] 2.3 Fix React 19 stricter ref types on DOM elements
  - [x] 2.4 Fix Clerk 7 auth helper return type changes
  - [x] 2.5 Fix Lucide 1.x icon prop type changes
  - [x] 2.6 Run `npm run typecheck` and confirm zero errors

- [x] 3. Fix all lint errors and warnings
  - [x] 3.1 Run `npx eslint . --format=json` to get full error list
  - [x] 3.2 Fix `src/hooks/use-current-forecast.ts` line 176 — move hook call out of callback/conditional to top level
  - [x] 3.3 Fix `src/components/layout/AppTopbar.tsx` line 96 — move `NotificationBell` component definition to module scope above `AppTopbar`
  - [x] 3.4 Fix `src/app/(app)/reconciliation/page.tsx` line 28 — move hook call above conditional return
  - [x] 3.5 Fix remaining lint errors (missing key props, useEffect dependency arrays, no-unused-vars)
  - [x] 3.6 Run `npm run lint` and confirm zero errors and zero warnings

- [x] 4. Fix failing tests and add Vitest setup file
  - [x] 4.1 Create `vitest.setup.ts` at project root with `process.env.ENCRYPTION_KEY = 'a'.repeat(64)`
  - [x] 4.2 Add `"vitest": { "setupFiles": ["./vitest.setup.ts"] }` to `package.json`
  - [x] 4.3 Fix stale URL assertions in `cashflowiq-final-gaps.test.ts` — update to assert path-param pattern `/api/forecast/result/${company.id}` not query-string pattern
  - [x] 4.4 Fix `integrationResults` → `rawIntegrationResults` property name in `cashflowiq-final-gaps.test.ts` line ~180
  - [x] 4.5 Fix any remaining stale test expectations against renamed APIs or changed route shapes
  - [x] 4.6 Run `npm test -- --run` and confirm all 101 tests pass

- [x] 5. Upgrade vulnerable dependencies
  - [x] 5.1 Run `npm install next@16.2.3 eslint-config-next@16.2.3`
  - [x] 5.2 Replace `xlsx` with `exceljs` — update all import paths in the upload/import route and any other xlsx consumers
  - [x] 5.3 Remove `next-pwa` and install `@serwist/next serwist`
  - [x] 5.4 Remove `withPWAInit` wrapper from `next.config.ts` and add Serwist plugin
  - [x] 5.5 Create `src/app/sw.ts` service worker entry for Serwist
  - [x] 5.6 Migrate `public/manifest.json` to `src/app/manifest.ts` using Next 16 built-in manifest support
  - [x] 5.7 Run `npm audit --omit=dev` and confirm zero high-severity advisories

- [x] 6. Fix environment validation
  - [x] 6.1 Create `src/instrumentation.ts` with `register()` that imports `@/lib/server/env` when `NEXT_RUNTIME === 'nodejs'`
  - [x] 6.2 Update `src/lib/server/env.ts` to add two-tier validation: Tier 1 always-required (`TURSO_DATABASE_URL`, `CLERK_SECRET_KEY`), Tier 2 feature-gated (`ENCRYPTION_KEY`, `ZOHO_*`, `RESEND_*`, `INNGEST_*`, `R2_*`, `UPSTASH_*`)
  - [x] 6.3 Ensure `ENCRYPTION_KEY` validation runs at startup (not call time) when any Zoho env var is present
  - [x] 6.4 Verify app starts normally when all required env vars are present (no new errors)

- [x] 7. Migrate middleware to proxy convention
  - [x] 7.1 Read `node_modules/next/dist/docs/` for the current Next 16 proxy convention
  - [x] 7.2 Rename `src/middleware.ts` to `src/proxy.ts` and change `export function middleware` to `export function proxy`
  - [x] 7.3 Verify Clerk `clerkMiddleware` wrapper works with the proxy export
  - [x] 7.4 Confirm no deprecation warnings in dev server output

- [x] 8. Move CSP to proxy.ts with per-request nonces
  - [x] 8.1 Add nonce generation to `src/proxy.ts` using `crypto.randomUUID()` → base64
  - [x] 8.2 Build CSP string with `'nonce-{value}' 'strict-dynamic'` in `script-src`; include `'unsafe-eval'` in dev only
  - [x] 8.3 Set `x-nonce` and `Content-Security-Policy` headers on both request and response
  - [x] 8.4 Remove static `Content-Security-Policy` entry from `next.config.ts` `headers()` (keep all other security headers)
  - [x] 8.5 Update proxy `config.matcher` to exclude `api`, `_next/static`, `_next/image`, `favicon.ico`
  - [x] 8.6 Verify CSP response header is present on page routes and absent on API routes
  - [x] 8.7 Verify `unsafe-eval` and `unsafe-inline` are NOT present in production CSP

- [x] 9. Fix silent failure modes
  - [x] 9.1 In `src/lib/email/send.ts` line 31: change `console.log` to `console.error` when `resend` is null AND `NODE_ENV === 'production'`; keep `console.log` skip in development
  - [x] 9.2 In `src/app/api/webhooks/clerk/route.ts` line 18: return `NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })` and log `console.error` when `CLERK_WEBHOOK_SECRET` is missing in production
  - [x] 9.3 In `src/lib/server/api.ts` line 76: change `textError('Internal Error', 500)` to `jsonError('Internal Error', 500)` in `handleRouteError`

- [x] 10. Fix rate limit startup signal
  - [x] 10.1 In `src/lib/rate-limit.ts` line 118: change `console.warn` to `console.error` when Redis is absent in production
  - [x] 10.2 Add hard-fail when `STRICT_PROD_GUARDS=true`: throw `Error('Rate limiting requires Redis in strict production mode')`
  - [x] 10.3 Verify in-memory fallback still works in development mode

- [x] 11. Add CI pipeline
  - [x] 11.1 Create `.github/workflows/` directory
  - [x] 11.2 Create `.github/workflows/ci.yml` running `typecheck` → `lint` → `test --run` → `build` on push to main and pull_request
  - [x] 11.3 Add required env vars to CI workflow (`ENCRYPTION_KEY`, `TURSO_DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`)

- [x] 12. Fix auth consistency across API routes
  - [x] 12.1 Audit all `src/app/api/**/route.ts` files for direct `auth()` calls that bypass `resolveAuthedCompany`
  - [x] 12.2 Migrate identified routes to use `resolveAuthedCompany` + `isErrorResponse` guard
  - [x] 12.3 Add explicit code comments on any intentional owner-only or public exceptions

- [x] 13. Clean up workspace artifacts
  - [x] 13.1 Delete any `* 2.ts` duplicate files under `.next/dev/types/`
  - [x] 13.2 Verify `.next/` is in `.gitignore`
  - [x] 13.3 Verify no `.next/` files are tracked by git

- [x] 14. Add monitoring and health endpoint
  - [x] 14.1 Create `src/app/api/health/route.ts` returning `{ status: 'ok', ts: new Date().toISOString() }` with status 200
  - [x] 14.2 Add `/api/health` to the `isPublicRoute` matcher in `src/proxy.ts`
  - [x] 14.3 Verify `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are documented in `.env.example`
  - [x] 14.4 Verify `withSentryConfig` wrapper in `next.config.ts` is correctly configured

- [x] 15. Document operational readiness procedures
  - [x] 15.1 Add `DEPLOYMENT.md` documenting: pre-deploy migration steps (`npm run db:migrate`), rollback procedure, Turso backup command, and post-deploy smoke test checklist
