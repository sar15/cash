-- Migration: Add forecast status column and replace lockedPeriods with booksClosedDate

-- 1. Add status column to forecast_results (default 'ready' for existing rows)
ALTER TABLE forecast_results ADD COLUMN status TEXT NOT NULL DEFAULT 'ready';

-- 2. Add booksClosedDate to companies
ALTER TABLE companies ADD COLUMN books_closed_date TEXT;

-- 3. Migrate existing lockedPeriods data: take the latest locked period as booksClosedDate
--    If lockedPeriods is '[]' or null, booksClosedDate stays null.
UPDATE companies
SET books_closed_date = (
  SELECT MAX(value)
  FROM json_each(locked_periods)
  WHERE locked_periods IS NOT NULL AND locked_periods != '[]'
)
WHERE locked_periods IS NOT NULL AND locked_periods != '[]';

-- Note: locked_periods column is kept for now to avoid breaking existing reads.
-- It will be removed in a future migration once all reads are migrated to books_closed_date.
