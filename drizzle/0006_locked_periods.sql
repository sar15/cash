-- Add locked_periods column to companies table for rolling forecast
ALTER TABLE companies ADD COLUMN locked_periods TEXT DEFAULT '[]';
