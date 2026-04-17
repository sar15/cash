CREATE TABLE IF NOT EXISTS `firms` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_clerk_user_id` text NOT NULL,
  `name` text NOT NULL,
  `created_at` text DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `idx_firms_owner` ON `firms` (`owner_clerk_user_id`);

CREATE TABLE IF NOT EXISTS `firm_members` (
  `id` text PRIMARY KEY NOT NULL,
  `firm_id` text NOT NULL,
  `clerk_user_id` text NOT NULL,
  `role` text DEFAULT 'staff' NOT NULL,
  `accepted_at` text,
  `created_at` text DEFAULT (datetime('now')),
  FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `idx_firm_members_unique` ON `firm_members` (`firm_id`, `clerk_user_id`);
CREATE INDEX IF NOT EXISTS `idx_firm_members_user` ON `firm_members` (`clerk_user_id`);

CREATE TABLE IF NOT EXISTS `firm_clients` (
  `id` text PRIMARY KEY NOT NULL,
  `firm_id` text NOT NULL,
  `company_id` text NOT NULL,
  `created_at` text DEFAULT (datetime('now')),
  FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON DELETE cascade,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `idx_firm_clients_unique` ON `firm_clients` (`firm_id`, `company_id`);
CREATE INDEX IF NOT EXISTS `idx_firm_clients_company` ON `firm_clients` (`company_id`);
