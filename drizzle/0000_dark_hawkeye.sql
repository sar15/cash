CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`code` text,
	`name` text NOT NULL,
	`parent_id` text,
	`level` integer DEFAULT 0,
	`account_type` text NOT NULL,
	`standard_mapping` text,
	`is_group` integer DEFAULT false,
	`sort_order` integer DEFAULT 0,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_company` ON `accounts` (`company_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_user_id` text NOT NULL,
	`name` text NOT NULL,
	`pan` text,
	`gstin` text,
	`industry` text DEFAULT 'general',
	`fy_start_month` integer DEFAULT 4,
	`currency` text DEFAULT 'INR',
	`number_format` text DEFAULT 'lakhs',
	`logo_url` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `idx_companies_user` ON `companies` (`clerk_user_id`);--> statement-breakpoint
CREATE TABLE `compliance_config` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`gst_type` text DEFAULT 'regular',
	`gst_rate` real DEFAULT 18,
	`itc_pct` real DEFAULT 85,
	`gst_frequency` text DEFAULT 'monthly',
	`tds_regime` text DEFAULT 'new',
	`tds_sections` text DEFAULT '{}',
	`tax_rate` real DEFAULT 25.17,
	`pf_applicable` integer DEFAULT true,
	`esi_applicable` integer DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX `compliance_config_company_id_unique` ON `compliance_config` (`company_id`);--> statement-breakpoint
CREATE TABLE `forecast_results` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`scenario_id` text,
	`pl_data` text DEFAULT '{}' NOT NULL,
	`bs_data` text DEFAULT '{}' NOT NULL,
	`cf_data` text DEFAULT '{}' NOT NULL,
	`compliance` text DEFAULT '{}' NOT NULL,
	`metrics` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 1,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_forecast_company_scenario` ON `forecast_results` (`company_id`,`scenario_id`);--> statement-breakpoint
CREATE TABLE `micro_forecast_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`micro_forecast_id` text NOT NULL,
	`account_id` text,
	`future_account_name` text,
	`future_account_type` text,
	`rule_type` text DEFAULT 'direct_entry',
	`config` text DEFAULT '{}' NOT NULL,
	`timing_profile_id` text,
	FOREIGN KEY (`micro_forecast_id`) REFERENCES `micro_forecasts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `micro_forecasts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`is_active` integer DEFAULT true,
	`start_month` text NOT NULL,
	`end_month` text,
	`wizard_config` text DEFAULT '{}' NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `monthly_actuals` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`account_id` text NOT NULL,
	`period` text NOT NULL,
	`amount` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_actuals_unique` ON `monthly_actuals` (`company_id`,`account_id`,`period`);--> statement-breakpoint
CREATE INDEX `idx_actuals_company_period` ON `monthly_actuals` (`company_id`,`period`);--> statement-breakpoint
CREATE TABLE `quick_metrics_config` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`metric_1` text DEFAULT 'cash_on_hand',
	`metric_2` text DEFAULT 'net_income',
	`metric_3` text DEFAULT 'gross_margin_pct',
	`metric_4` text DEFAULT 'working_capital_gap',
	`metric_5` text DEFAULT '',
	`threshold` text DEFAULT '{}'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quick_metrics_config_company_id_unique` ON `quick_metrics_config` (`company_id`);--> statement-breakpoint
CREATE TABLE `scenario_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`config` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`description` text,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `timing_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`profile_type` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`auto_derived` integer DEFAULT false,
	`is_default` integer DEFAULT false,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `value_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`account_id` text NOT NULL,
	`scenario_id` text,
	`rule_type` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`sort_order` integer DEFAULT 0,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_value_rules_unique` ON `value_rules` (`company_id`,`account_id`,`scenario_id`);