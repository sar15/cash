DROP INDEX IF EXISTS `idx_companies_owner_unique`;

ALTER TABLE `companies` ADD COLUMN `is_primary` integer DEFAULT 0;

UPDATE companies
SET is_primary = CASE
  WHEN id = (
    SELECT id
    FROM companies c2
    WHERE c2.clerk_user_id = companies.clerk_user_id
    ORDER BY datetime(c2.created_at) ASC, c2.id ASC
    LIMIT 1
  )
  THEN 1
  ELSE 0
END;

CREATE UNIQUE INDEX IF NOT EXISTS `idx_companies_primary_per_user`
ON `companies` (`clerk_user_id`)
WHERE is_primary = 1;
