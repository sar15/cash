-- Create GST filings table for tracking GSTR-1 and GSTR-3B filing status
CREATE TABLE gst_filings (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  return_type TEXT NOT NULL,
  status TEXT NOT NULL,
  due_date TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  filed_at TEXT,
  reference_number TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(company_id, period, return_type)
);

CREATE INDEX idx_gst_filings_company_period ON gst_filings(company_id, period);
