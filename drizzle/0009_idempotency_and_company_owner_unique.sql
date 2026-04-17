CREATE UNIQUE INDEX IF NOT EXISTS `idx_companies_owner_unique` ON `companies` (`clerk_user_id`);

CREATE TABLE IF NOT EXISTS `idempotency_keys` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL,
  `key` text NOT NULL,
  `route` text NOT NULL,
  `method` text NOT NULL,
  `response_status` integer NOT NULL,
  `response_body` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT (datetime('now')),
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `idx_idempotency_unique`
  ON `idempotency_keys` (`company_id`, `key`, `route`, `method`);
CREATE INDEX IF NOT EXISTS `idx_idempotency_created`
  ON `idempotency_keys` (`created_at`);
