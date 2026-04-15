CREATE TABLE `reminder_config` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`enabled` integer DEFAULT false,
	`alert_email` text,
	`reminder_days` integer DEFAULT 3,
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_config_company_id_unique` ON `reminder_config` (`company_id`);