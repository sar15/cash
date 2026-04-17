CREATE TABLE IF NOT EXISTS account_mappings (id TEXT PRIMARY KEY NOT NULL, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE, raw_ledger_name TEXT NOT NULL, standard_account_id TEXT, skipped INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_mappings_unique ON account_mappings (company_id, raw_ledger_name);
CREATE INDEX IF NOT EXISTS idx_account_mappings_company ON account_mappings (company_id);
