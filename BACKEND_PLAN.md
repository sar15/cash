
# CashFlowIQ — Backend Perfection Plan

> Research-backed. Every gap verified against actual code. Ordered by impact.
> This is the complete roadmap to make the backend match Fathom/Jiwa level.

---

## What Fathom Does That We Don't (Research Summary)

From studying Fathom HQ's product:
- **Daily auto-sync** from Xero/QuickBooks/Sage/MYOB — actuals always fresh
- **Server-side forecast caching** — results stored, not recomputed on every page load
- **Scheduled PDF reports** delivered by email on a cron
- **Multi-user firm access** — CA firm members share client portfolios
- **Audit trail** — every rule change logged with who changed it and when
- **Bulk company updates** — CA can refresh all clients in one click
- **Real-time compliance alerts** — pushed to users before due dates

From studying Jiwa (Indian ERP context):
- **Tally/Zoho Books integration** — pull actuals directly from accounting software
- **GST portal sync** — GSTR-1/3B data pulled from NIC APIs
- **Indian bank statement parsing** — auto-reconcile from bank feeds
- **Multi-branch support** — one company, multiple locations

**Our gap vs both:** We have the forecasting engine and UI. We're missing the data pipeline, persistence, background jobs, integrations, and multi-user layer.

---

## Current State (Verified Against Code)

### What Actually Works
- ✅ All CRUD APIs (companies, accounts, actuals, scenarios, micro-forecasts, value rules, timing profiles)
- ✅ Import pipeline (upload → R2 → parse → save)
- ✅ Compliance config CRUD
- ✅ Forecast result table exists in DB
- ✅ Health check with DB latency
- ✅ Clerk auth on every route
- ✅ Company isolation (clerkUserId check on every write)
- ✅ Zod validation on all inputs
- ✅ Drizzle ORM with Turso (libSQL/SQLite) — 1 migration file

### What's Broken or Missing
- ❌ `saveForecastResult` is never called — engine result never persisted to DB
- ❌ `forecast_results` has no upsert — would duplicate on every save
- ❌ No background jobs (Inngest/cron not installed)
- ❌ No email (Resend not installed)
- ❌ No rate limiting on any API route
- ❌ No Zoho Books / Tally integration
- ❌ No multi-user / team sharing (single clerkUserId per company)
- ❌ No audit trail (no change history table)
- ❌ No notification feed (bell has hardcoded red dot)
- ❌ R2 not configured in dev (falls back to local filesystem)
- ❌ ARCHITECTURE.md incorrectly says "Neon PostgreSQL" — it's Turso (libSQL)
- ❌ `forecast_results` upsert missing — only insert exists
- ❌ No DB migrations beyond the initial one
- ❌ No error monitoring (no Sentry/similar)
- ❌ No request logging

---

## Phase 1 — Fix What's Broken (Week 1)

These are bugs, not features. Do these first.

### 1.1 Fix Forecast Result Persistence

**Problem:** Engine runs client-side on every render. Results never saved to DB. On slow connections or large datasets, this causes visible lag and means no server-side access to forecast data.

**Fix:**
1. Add upsert to `forecast-results.ts` (replace insert with insert-on-conflict-update)
2. Call `POST /api/forecast/result` after engine runs in `use-current-forecast.ts`
3. Add debounce (500ms) so it doesn't fire on every keystroke

```
src/lib/db/queries/forecast-results.ts  — add upsertForecastResult()
src/hooks/use-current-forecast.ts       — call save after engine runs
src/app/api/forecast/result/route.ts    — add POST with upsert
```

### 1.2 Fix ARCHITECTURE.md — DB is Turso, not Neon

**Problem:** ARCHITECTURE.md says "Neon PostgreSQL" throughout. It's actually Turso (libSQL/SQLite dialect). This will confuse anyone working on the backend.

**Fix:** Update ARCHITECTURE.md with correct DB info.

### 1.3 Add DB Migration Versioning

**Problem:** Only 1 migration file. Any schema change will break production.

**Fix:**
- Add `drizzle-kit push` to dev workflow
- Add `drizzle-kit migrate` to production deploy script
- Document migration process in ARCHITECTURE.md

### 1.4 Fix R2 for Production

**Problem:** R2 env vars are empty. File uploads fall back to local filesystem. In production (Vercel), local filesystem is ephemeral — uploaded files disappear between requests.

**Fix:**
- Set up Cloudflare R2 bucket
- Add env vars: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- Add file cleanup after successful import save (currently files are never deleted)

```
src/lib/r2.ts                           — add deleteFile() function
src/app/api/import/save/route.ts        — call deleteFile(fileKey) after save
```

### 1.5 Add Rate Limiting

**Problem:** No rate limiting on any API route. Import endpoint accepts 10MB files with no throttle. A single user could hammer the DB.

**Fix:** Use Upstash Redis rate limiting (free tier, works with Vercel Edge).

```
src/middleware.ts                        — add rate limiting middleware
```

Rate limits:
- Import upload: 10 requests/hour per user
- Seed demo: 3 requests/hour per user
- All other routes: 100 requests/minute per user

---

## Phase 2 — Forecast Result Caching + Invalidation (Week 1-2)

**Why this matters:** Fathom shows results instantly. We recompute on every render. With 50+ accounts and 12 months, this is 600+ calculations per render.

### 2.1 Server-Side Forecast Cache

**Architecture:**
```
Client renders → useCurrentForecast runs engine → saves result to DB (debounced)
Next page load → check DB for cached result → if fresh, use it → if stale, recompute
```

**Staleness rules:** Result is stale when any of these change:
- `value_rules` updated
- `timing_profiles` updated  
- `monthly_actuals` updated (new import)
- `micro_forecasts` updated (event added/toggled)
- `compliance_config` updated
- `scenarios` overrides updated

**Implementation:**
```
src/lib/db/schema.ts                    — add version/hash column to forecast_results
src/lib/db/queries/forecast-results.ts — add upsertForecastResult() with conflict update
src/hooks/use-current-forecast.ts       — save result after compute, load on mount
src/app/api/forecast/result/route.ts    — GET returns cached, POST upserts
```

### 2.2 Config Version Hash

Add a `config_version` integer to each company that increments on any config change. Compare against cached result's version to detect staleness without querying all tables.

```
src/lib/db/schema.ts                    — add config_version to companies table
src/app/api/forecast/config/route.ts    — bump version on any config write
src/app/api/forecast/result/route.ts    — include version in cache check
```

---

## Phase 3 — Background Jobs with Inngest (Week 2)

**Why Inngest:** Works natively with Next.js serverless. No separate server needed. Free tier covers our needs. Handles retries, delays, and fan-out automatically.

### Install

```bash
npm install inngest
```

Add `src/app/api/inngest/route.ts` — Inngest webhook handler.

### 3.1 Compliance Reminder Emails

**What it does:** 3/5/7 days before a compliance due date, send an email to the configured address.

**Trigger:** Cron job runs daily at 8am IST.

**Logic:**
1. Query all companies with `reminder_config.enabled = true`
2. For each company, compute upcoming due dates (GST R-3B on 20th, TDS on 7th, PF on 15th)
3. If due date is within `reminder_days`, send email via Resend
4. Log sent reminders to prevent duplicates

```
src/lib/inngest/client.ts               — Inngest client
src/lib/inngest/functions/compliance-reminders.ts
src/app/api/inngest/route.ts            — serve({ client, functions })
```

### 3.2 Forecast Result Pre-computation

**What it does:** When a user saves a value rule or imports data, queue a background job to recompute the forecast and cache it. Next page load is instant.

**Trigger:** Event `forecast/config.updated` fired after any config write.

**Logic:**
1. Load all data for company from DB
2. Run `runForecastEngine()`
3. Save result to `forecast_results` table
4. Bump `config_version`

```
src/lib/inngest/functions/recompute-forecast.ts
```

### 3.3 Scheduled Report Delivery (CA Feature)

**What it does:** CA can schedule monthly PDF reports to be emailed to clients.

**Trigger:** Cron job runs on 1st of each month.

**Logic:**
1. Query companies with `report_schedule.enabled = true`
2. Generate PDF from cached forecast result
3. Email to configured recipients via Resend

```
src/lib/inngest/functions/scheduled-reports.ts
```

### 3.4 Demo Data Cleanup

**What it does:** Demo data seeded via `/api/import/seed-demo` should auto-expire after 30 days if the user hasn't imported real data.

**Trigger:** Cron job runs weekly.

---

## Phase 4 — Email with Resend (Week 2)

### Install

```bash
npm install resend react-email @react-email/components
```

### Email Templates Needed

| Template | Trigger | Recipients |
|----------|---------|-----------|
| `compliance-reminder.tsx` | 3/5/7 days before due date | Company email |
| `welcome.tsx` | User signs up (Clerk webhook) | New user |
| `report-delivery.tsx` | Scheduled report | CA + client |
| `data-import-success.tsx` | Import completes | User |

```
src/emails/compliance-reminder.tsx
src/emails/welcome.tsx
src/emails/report-delivery.tsx
src/emails/data-import-success.tsx
src/lib/email/send.ts                   — typed send() wrapper
```

### Clerk Webhook for Welcome Email

```
src/app/api/webhooks/clerk/route.ts     — handle user.created event
```

---

## Phase 5 — Multi-User / Team Sharing (Week 3)

**Why this matters:** CAs manage multiple clients. They need to add team members (junior CAs, clients) to specific companies.

### DB Schema Addition

```sql
-- New table
company_members (
  id          text PK,
  company_id  text FK → companies,
  clerk_user_id text NOT NULL,
  role        text  -- 'owner' | 'editor' | 'viewer'
  invited_by  text,
  invited_at  text,
  accepted_at text
)
```

### Auth Pattern Change

Current: `company.clerkUserId === userId` (owner only)
New: Check `company_members` table for any role

```
src/lib/db/schema.ts                    — add company_members table
src/lib/db/queries/company-members.ts  — CRUD
src/lib/db/company-context.ts          — update resolveCompanyForUser to check members
src/app/api/companies/[id]/members/    — invite/remove/list members
```

### Invite Flow

1. Owner enters email in Settings → Team
2. `POST /api/companies/:id/members` creates pending invite
3. Inngest sends invite email with magic link
4. Recipient clicks link → Clerk sign-up/sign-in → accepted_at set
5. Member can now access company

---

## Phase 6 — Audit Trail (Week 3)

**Why this matters:** CAs need to know who changed what and when. Fathom shows change history on every forecast rule.

### DB Schema Addition

```sql
audit_log (
  id            text PK,
  company_id    text FK → companies,
  clerk_user_id text NOT NULL,
  action        text  -- 'value_rule.updated' | 'import.completed' | etc.
  entity_type   text  -- 'value_rule' | 'account' | 'scenario'
  entity_id     text,
  old_value     text  -- JSON
  new_value     text  -- JSON
  created_at    text
)
```

### What to Log

| Action | Trigger |
|--------|---------|
| `value_rule.updated` | PATCH /api/forecast/config/value-rule |
| `timing_profile.updated` | PATCH /api/forecast/config/timing-profile |
| `import.completed` | POST /api/import/save |
| `scenario.created` | POST /api/scenarios |
| `scenario.overrides.saved` | PUT /api/scenarios/:id |
| `micro_forecast.created` | POST /api/micro-forecasts |
| `compliance_config.updated` | PATCH /api/forecast/config/compliance |

### Frontend

Add "History" tab to AccountRuleEditor showing last 5 changes with user + timestamp.

---

## Phase 7 — Notification Feed (Week 3-4)

**Why this matters:** The bell in the topbar has a hardcoded red dot. It needs real content.

### DB Schema Addition

```sql
notifications (
  id            text PK,
  company_id    text FK → companies,
  clerk_user_id text,
  type          text  -- 'compliance_due' | 'import_complete' | 'rule_changed'
  title         text,
  body          text,
  action_url    text,
  read_at       text,
  created_at    text
)
```

### Notification Types

| Type | When Created | Content |
|------|-------------|---------|
| `compliance_due` | 7 days before due date | "GST R-3B due in 7 days — ₹1.2L payable" |
| `import_complete` | After import save | "12 months of data imported for Sharma Textiles" |
| `rule_changed` | After value rule update | "Revenue forecast method changed to Rolling Avg" |
| `scenario_activated` | After scenario select | "Best Case scenario is now active" |

### API

```
GET  /api/notifications?companyId=    — list unread notifications
POST /api/notifications/:id/read      — mark as read
POST /api/notifications/read-all      — mark all read
```

### Frontend

Replace hardcoded red dot with real unread count. Clicking bell opens a dropdown with the feed.

---

## Phase 8 — Zoho Books Integration (Week 4-5)

**Why this matters:** 80% of Indian SMEs use Zoho Books or Tally. Manual Excel upload is a friction point. Fathom auto-syncs daily from Xero/QuickBooks. We need the same for Indian accounting software.

### Zoho Books OAuth2 Flow

```
1. User clicks "Connect Zoho Books" in Settings
2. Redirect to Zoho OAuth2 authorization URL
3. Zoho redirects back with auth code
4. Exchange code for access_token + refresh_token
5. Store tokens encrypted in DB
6. Pull Chart of Accounts + monthly actuals via Zoho Books API
7. Map to our account structure
8. Schedule daily sync via Inngest cron
```

### DB Schema Addition

```sql
integrations (
  id              text PK,
  company_id      text FK → companies,
  provider        text  -- 'zoho_books' | 'tally' | 'quickbooks'
  access_token    text  -- encrypted
  refresh_token   text  -- encrypted
  token_expires_at text,
  zoho_org_id     text,
  last_synced_at  text,
  sync_status     text  -- 'idle' | 'syncing' | 'error'
  error_message   text
)
```

### Zoho Books API Endpoints We Need

| Our Need | Zoho API |
|----------|---------|
| Chart of Accounts | `GET /chartofaccounts` |
| P&L Statement | `GET /reports/profitandloss` |
| Balance Sheet | `GET /reports/balancesheet` |
| Monthly actuals | `GET /reports/profitandloss?period=month` |

### Sync Logic

```
src/lib/integrations/zoho-books/
  client.ts         — OAuth2 client, token refresh
  mapper.ts         — Zoho account names → our COA structure
  sync.ts           — pull data, map, upsert to DB
src/app/api/integrations/zoho/
  connect/route.ts  — initiate OAuth2
  callback/route.ts — handle redirect, store tokens
  sync/route.ts     — manual sync trigger
src/lib/inngest/functions/zoho-daily-sync.ts — daily cron
```

### Tally Integration (Phase 8b)

Tally uses a different approach — XML-based local server. We need a desktop connector or use Tally's REST API (available in Tally Prime 3.0+).

```
src/lib/integrations/tally/
  client.ts         — Tally Prime REST API client
  mapper.ts         — Tally ledger names → our COA
  sync.ts           — pull data
```

---

## Phase 9 — Actuals vs Forecast Variance (Week 5)

**Why this matters:** Fathom shows actual vs forecast comparison. This is the core value of a forecasting tool — seeing where you were wrong and why.

### What to Build

Add a "Variance" column to ForecastGrid showing `actual - forecast` and `% variance` for months that have actuals.

### Logic

```
For each month in forecastMonths:
  if month has actuals in monthly_actuals:
    variance = actual - forecast
    variance_pct = (actual - forecast) / forecast * 100
    show in grid with color coding (green = better than forecast, red = worse)
  else:
    show forecast only
```

### DB Query

```sql
SELECT 
  a.account_id,
  a.period,
  a.amount as actual,
  vr.config as rule_config
FROM monthly_actuals a
WHERE a.company_id = ? AND a.period IN (forecast_months)
```

### Frontend Change

Add `showVariance` prop to ForecastGrid. When true, add two columns per month: Forecast | Actual | Variance.

---

## Phase 10 — Rolling Forecast (Week 5-6)

**Why this matters:** Currently the forecast window is fixed at 12 months from today. As months pass, the window doesn't advance. Fathom automatically rolls forward — when April becomes an actual, May becomes the new start of the forecast.

### Logic

```
buildForecastMonthLabels() already handles this correctly:
  - If historical periods exist: starts from month AFTER last historical period
  - This means: as you import new actuals, forecast window advances automatically

The issue: we don't auto-import actuals. User has to manually re-import.
Fix: Zoho/Tally daily sync (Phase 8) solves this automatically.
Manual fix: Add "Lock actuals" button — marks a month as actual, advances forecast window.
```

### DB Change

Add `locked_periods` to companies table — array of YYYY-MM-01 strings that are locked as actuals.

---

## Phase 11 — Performance & Observability (Week 6)

### 11.1 Error Monitoring with Sentry

```bash
npm install @sentry/nextjs
```

```
sentry.client.config.ts
sentry.server.config.ts
sentry.edge.config.ts
```

Capture:
- Unhandled API errors
- Engine computation errors
- Import parse failures
- DB query failures

### 11.2 Request Logging

Add structured logging to all API routes:

```ts
// Pattern for every route handler
console.log(JSON.stringify({
  route: 'IMPORT_SAVE_POST',
  companyId: company.id,
  userId,
  duration: Date.now() - start,
  status: 200,
}))
```

### 11.3 DB Query Optimization

Current issues:
- `getActualsForCompany` loads ALL actuals for a company — can be 1000s of rows
- `getValueRules` loads all rules — no pagination
- No indexes on `period` column for actuals queries

Fixes:
```sql
-- Add to schema
index('idx_actuals_account_period').on(table.accountId, table.period)
index('idx_value_rules_account').on(table.accountId)
```

### 11.4 Connection Pooling

Turso (libSQL) handles connection pooling internally. But we should add connection timeout:

```ts
const client = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
  // Add when Turso supports it
})
```

---

## Phase 12 — Production Hardening (Week 6-7)

### 12.1 Environment Variables Audit

Required for production:

```env
# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=          # For Clerk webhooks (welcome email)

# Database
TURSO_DATABASE_URL=            # libsql://your-db.turso.io
TURSO_AUTH_TOKEN=              # Turso auth token

# File Storage
R2_ENDPOINT=                   # https://accountid.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=cashflowiq-uploads

# Email
RESEND_API_KEY=                # From resend.com

# Background Jobs
INNGEST_EVENT_KEY=             # From inngest.com
INNGEST_SIGNING_KEY=           # From inngest.com

# Integrations (Phase 8)
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REDIRECT_URI=

# Monitoring (Phase 11)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# Encryption (for OAuth tokens)
ENCRYPTION_KEY=                # 32-byte hex string for AES-256
```

### 12.2 Security Hardening

- Add `Content-Security-Policy` headers
- Add `X-Frame-Options: DENY`
- Validate file MIME type on upload (not just extension)
- Sanitize company name / account names (XSS prevention)
- Add CSRF protection on state-changing routes

### 12.3 Data Backup

- Turso has automatic backups on paid plan
- Add export endpoint: `GET /api/export/full` — returns all company data as JSON
- This is also the "Export Configuration" button in Settings (currently only exports config, not actuals)

---

## Implementation Order (Strict Priority)

```
Week 1:
  Day 1-2:  Phase 1 — Fix broken things (forecast persistence, R2, rate limiting)
  Day 3-4:  Phase 2 — Forecast caching + invalidation
  Day 5:    Phase 11.3 — DB indexes (quick win, big performance impact)

Week 2:
  Day 1-3:  Phase 3 — Inngest setup + compliance reminders
  Day 4-5:  Phase 4 — Resend email + templates

Week 3:
  Day 1-2:  Phase 5 — Multi-user / team sharing
  Day 3-4:  Phase 6 — Audit trail
  Day 5:    Phase 7 — Notification feed

Week 4-5:
  Phase 8 — Zoho Books integration (biggest feature, most value for Indian users)

Week 5-6:
  Phase 9 — Actuals vs forecast variance
  Phase 10 — Rolling forecast

Week 6-7:
  Phase 11 — Sentry + logging
  Phase 12 — Production hardening
```

---

## Tech Stack Additions (What to Install)

```bash
# Background jobs
npm install inngest

# Email
npm install resend @react-email/components

# Rate limiting
npm install @upstash/ratelimit @upstash/redis

# Error monitoring
npm install @sentry/nextjs

# Encryption (for OAuth tokens)
npm install @noble/ciphers

# Zoho Books integration
# No SDK needed — standard fetch with OAuth2
```

---

## What NOT to Build

- **Xero/QuickBooks integration** — not relevant for Indian market. Zoho Books + Tally covers 90% of Indian SMEs.
- **Custom database per tenant** — overkill at our scale. Row-level isolation with `company_id` is correct.
- **GraphQL** — REST is fine. Adding GraphQL would be complexity without benefit.
- **Redis for session caching** — Clerk handles sessions. We don't need Redis for auth.
- **Microservices** — monolith is correct for this stage. Split only when a specific service needs independent scaling.
- **Real-time WebSockets** — not needed. Polling on config changes is sufficient.

---

## Key Invariants to Never Break

1. **Every DB write must check `clerkUserId` ownership.** No exceptions.
2. **All monetary values are integer paise.** Never store rupees.
3. **Period format is always `YYYY-MM-01`.** Never store month labels.
4. **Engine is pure.** Never add DB calls inside `runForecastEngine()`.
5. **Inngest functions must be idempotent.** They can be retried — don't send duplicate emails.
6. **OAuth tokens must be encrypted at rest.** Never store plaintext access tokens.
7. **File uploads must be validated server-side.** Extension check is not enough — validate MIME type.
