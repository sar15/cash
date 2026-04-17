# Bugfix Requirements Document

## Introduction

CashFlowIQ is a Next.js 16 financial forecasting app for Indian SMEs. This document captures seven confirmed production-blocking bugs discovered during a final pre-deployment audit. The bugs span API routing (team member access), stale duplicate files, email misconfiguration, a security vulnerability (secrets committed to git), a dependency vulnerability chain, and a missing `.gitignore` entry. All fixes must preserve the existing build, typecheck, lint, and 96-test green baseline.

---

## Bug Analysis

### Bug 1 — Forecast save URL uses path param, blocking team members

#### Current Behavior (Defect)

1.1 WHEN a team member (with a `company_members` row but not the company owner) triggers a forecast save THEN the system calls `POST /api/forecast/result/${company.id}` which hits the `[companyId]` dynamic route that uses `requireOwnedCompany`, and the system returns 401 Unauthorized.

1.2 WHEN the `[companyId]` route receives a POST from any non-owner user THEN the system rejects the request even though the user has legitimate team-member access to the company.

#### Expected Behavior (Correct)

2.1 WHEN a team member triggers a forecast save THEN the system SHALL call `POST /api/forecast/result?companyId=${company.id}` which hits the flat route that uses `resolveAuthedCompany`, and the save SHALL succeed for both owners and team members.

2.2 WHEN any authenticated user with company access (owner or team member) triggers a forecast save THEN the system SHALL persist the result without returning a 401.

#### Unchanged Behavior (Regression Prevention)

3.1 WHEN the company owner triggers a forecast save THEN the system SHALL CONTINUE TO persist the forecast result successfully via the query-string route.

3.2 WHEN the forecast engine produces a result THEN the system SHALL CONTINUE TO debounce the save call by 800 ms and silently swallow errors (best-effort caching).

---

### Bug 2 — 12 duplicate " 2." files polluting the repository

#### Current Behavior (Defect)

1.3 WHEN the repository is checked out THEN the system contains 12 stale duplicate files with names ending in ` 2.{ext}` that are never imported by any module and serve no purpose.

1.4 WHEN a developer or build tool scans the `src/` directory THEN the system exposes these orphaned files, creating confusion and potential accidental imports.

#### Expected Behavior (Correct)

2.3 WHEN the repository is checked out THEN the system SHALL NOT contain any of the following files:
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

2.4 WHEN the build, typecheck, and lint pipelines run after deletion THEN the system SHALL continue to exit 0 with no errors.

#### Unchanged Behavior (Regression Prevention)

3.3 WHEN the canonical (non-duplicate) source files are present THEN the system SHALL CONTINUE TO compile and function correctly — only the ` 2.` duplicates are removed.

---

### Bug 3 — `send.ts` hardcodes `onboarding@resend.dev` as fallback sender

#### Current Behavior (Defect)

1.5 WHEN `RESEND_FROM_EMAIL` is not set (or is an empty string) in production THEN the system sends emails from `onboarding@resend.dev` — Resend's shared test domain — which causes emails to be spam-filtered or rejected by recipients.

1.6 WHEN `env.ts` correctly defaults `RESEND_FROM_EMAIL` to `''` THEN the system still overrides that intent in `send.ts` via `process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'`, bypassing the env-level guard.

#### Expected Behavior (Correct)

2.5 WHEN `RESEND_FROM_EMAIL` is not set THEN the system SHALL NOT fall back to `onboarding@resend.dev`; instead it SHALL use an empty string (or a configured production address), causing the existing `resend` guard to skip sending rather than send from a test domain.

2.6 WHEN `RESEND_FROM_EMAIL` is set to a valid production address THEN the system SHALL use that address as the `from` field for all outgoing emails.

#### Unchanged Behavior (Regression Prevention)

3.4 WHEN `RESEND_FROM_EMAIL` is correctly configured THEN the system SHALL CONTINUE TO send compliance reminders, welcome emails, and import-success emails from the configured address.

3.5 WHEN `RESEND_API_KEY` is absent THEN the system SHALL CONTINUE TO skip email sending silently (existing guard is unaffected).

---

### Bug 4 — `uploadthing` dependency chain has 3 high-severity vulnerabilities

#### Current Behavior (Defect)

1.7 WHEN `npm audit` is run THEN the system reports 3 high-severity vulnerabilities in `uploadthing`, `@uploadthing/shared`, and `effect` (the transitive dependency chain).

1.8 WHEN the current `uploadthing@7.7.4` is installed THEN the system pulls in a vulnerable version of the `effect` package.

#### Expected Behavior (Correct)

2.7 WHEN `npm audit` is run after the fix THEN the system SHALL report 0 high-severity vulnerabilities related to `uploadthing` or `effect`.

2.8 WHEN the fix is applied (either by pinning `effect>=3.20.0` via `overrides` or downgrading to `uploadthing@6.12.0`) THEN the system SHALL continue to build and pass all tests.

#### Unchanged Behavior (Regression Prevention)

3.6 WHEN file uploads are performed THEN the system SHALL CONTINUE TO upload files via UploadThing without functional regression.

3.7 WHEN `npm run build` is executed after the dependency change THEN the system SHALL CONTINUE TO exit 0.

---

### Bug 5 — `.env.local` committed to git (CRITICAL SECURITY)

#### Current Behavior (Defect)

1.9 WHEN `git ls-files .env.local` is run THEN the system confirms `.env.local` is tracked in the git index, meaning live production secrets (Clerk, Turso, Encryption key, Resend, Inngest, Upstash Redis, Sentry, UploadThing) are exposed in the repository.

1.10 WHEN the repository is cloned or its history is inspected THEN the system exposes all secrets present in `.env.local` at the time of commit.

#### Expected Behavior (Correct)

2.9 WHEN `git ls-files .env.local` is run after the fix THEN the system SHALL return empty output, confirming the file is no longer tracked.

2.10 WHEN the git history contains a commit with `.env.local` THEN the system SHALL have all exposed secrets rotated in their respective dashboards (Clerk, Turso, Resend, Inngest, Upstash, Sentry, UploadThing).

2.11 WHEN `.env.local` is removed from git tracking THEN the system SHALL use `git rm --cached .env.local` so the file remains on disk for local development.

#### Unchanged Behavior (Regression Prevention)

3.8 WHEN local development is run THEN the system SHALL CONTINUE TO read secrets from `.env.local` on disk (the file is only untracked, not deleted).

3.9 WHEN `.env.example` is present THEN the system SHALL CONTINUE TO be committed and serve as the reference template for required environment variables.

---

### Bug 6 — `/api/forecast/result/[companyId]` route uses `requireOwnedCompany` for GET

#### Current Behavior (Defect)

1.11 WHEN a team member calls `GET /api/forecast/result/[companyId]` THEN the system uses `requireOwnedCompany` and returns 401 Unauthorized, blocking team members from reading cached forecast results.

1.12 WHEN a team member calls `POST /api/forecast/result/[companyId]` THEN the system similarly uses `requireOwnedCompany` and returns 401, blocking team members from saving forecast results via this route.

#### Expected Behavior (Correct)

2.12 WHEN a team member calls `GET /api/forecast/result/[companyId]` THEN the system SHALL use `requireAccessibleCompany` (which checks `company_members`) and return the forecast result with 200.

2.13 WHEN a team member calls `POST /api/forecast/result/[companyId]` THEN the system SHALL use `requireAccessibleCompany` and allow the save, returning 201.

#### Unchanged Behavior (Regression Prevention)

3.10 WHEN the company owner calls either GET or POST on this route THEN the system SHALL CONTINUE TO succeed, since owners also pass the `canAccessCompany` check.

3.11 WHEN an unauthenticated user calls this route THEN the system SHALL CONTINUE TO return 401.

---

### Bug 7 — `.gitignore` missing explicit entry for `.env.local`

#### Current Behavior (Defect)

1.13 WHEN `.env.local` is present in the working directory THEN the system's `.gitignore` relies on the pattern `.env*.local` (which does match `.env.local`) but the file is currently tracked in git, meaning the gitignore pattern was added after the file was already committed — so git continues to track it regardless.

1.14 WHEN a developer creates a new `.env.local` file after a fresh clone THEN the system's `.gitignore` pattern `.env*.local` should prevent it from being staged, but the existing tracked version overrides this protection.

#### Expected Behavior (Correct)

2.14 WHEN `.env.local` is untracked (after Bug 5 fix) and `.gitignore` contains an explicit `.env.local` entry THEN the system SHALL prevent any future `git add .env.local` from staging the file.

2.15 WHEN `git check-ignore -v .env.local` is run THEN the system SHALL confirm the file is ignored.

#### Unchanged Behavior (Regression Prevention)

3.12 WHEN `.env.example` is present THEN the system SHALL CONTINUE TO be committable (the `!.env.example` negation rule is preserved).

3.13 WHEN other `.env.*` files are present THEN the system SHALL CONTINUE TO be ignored by the existing `.env*` and `.env*.local` patterns.

---

## Bug Condition Summary

```pascal
// Bug 1 — Team member forecast save
FUNCTION isBugCondition_1(X)
  INPUT: X of type { userId, companyId, isOwner }
  RETURN X.isOwner = false AND X.apiPath CONTAINS '/api/forecast/result/' + X.companyId
END FUNCTION

FOR ALL X WHERE isBugCondition_1(X) DO
  result ← apiPost'(X)
  ASSERT result.status ≠ 401
END FOR

FOR ALL X WHERE NOT isBugCondition_1(X) DO
  ASSERT apiPost(X) = apiPost'(X)
END FOR

// Bug 3 — Hardcoded email fallback
FUNCTION isBugCondition_3(X)
  INPUT: X of type { RESEND_FROM_EMAIL }
  RETURN X.RESEND_FROM_EMAIL = '' OR X.RESEND_FROM_EMAIL = undefined
END FUNCTION

FOR ALL X WHERE isBugCondition_3(X) DO
  result ← resolveFromAddress'(X)
  ASSERT result ≠ 'onboarding@resend.dev'
END FOR

// Bug 5 — Secrets in git
FUNCTION isBugCondition_5(X)
  INPUT: X of type { gitTrackedFiles }
  RETURN '.env.local' IN X.gitTrackedFiles
END FUNCTION

FOR ALL X WHERE isBugCondition_5(X) DO
  ASSERT git_ls_files('.env.local') = ''
END FOR

// Bug 6 — Team member blocked on [companyId] route
FUNCTION isBugCondition_6(X)
  INPUT: X of type { userId, companyId, isOwner, route }
  RETURN X.isOwner = false AND X.route = '/api/forecast/result/[companyId]'
END FUNCTION

FOR ALL X WHERE isBugCondition_6(X) DO
  result ← routeHandler'(X)
  ASSERT result.status ≠ 401
END FOR
```
