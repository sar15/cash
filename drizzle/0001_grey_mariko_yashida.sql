CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`clerk_user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`old_value` text,
	`new_value` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_audit_company` ON `audit_log` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `company_members` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`clerk_user_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`invited_by` text,
	`invited_email` text,
	`accepted_at` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_unique` ON `company_members` (`company_id`,`clerk_user_id`);--> statement-breakpoint
CREATE INDEX `idx_members_user` ON `company_members` (`clerk_user_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`clerk_user_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`action_url` text,
	`read_at` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_company` ON `notifications` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user` ON `notifications` (`clerk_user_id`,`read_at`);--> statement-breakpoint
ALTER TABLE `compliance_config` ADD `supply_type` text DEFAULT 'intra-state';--> statement-breakpoint
ALTER TABLE `compliance_config` ALTER COLUMN "company_id" TO "company_id" text NOT NULL REFERENCES companies(id) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_forecast_result_stable` ON `forecast_results` (`company_id`,`scenario_id`);--> statement-breakpoint
ALTER TABLE `forecast_results` ALTER COLUMN "scenario_id" TO "scenario_id" text REFERENCES scenarios(id) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_mfl_forecast` ON `micro_forecast_lines` (`micro_forecast_id`);--> statement-breakpoint
ALTER TABLE `micro_forecast_lines` ALTER COLUMN "account_id" TO "account_id" text REFERENCES accounts(id) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `micro_forecast_lines` ALTER COLUMN "timing_profile_id" TO "timing_profile_id" text REFERENCES timing_profiles(id) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_micro_forecasts_company` ON `micro_forecasts` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_actuals_account` ON `monthly_actuals` (`account_id`,`period`);--> statement-breakpoint
CREATE INDEX `idx_scenario_overrides_scenario` ON `scenario_overrides` (`scenario_id`);--> statement-breakpoint
CREATE INDEX `idx_scenarios_company` ON `scenarios` (`company_id`);--> statement-breakpoint
ALTER TABLE `scenarios` ALTER COLUMN "parent_id" TO "parent_id" text REFERENCES scenarios(id) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_timing_profiles_company` ON `timing_profiles` (`company_id`);--> statement-breakpoint
ALTER TABLE `accounts` ALTER COLUMN "parent_id" TO "parent_id" text REFERENCES accounts(id) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quick_metrics_config` ALTER COLUMN "company_id" TO "company_id" text NOT NULL REFERENCES companies(id) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `value_rules` ALTER COLUMN "scenario_id" TO "scenario_id" text REFERENCES scenarios(id) ON DELETE set null ON UPDATE no action;