CREATE TABLE IF NOT EXISTS tax_rate_history (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rate_type TEXT NOT NULL,
  rate REAL NOT NULL,
  effective_from TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tax_rate_history_company ON tax_rate_history (company_id, rate_type, effective_from);

INSERT INTO tax_rate_history (id, company_id, rate_type, rate, effective_from, notes) SELECT lower(hex(randomblob(16))), company_id, 'gst', gst_rate, '2020-04-01', 'Seeded from complianceConfig on migration' FROM compliance_config WHERE gst_rate IS NOT NULL;

INSERT INTO tax_rate_history (id, company_id, rate_type, rate, effective_from, notes) SELECT lower(hex(randomblob(16))), company_id, 'corporate_tax', tax_rate, '2020-04-01', 'Seeded from complianceConfig on migration' FROM compliance_config WHERE tax_rate IS NOT NULL;

INSERT INTO tax_rate_history (id, company_id, rate_type, rate, effective_from, notes) SELECT lower(hex(randomblob(16))), company_id, 'itc_pct', itc_pct, '2020-04-01', 'Seeded from complianceConfig on migration' FROM compliance_config WHERE itc_pct IS NOT NULL;
