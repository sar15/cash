# Troubleshooting Guide

## Common Issues

### Development Server

#### Server won't start

**Symptom:** `npm run dev` fails with error

**Solutions:**
1. Check Node.js version: `node -v` (requires Node 18+)
2. Clear `.next` folder: `rm -rf .next`
3. Reinstall dependencies: `rm -rf node_modules && npm install`
4. Check environment variables in `.env.local`

#### Port already in use

**Symptom:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)

# Or use a different port
PORT=3001 npm run dev
```

---

### Database Issues

#### Database connection fails

**Symptom:** `Error: Failed to connect to database`

**Solutions:**
1. Check `TURSO_DATABASE_URL` in `.env.local`
2. For local dev, use: `TURSO_DATABASE_URL=file:local.db`
3. For production, verify Turso token is valid
4. Check Turso dashboard for database status

#### Schema out of sync

**Symptom:** `Error: no such table: companies`

**Solution:**
```bash
# Push schema to database
npm run db:push

# Or run migrations
npm run db:migrate
```

#### Migration fails

**Symptom:** `Error: Migration failed`

**Solutions:**
1. Check database connection
2. Verify migration files in `drizzle/` folder
3. Manually inspect database: `npm run db:studio`
4. Drop and recreate database (dev only):
   ```bash
   rm local.db
   npm run db:push
   npm run seed
   ```

---

### Authentication Issues

#### Clerk authentication fails

**Symptom:** Redirect loop or "Unauthorized" errors

**Solutions:**
1. Verify Clerk keys in `.env.local`:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
2. Check Clerk dashboard for application status
3. Clear browser cookies and try again
4. Verify domain is added to Clerk allowed origins

#### Webhook signature verification fails

**Symptom:** `Error: Invalid webhook signature`

**Solutions:**
1. Verify `CLERK_WEBHOOK_SECRET` matches Clerk dashboard
2. Check webhook endpoint is accessible: `https://your-domain.com/api/webhooks/clerk`
3. Verify webhook is subscribed to `user.created` event

---

### File Upload Issues

#### Upload fails with 500 error

**Symptom:** File upload returns 500 Internal Server Error

**Solutions:**
1. Check file size (max 10MB)
2. Verify R2 credentials in `.env.local`
3. Check R2 bucket exists and is accessible
4. In dev, uploads fall back to local storage (check `uploads/` folder)

#### R2 connection fails

**Symptom:** `Error: Failed to upload to R2`

**Solutions:**
1. Verify R2 credentials:
   - `R2_ENDPOINT`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
2. Check Cloudflare dashboard for bucket status
3. Verify API token has R2 read/write permissions

---

### Forecast Engine Issues

#### Forecast not computing

**Symptom:** Dashboard shows "No forecast data"

**Solutions:**
1. Import financial data first (Data → Import)
2. Check browser console for errors
3. Verify accounts are categorized correctly
4. Check value rules are configured

#### Forecast results not saving

**Symptom:** Forecast recomputes on every page load

**Solutions:**
1. Check `forecast_results` table exists: `npm run db:studio`
2. Verify API route is working: Check Network tab in browser DevTools
3. Check for errors in server logs
4. Verify `ENCRYPTION_KEY` is set (required for caching)

#### Balance sheet doesn't balance

**Symptom:** `Error: Balance sheet does not balance`

**Solutions:**
1. Check account categorization (Assets, Liabilities, Equity)
2. Verify opening balances are correct
3. Check for missing accounts in import
4. Review engine logs for specific imbalance

---

### Performance Issues

#### Slow page loads

**Symptom:** Pages take >3 seconds to load

**Solutions:**
1. Enable forecast caching (should be automatic)
2. Check database latency: `/api/health`
3. Verify Turso database is in correct region
4. Clear browser cache
5. Check Network tab for slow API calls

#### High memory usage

**Symptom:** Browser tab crashes or becomes unresponsive

**Solutions:**
1. Reduce forecast window (12 months max recommended)
2. Limit number of scenarios (3 max recommended)
3. Close unused browser tabs
4. Check for memory leaks in browser DevTools

---

### Build Issues

#### TypeScript errors

**Symptom:** `npm run build` fails with type errors

**Solution:**
```bash
# Run type check
npm run typecheck

# Fix errors shown
# Common issues:
# - Missing types for dependencies
# - Incorrect prop types
# - Unused variables
```

#### Lint errors

**Symptom:** `npm run lint` shows errors

**Solution:**
```bash
# Run lint
npm run lint

# Auto-fix where possible
npm run lint -- --fix
```

#### Build succeeds but app crashes

**Symptom:** Build completes but app crashes in production

**Solutions:**
1. Check environment variables are set in Vercel
2. Review Sentry for errors
3. Check Vercel function logs
4. Verify all required env vars are present

---

### Email Issues

#### Emails not sending

**Symptom:** No emails received

**Solutions:**
1. Verify `RESEND_API_KEY` is set
2. Check `RESEND_FROM_EMAIL` uses verified domain
3. Check Resend dashboard for delivery status
4. Verify email templates exist in `src/emails/`
5. Check spam folder

#### Email templates not rendering

**Symptom:** Emails are blank or malformed

**Solutions:**
1. Verify React Email components are valid
2. Test templates locally: `npm run email:dev` (if configured)
3. Check Resend dashboard for rendering errors

---

### Rate Limiting Issues

#### Rate limit errors

**Symptom:** `Error: Too many requests`

**Solutions:**
1. Wait for rate limit window to reset
2. Check rate limit configuration in `src/lib/rate-limit.ts`
3. Verify Upstash Redis is accessible
4. In dev, rate limiting uses in-memory fallback (less strict)

#### Rate limiting not working

**Symptom:** No rate limiting applied

**Solutions:**
1. Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
2. Check Upstash dashboard for database status
3. Falls back to in-memory if Redis is unavailable (not distributed)

---

### Integration Issues

#### Zoho Books connection fails

**Symptom:** OAuth flow fails or tokens not saved

**Solutions:**
1. Verify Zoho credentials:
   - `ZOHO_CLIENT_ID`
   - `ZOHO_CLIENT_SECRET`
   - `ZOHO_REDIRECT_URI`
2. Check `ENCRYPTION_KEY` is set (required for token storage)
3. Verify redirect URI matches Zoho app configuration
4. Check Zoho dashboard for app status

#### Zoho sync fails

**Symptom:** Data not syncing from Zoho Books

**Solutions:**
1. Check integration status in Settings → Integrations
2. Verify Zoho tokens are valid (check expiry)
3. Check Inngest dashboard for job status
4. Review sync logs in Sentry

---

### Testing Issues

#### Tests fail

**Symptom:** `npm test` shows failures

**Solutions:**
1. Verify `vitest.setup.ts` exists
2. Check `ENCRYPTION_KEY` is set in test environment
3. Run tests in watch mode: `npm test -- --watch`
4. Check for stale snapshots: `npm test -- -u`

#### Tests timeout

**Symptom:** Tests hang and timeout

**Solutions:**
1. Increase timeout in test file: `test('...', { timeout: 10000 })`
2. Check for unresolved promises
3. Verify database connection in tests

---

## Error Messages

### "ENCRYPTION_KEY is required"

**Cause:** Missing or invalid encryption key

**Solution:**
```bash
# Generate a new key (64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env.local
ENCRYPTION_KEY=your-generated-key
```

### "Company not found or access denied"

**Cause:** User doesn't have access to the company

**Solutions:**
1. Verify user is logged in
2. Check company ownership in database
3. Verify `clerkUserId` matches
4. Check `company_members` table for access

### "Balance sheet does not balance"

**Cause:** Assets ≠ Liabilities + Equity

**Solutions:**
1. Check account categorization
2. Verify opening balances
3. Review imported data for errors
4. Check for missing accounts

### "Invalid period format"

**Cause:** Period is not in `YYYY-MM-01` format

**Solutions:**
1. Verify import data uses correct format
2. Check date parsing in import logic
3. Ensure no timezone issues

---

## Performance Benchmarks

### Expected Performance

| Operation | Expected Time | Threshold |
|-----------|--------------|-----------|
| Dashboard load | 500-800ms | <2s |
| API calls | 100-300ms | <500ms |
| Forecast computation | 1-1.5s | <3s |
| Database queries | 50-100ms | <200ms |

### If Performance is Worse

1. Check database latency: `/api/health`
2. Verify forecast caching is working
3. Check network conditions (3G baseline)
4. Review Vercel function logs for cold starts
5. Consider upgrading Turso plan for better performance

---

## Getting Help

### Before Asking for Help

1. Check this troubleshooting guide
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
3. Check browser console for errors
4. Review server logs (Vercel or local)
5. Check Sentry for error details

### Information to Provide

When reporting an issue, include:
- Error message (full stack trace)
- Steps to reproduce
- Environment (dev/production)
- Browser and version
- Relevant code snippets
- Screenshots if applicable

---

## Debug Mode

### Enable Verbose Logging

```env
# Add to .env.local
DEBUG=cashflowiq:*
NODE_ENV=development
```

### Check Health Endpoint

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "ts": "2026-04-16T12:00:00.000Z"
}
```

### Inspect Database

```bash
npm run db:studio
# Opens Drizzle Studio at http://localhost:4983
```

---

## Known Issues

### React Hooks Warning (Non-Critical)

**Symptom:** Warning in console about conditional hooks

**Location:** `src/app/(app)/forecast/page.tsx`

**Impact:** Cosmetic only, no functional impact

**Status:** Low priority, will be fixed in future update

### Turbopack Warnings

**Symptom:** Warnings about experimental features

**Impact:** None, Turbopack is stable in Next.js 16

**Status:** Expected, can be ignored
