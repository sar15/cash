CREATE TABLE IF NOT EXISTS `user_profiles` (
  `clerk_user_id` text PRIMARY KEY NOT NULL,
  `user_type` text DEFAULT 'business_owner' NOT NULL,
  `onboarding_completed` integer DEFAULT 0,
  `created_at` text DEFAULT (datetime('now')),
  `updated_at` text DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `idx_user_profiles_type` ON `user_profiles` (`user_type`);
