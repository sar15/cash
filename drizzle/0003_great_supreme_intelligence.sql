CREATE TABLE `bank_reconciliations` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`period` text NOT NULL,
	`status` text NOT NULL,
	`book_closing_balance_paise` integer,
	`bank_closing_balance_paise` integer,
	`variance_paise` integer,
	`reconciled_at` text,
	`reconciled_by` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bank_recon_unique` ON `bank_reconciliations` (`company_id`,`period`);--> statement-breakpoint
CREATE INDEX `idx_bank_recon_company_period` ON `bank_reconciliations` (`company_id`,`period`);--> statement-breakpoint
CREATE TABLE `compliance_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`clerk_user_id` text NOT NULL,
	`obligation_id` text NOT NULL,
	`paid_at` text DEFAULT (datetime('now')),
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_compliance_payments_unique` ON `compliance_payments` (`company_id`,`obligation_id`);--> statement-breakpoint
CREATE INDEX `idx_compliance_payments_company` ON `compliance_payments` (`company_id`);--> statement-breakpoint
CREATE TABLE `firm_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`company_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_firm_clients_unique` ON `firm_clients` (`firm_id`,`company_id`);--> statement-breakpoint
CREATE INDEX `idx_firm_clients_company` ON `firm_clients` (`company_id`);--> statement-breakpoint
CREATE TABLE `firm_members` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_id` text NOT NULL,
	`clerk_user_id` text NOT NULL,
	`role` text DEFAULT 'staff' NOT NULL,
	`accepted_at` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`firm_id`) REFERENCES `firms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_firm_members_unique` ON `firm_members` (`firm_id`,`clerk_user_id`);--> statement-breakpoint
CREATE INDEX `idx_firm_members_user` ON `firm_members` (`clerk_user_id`);--> statement-breakpoint
CREATE TABLE `firms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_clerk_user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `idx_firms_owner` ON `firms` (`owner_clerk_user_id`);--> statement-breakpoint
CREATE TABLE `gst_filings` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`period` text NOT NULL,
	`return_type` text NOT NULL,
	`status` text NOT NULL,
	`due_date` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`filed_at` text,
	`reference_number` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_gst_filings_unique` ON `gst_filings` (`company_id`,`period`,`return_type`);--> statement-breakpoint
CREATE INDEX `idx_gst_filings_company_period` ON `gst_filings` (`company_id`,`period`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`key` text NOT NULL,
	`route` text NOT NULL,
	`method` text NOT NULL,
	`response_status` integer NOT NULL,
	`response_body` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_idempotency_unique` ON `idempotency_keys` (`company_id`,`key`,`route`,`method`);--> statement-breakpoint
CREATE INDEX `idx_idempotency_created` ON `idempotency_keys` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`clerk_user_id` text PRIMARY KEY NOT NULL,
	`user_type` text DEFAULT 'business_owner' NOT NULL,
	`onboarding_completed` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `idx_user_profiles_type` ON `user_profiles` (`user_type`);--> statement-breakpoint
ALTER TABLE `companies` ADD `is_primary` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `companies` ADD `locked_periods` text DEFAULT '[]';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_timing_profiles_company_name` ON `timing_profiles` (`company_id`,`name`);