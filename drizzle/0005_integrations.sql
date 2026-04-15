CREATE TABLE `integrations` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL,
  `provider` text NOT NULL,
  `access_token` text NOT NULL,
  `refresh_token` text NOT NULL,
  `token_expires_at` text,
  `zoho_org_id` text,
  `last_synced_at` text,
  `sync_status` text DEFAULT 'idle',
  `error_message` text,
  `created_at` text DEFAULT (datetime('now')),
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `idx_integrations_company_provider` ON `integrations` (`company_id`, `provider`);
CREATE INDEX `idx_integrations_company` ON `integrations` (`company_id`);
