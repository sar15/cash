CREATE UNIQUE INDEX IF NOT EXISTS idx_firms_owner_unique ON firms (owner_clerk_user_id);

CREATE TABLE IF NOT EXISTS company_invites (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  invited_by TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  accepted_by_clerk_user_id TEXT,
  accepted_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_invites_email_unique
  ON company_invites (company_id, invited_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_invites_token_unique
  ON company_invites (token_hash);
CREATE INDEX IF NOT EXISTS idx_company_invites_status
  ON company_invites (company_id, status);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  processed_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_deliveries_unique
  ON webhook_deliveries (provider, event_id);
