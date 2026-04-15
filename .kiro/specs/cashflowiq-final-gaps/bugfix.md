# Bugfix Requirements Document

## Introduction

Six production gaps were identified during a full audit of the CashFlowIQ codebase. These range from a critical API route mismatch that silently drops every forecast save, to a security issue with plaintext OAuth token storage, a member invite flow that permanently locks out invited users, a hardcoded notification bell, and a dangerous email fallback domain. One gap (Inngest route) was confirmed non-broken by inspection. All fixes must preserve the core invariants: integer paise arithmetic, pure forecast engine, balance sheet identity, YYYY-MM-01 period format, clerkUserId ownership checks on every DB write, and idempotent Inngest functions.

---

## Bug Analysis

### Current Behavior (Defect)

**Gap 1 — Forecast result API route mismatch**

1.1 WHEN the forecast engine completes and `useCurrentForecast` debounces a save, THEN the system calls `POST /api/forecast/result/${company.id}` (company ID appended to path), which resolves to a non-existent route and returns HTTP 404

1.2 WHEN the 404 is returned, THEN the system silently swallows the error (`.catch(() => {})`) so the cached forecast result is never written to the `forecast_results` table

**Gap 2 — Zoho OAuth tokens stored as plaintext**

2.1 WHEN a user completes Zoho OAuth and tokens are exchanged, THEN the system stores `accessToken` and `refreshToken` as raw plaintext strings in the `integrations` table `access_token` / `refresh_token` columns

2.2 WHEN the `integrations` table is read for a sync, THEN the system reads plaintext tokens directly without any decryption step, meaning tokens are exposed in any DB dump or log

**Gap 3 — Inngest route function registration (confirmed non-broken)**

3.1 WHEN the Inngest route is inspected, THEN the system correctly exports all four functions (`complianceRemindersCron`, `recomputeForecast`, `zohoDailySync`, `scheduledMonthlyReport`) — no defect exists here

**Gap 4 — Member invite has no acceptance flow**

4.1 WHEN `addMember()` is called to invite a user to a company, THEN the system inserts a `companyMembers` row with `acceptedAt = null`

4.2 WHEN an invited member (with `acceptedAt = null`) attempts to access any company resource, THEN the system evaluates `canAccessCompany()` which returns `false` because `!!member?.acceptedAt` is `false`, permanently blocking the invited user

**Gap 5 — Notification bell shows hardcoded state**

5.1 WHEN `AppTopbar` renders and a `companyId` is available, THEN the `NotificationBell` component correctly calls `GET /api/notifications` and polls every 60 seconds — no defect exists here (the bell already uses real data)

**Gap 6 — RESEND_FROM_EMAIL fallback is the Resend test domain**

6.1 WHEN `RESEND_FROM_EMAIL` is not set in the environment, THEN the system falls back to `'onboarding@resend.dev'` (Resend's shared test domain) and silently sends production emails from that address without any warning

---

### Expected Behavior (Correct)

**Gap 1 — Forecast result API route mismatch**

2.1 WHEN the forecast engine completes and debounces a save, THEN the system SHALL call `POST /api/forecast/result` (no company ID in path), matching the actual route handler

2.2 WHEN the POST succeeds, THEN the system SHALL persist the forecast result to the `forecast_results` table so subsequent page loads can use the cached result

**Gap 2 — Zoho OAuth tokens stored as plaintext**

2.3 WHEN a user completes Zoho OAuth, THEN the system SHALL encrypt `accessToken` and `refreshToken` using AES-256-GCM (via `@noble/ciphers`) with the `ENCRYPTION_KEY` env var before writing to the `integrations` table

2.4 WHEN the system reads tokens from the `integrations` table for a sync or refresh, THEN the system SHALL decrypt the tokens before use, so the rest of the integration code receives plaintext tokens transparently

**Gap 4 — Member invite acceptance**

2.5 WHEN `addMember()` is called to invite a user, THEN the system SHALL set `acceptedAt` to the current timestamp at insert time, granting immediate access without requiring a separate acceptance step

2.6 WHEN `canAccessCompany()` is called for a member whose row has a non-null `acceptedAt`, THEN the system SHALL return `true`, allowing the invited member to access company resources

**Gap 6 — RESEND_FROM_EMAIL fallback**

2.7 WHEN `RESEND_FROM_EMAIL` is not set in the environment, THEN the system SHALL default to an empty string instead of `'onboarding@resend.dev'`

2.8 WHEN `NODE_ENV === 'production'` and `RESEND_FROM_EMAIL` is empty or unset, THEN the system SHALL log a `console.warn` indicating that email sending may fail due to missing sender address

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the forecast engine runs, THEN the system SHALL CONTINUE TO execute `runForecastEngine()` as a pure function with no DB calls inside it

3.2 WHEN any monetary value is computed by the forecast engine, THEN the system SHALL CONTINUE TO represent all amounts as integer paise with no floating-point arithmetic

3.3 WHEN the balance sheet is computed, THEN the system SHALL CONTINUE TO satisfy `totalAssets === totalLiabilities + totalEquity`

3.4 WHEN period values are stored or compared, THEN the system SHALL CONTINUE TO use `YYYY-MM-01` format exclusively

3.5 WHEN any DB write is performed, THEN the system SHALL CONTINUE TO verify `clerkUserId` ownership before mutating data

3.6 WHEN Inngest functions execute, THEN the system SHALL CONTINUE TO be idempotent — re-running the same event produces the same outcome without duplicate side effects

3.7 WHEN `RESEND_FROM_EMAIL` is explicitly set in the environment, THEN the system SHALL CONTINUE TO use that configured value without modification

3.8 WHEN a company owner (not a member) calls `canAccessCompany()`, THEN the system SHALL CONTINUE TO return `true` via the direct ownership check, unaffected by member table changes

3.9 WHEN Zoho tokens are valid and not expired, THEN the system SHALL CONTINUE TO make successful API calls to Zoho Books after the encrypt/decrypt round-trip

3.10 WHEN `POST /api/forecast/result` is called with a valid body, THEN the system SHALL CONTINUE TO upsert the forecast result keyed on `(companyId, scenarioId)` without creating duplicates

---

## Bug Condition Summary

```pascal
// Gap 1: Fix Checking
FUNCTION isBugCondition_Gap1(request)
  INPUT: request — a forecast save API call
  OUTPUT: boolean
  RETURN request.url CONTAINS company.id IN PATH
END FUNCTION

FOR ALL request WHERE isBugCondition_Gap1(request) DO
  result ← apiPost'(request)
  ASSERT result.status = 200 OR 201
  ASSERT forecastResults table HAS row FOR companyId
END FOR

// Gap 2: Fix Checking
FUNCTION isBugCondition_Gap2(token)
  INPUT: token — OAuth token string written to integrations table
  OUTPUT: boolean
  RETURN token IS stored AS plaintext
END FUNCTION

FOR ALL token WHERE isBugCondition_Gap2(token) DO
  stored ← integrations.access_token
  ASSERT stored ≠ token  // encrypted, not equal to plaintext
  ASSERT decrypt(stored) = token
END FOR

// Gap 4: Fix Checking
FUNCTION isBugCondition_Gap4(member)
  INPUT: member — newly invited companyMembers row
  OUTPUT: boolean
  RETURN member.acceptedAt IS NULL
END FUNCTION

FOR ALL member WHERE isBugCondition_Gap4(member) DO
  result ← canAccessCompany'(member.companyId, member.clerkUserId)
  ASSERT result = true
END FOR

// Gap 6: Fix Checking
FUNCTION isBugCondition_Gap6(env)
  INPUT: env — process.env at startup
  OUTPUT: boolean
  RETURN env.RESEND_FROM_EMAIL IS undefined AND env.NODE_ENV = 'production'
END FUNCTION

FOR ALL env WHERE isBugCondition_Gap6(env) DO
  ASSERT env.RESEND_FROM_EMAIL fallback ≠ 'onboarding@resend.dev'
  ASSERT console.warn WAS called
END FOR

// Preservation Checking (all gaps)
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
