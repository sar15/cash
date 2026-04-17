# Deployment Guide

## Prerequisites

- Vercel account
- Turso account (database)
- Cloudflare account (R2 storage)
- Clerk account (authentication)
- Resend account (email, optional)
- Inngest account (background jobs, optional)
- Upstash account (rate limiting, optional)

---

## 1. Database Setup (Turso)

### Create Database

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create production database
turso db create cashflowiq-prod

# Get connection details
turso db show cashflowiq-prod --url
turso db tokens create cashflowiq-prod
```

Save the URL and token for environment variables.

### Run Migrations

```bash
# Set environment variables
export TURSO_DATABASE_URL="libsql://your-db.turso.io"
export TURSO_AUTH_TOKEN="your-token"

# Run migrations
npm run db:migrate
```

---

## 2. File Storage Setup (Cloudflare R2)

### Create Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
2. Create bucket: `cashflowiq-uploads`
3. Create API token with R2 read/write permissions
4. Note your Account ID, Access Key ID, and Secret Access Key

### Configure CORS (Optional)

If you need direct browser uploads:

```json
{
  "AllowedOrigins": ["https://your-domain.com"],
  "AllowedMethods": ["GET", "PUT", "POST"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}
```

---

## 3. Authentication Setup (Clerk)

### Create Application

1. Sign up at [clerk.com](https://clerk.com)
2. Create a new application
3. Enable email/password authentication
4. Get your publishable and secret keys

### Configure Webhooks

1. Go to Clerk Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to `user.created` event
4. Copy the signing secret

---

## 4. Email Setup (Resend) - Optional

### Create Account

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your domain
3. Create an API key
4. Update `RESEND_FROM_EMAIL` to use your verified domain

---

## 5. Background Jobs Setup (Inngest) - Optional

### Create Application

1. Sign up at [inngest.com](https://app.inngest.com)
2. Create an app
3. Get your Event Key and Signing Key
4. Add webhook endpoint: `https://your-domain.com/api/inngest`

---

## 6. Rate Limiting Setup (Upstash) - Optional

### Create Redis Database

1. Sign up at [upstash.com](https://upstash.com)
2. Create a Redis database (free tier available)
3. Get REST URL and token

---

## 7. Error Monitoring Setup (Sentry) - Optional

### Create Project

1. Sign up at [sentry.io](https://sentry.io)
2. Create a Next.js project
3. Get your DSN
4. Configure source maps upload (already configured in `next.config.ts`)

---

## 8. Deploy to Vercel

### Install Vercel CLI

```bash
npm i -g vercel
```

### Deploy

```bash
vercel --prod
```

### Configure Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

**Required:**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
ENCRYPTION_KEY=your-64-char-hex-key
```

**Optional (features degrade gracefully):**
```env
# File storage
R2_ENDPOINT=https://accountid.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret
R2_BUCKET_NAME=cashflowiq-uploads

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Background jobs
INNGEST_EVENT_KEY=your-event-key
INNGEST_SIGNING_KEY=your-signing-key

# Rate limiting
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Error monitoring
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# Webhooks
CLERK_WEBHOOK_SECRET=whsec_...

# Zoho Books integration
ZOHO_CLIENT_ID=your-client-id
ZOHO_CLIENT_SECRET=your-client-secret
ZOHO_REDIRECT_URI=https://your-domain.com/api/integrations/zoho/callback
```

---

## 9. Post-Deployment Verification

### Smoke Test Checklist

- [ ] Health endpoint responds: `curl https://your-domain.com/api/health`
- [ ] Sign up flow works
- [ ] Create company works
- [ ] Import demo data works
- [ ] Dashboard loads with data
- [ ] Forecast page renders
- [ ] Compliance page shows calculations
- [ ] Settings page saves changes

### Monitor Logs

```bash
# View deployment logs
vercel logs

# View function logs
vercel logs --follow
```

### Check Sentry

If configured, check Sentry dashboard for any errors.

---

## 10. Rollback Procedure

### Rollback to Previous Deployment

```bash
# List deployments
vercel ls

# Promote a previous deployment
vercel promote <deployment-url>
```

### Rollback Database Migration

```bash
# Turso doesn't support automatic rollback
# You'll need to manually revert schema changes

# 1. Identify the migration to revert
# 2. Write a down migration
# 3. Apply it manually
```

**Important:** Always test migrations on a staging database first.

---

## 11. Backup Procedures

### Database Backup

```bash
# Turso automatic backups (paid plan)
turso db backup cashflowiq-prod

# Manual export
turso db shell cashflowiq-prod ".dump" > backup.sql
```

### Export Company Data

Use the export endpoint:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-domain.com/api/export/full?companyId=xxx \
  > company-backup.json
```

---

## 12. Scaling Considerations

### Database
- Turso scales automatically
- Consider upgrading to paid plan for:
  - More concurrent connections
  - Automatic backups
  - Point-in-time recovery

### Serverless Functions
- Vercel Edge Functions scale automatically
- Monitor function execution time (10s limit)
- Consider moving long-running tasks to Inngest

### File Storage
- R2 has no egress fees
- Consider CDN for frequently accessed files

### Rate Limiting
- Upstash Redis scales automatically
- Adjust rate limits based on usage patterns

---

## 13. Monitoring

### Key Metrics to Monitor

- **Response time:** API routes should respond in <500ms
- **Error rate:** Should be <1%
- **Database latency:** Should be <100ms
- **Function execution time:** Should be <2s

### Set Up Alerts

Configure Sentry alerts for:
- Error rate > 1%
- Response time > 2s
- Database connection failures

---

## 14. Security Checklist

- [ ] All environment variables are set
- [ ] ENCRYPTION_KEY is 64 characters (32 bytes hex)
- [ ] Clerk webhook secret is configured
- [ ] R2 bucket is not publicly accessible
- [ ] Rate limiting is enabled in production
- [ ] CSP headers are configured
- [ ] HTTPS is enforced
- [ ] Sentry is configured for error tracking

---

## 15. Performance Optimization

### Enable Caching

Forecast results are automatically cached. Ensure:
- `forecast_results` table exists
- Cache invalidation works on config changes

### Enable Turbopack

Already configured in `package.json`:
```json
"dev": "node node_modules/next/dist/bin/next dev"
```

### Monitor Bundle Size

```bash
npm run build
# Check .next/analyze for bundle analysis
```

---

## Troubleshooting

### Common Issues

**Database connection fails:**
- Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- Check Turso dashboard for database status

**File uploads fail:**
- Verify R2 credentials
- Check R2 bucket permissions
- Falls back to local storage in dev (not production)

**Emails not sending:**
- Verify `RESEND_API_KEY`
- Check domain verification in Resend dashboard
- Emails are silently skipped if Resend is not configured

**Rate limiting not working:**
- Verify Upstash Redis credentials
- Falls back to in-memory (not distributed) if Redis is unavailable

---

## Support

For deployment issues:
1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Review Vercel deployment logs
3. Check Sentry for errors
4. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
