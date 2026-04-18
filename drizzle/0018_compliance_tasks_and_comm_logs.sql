-- Migration: Add compliance_tasks and communication_logs tables
-- Replaces the limited gstFilings table with a generic, extensible workflow schema.
-- gstFilings is kept for backward compat — existing data is not migrated.

CREATE TABLE IF NOT EXISTS compliance_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  filing_type TEXT NOT NULL,
  period_label TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  assigned_to_user_id TEXT,
  filed_at TEXT,
  arn TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_company_status ON compliance_tasks (company_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON compliance_tasks (due_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_unique ON compliance_tasks (company_id, filing_type, period_label);

CREATE TABLE IF NOT EXISTS communication_logs (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT REFERENCES compliance_tasks(id) ON DELETE SET NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_by_user_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comm_logs_company ON communication_logs (company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comm_logs_task ON communication_logs (task_id);
