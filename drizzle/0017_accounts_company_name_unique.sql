-- Add missing unique index on accounts(company_id, name).
-- This index was defined in schema.ts but never included in a migration,
-- causing ON CONFLICT (company_id, name) in the import save route to fail
-- with "Failed query" on every import that includes new accounts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_company_name ON accounts (company_id, name);
