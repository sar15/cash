# CashFlowIQ — Deployment Guide

## Pre-Deploy Checklist

Before deploying any new version to production, complete these steps in order.

### 1. Run Database Migrations

```bash
npm run db:migrate
```

Verify all migrations are applied:

```bash
npx drizzle-kit status
```

Expected output: all migrations show as applied with no pending changes.

### 2. Backup the Turso Database

```bash
turso db shell <your-db-name> .dump > backup-$(date +%Y%m%d-%H%M%S).sql
```

Store the backup file in a safe location before proceeding.

### 3. Deploy

Deploy via Vercel dashboard or CLI:

```bash
vercel --prod
```

---

## Post-Deploy Smoke Test

After every production deployment, verify these critical paths:

| # | Check | Expected |
|---|-------|----------|
| 1 | `GET /api/health` | `{ "status": "ok" }` with HTTP 200 |
| 2 | Sign in via Clerk | Dashboard loads, company data visible |
| 3 | Import a CSV file | Forecast renders with correct accounts |
| 4 | Download a report | PDF downloads with correct filename |
| 5 | Check Sentry dashboard | No new unhandled errors in last 5 minutes |

---

## Rollback Procedure

### Instant Rollback (Vercel)

1. Go to Vercel dashboard → Deployments
2. Find the previous successful deployment
3. Click **Promote to Production**

Vercel rollback is instant — no downtime.

### Database Rollback

If a migration needs to be reverted:

```bash
# Restore from pre-deploy backup
turso db shell <your-db-name> < backup-YYYYMMDD-HHMMSS.sql
```

> **Warning**: Database rollback will lose any data written after the backup was taken. Only do this if the migration introduced a breaking schema change.

---

## Environment Variables

### Always Required in Production

| Variable | Description |
|----------|-------------|
| `TURSO_DATABASE_URL` | Turso database URL (`libsql://your-db.turso.io`) |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `CLERK_SECRET_KEY` | Clerk secret key from dashboard |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |

### Required When Feature is Enabled

| Variable | Feature |
|----------|---------|
| `ENCRYPTION_KEY` | Zoho integration (64 hex chars) |
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` | Zoho Books integration |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Email notifications |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Background jobs |
| `R2_ENDPOINT` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | File storage |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Distributed rate limiting |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring |

### Optional Guards

| Variable | Effect |
|----------|--------|
| `STRICT_PROD_GUARDS=true` | Fail hard at startup if Redis is not configured |

---

## Monitoring

- **Sentry**: Verify `SENTRY_DSN` is set. Errors are captured automatically via `withSentryConfig` in `next.config.ts`.
- **Health endpoint**: `GET /api/health` — use this in your uptime monitor (e.g. Vercel Cron, UptimeRobot).
- **Rate limiting**: If `UPSTASH_REDIS_REST_URL` is not set, a `console.error` is logged at startup. Check logs after deploy.
- **Email**: If `RESEND_API_KEY` is not set in production, a `console.error` is logged on every email attempt.
