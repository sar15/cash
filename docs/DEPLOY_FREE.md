# $0/month Deployment Blueprint (Best-effort)

CashFlowIQ can run end-to-end at **$0/month** using free tiers, with graceful degradation for optional features.

## Core goal
- **Always-on core**: auth + DB + app hosting.
- **Optional**: email, background jobs, object storage, monitoring.

## Recommended free-tier stack
- **Hosting**: Vercel free tier (Next.js)
- **Database**: Turso free tier (libSQL/SQLite)
- **Auth**: Clerk free tier
- **Rate limit**: Upstash free tier (optional but recommended)

## Optional add-ons (free/cheap)
- **Email**: Resend free tier (optional)
- **Jobs**: Inngest free tier (optional)
- **File storage**: Cloudflare R2 (optional; app can still function without persistent uploads)
- **Monitoring**: Sentry free tier (optional)

## Environment variables (minimum)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

## “Free mode” behavior
If optional services are not configured:
- **Email**: reminders and onboarding emails are skipped
- **Jobs**: scheduled tasks won’t run
- **Storage**: uploads may fall back to local/dev mode; production should avoid relying on local disk

Use the in-app **Diagnostics** page (`/diagnostics`) to see which features are enabled.

## Production checklist (free-tier)
- Run DB migrations: `npm run db:migrate`
- Verify `/api/health` returns `status: ok` and `checks.database: up`
- Verify `/diagnostics` shows the expected feature flags

