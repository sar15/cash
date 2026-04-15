CREATE TABLE `compliance_payments` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL,
  `clerk_user_id` text NOT NULL,
  `obligation_id` text NOT NULL,
  `paid_at` text DEFAULT (datetime('now')),
  `created_at` text DEFAULT (datetime('now')),
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `idx_compliance_payments_unique` ON `compliance_payments` (`company_id`, `obligation_id`);
CREATE INDEX `idx_compliance_payments_company` ON `compliance_payments` (`company_id`);
