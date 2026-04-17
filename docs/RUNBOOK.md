# Runbook (Production)

This is a practical checklist for keeping CashFlowIQ stable in production.

## 1) Backups and restore

### Backup (company-level export)
- Use: `GET /api/export/full?companyId=<id>`
- Store the JSON export in a private bucket or offline storage.
- Recommended cadence:
  - BusinessOwner: weekly
  - CA/Firm: daily for active clients

### Restore
There is no “one-click restore” endpoint yet. For recovery, restore by replaying the export into the DB (manual/admin operation).

## 2) Incident response

### Symptoms
- Elevated 5xx responses
- `/api/health` returns 503 or `status: degraded`
- Users report stuck imports or report generation failures

### Triage steps
1. Check `/api/health`
2. Check `/diagnostics` to confirm optional services (R2/Resend/Inngest/Upstash) are enabled if expected
3. Identify which route is failing (logs)
4. If failures correlate to provider timeouts, the app now has basic timeout/retry wrappers for email and R2

## 3) Rollback procedure
- Prefer redeploying the last known-good build.
- If a migration caused issues:
  - Pause further deploys
  - Export company data using `/api/export/full`
  - Restore DB snapshot if your DB provider supports it (recommended)

## 4) Secrets rotation
- If any secret is suspected leaked:
  - Rotate Clerk keys
  - Rotate Turso token
  - Rotate Resend key
  - Rotate Upstash token
  - Rotate ENCRYPTION_KEY only with a defined data migration plan (token encryption depends on it)

