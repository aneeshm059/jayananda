CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `app_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`theme` text DEFAULT 'light' NOT NULL,
	`hero` text DEFAULT 'auto' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `association_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`person` text NOT NULL,
	`type` text NOT NULL,
	`duration_minutes` real NOT NULL,
	`learned` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `association_user_date` ON `association_entries` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `daily_sadhana` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`mode` text DEFAULT 'ideal' NOT NULL,
	`closed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_user_date` ON `daily_sadhana` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`title` text NOT NULL,
	`target_date` text,
	`completed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goals_user_date` ON `goals` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `hearing_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`speaker` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`duration_minutes` real NOT NULL,
	`url` text,
	`instruction` text,
	`is_prabhupada` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "hearing_duration_valid" CHECK("hearing_sessions"."duration_minutes" >= 0)
);
--> statement-breakpoint
CREATE INDEX `hearing_user_date` ON `hearing_sessions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `hearing_user_type` ON `hearing_sessions` (`user_id`,`type`);--> statement-breakpoint
CREATE TABLE `japa_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`rounds` integer NOT NULL,
	`duration_minutes` real DEFAULT 0 NOT NULL,
	`start_time` text,
	`end_time` text,
	`location` text,
	`attention` integer,
	`interruptions` integer DEFAULT 0,
	`prayerful_mood` integer,
	`distractions` text,
	`helped` text,
	`improve` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "japa_rounds_valid" CHECK("japa_sessions"."rounds" >= 0),
	CONSTRAINT "japa_attention_valid" CHECK("japa_sessions"."attention" BETWEEN 1 AND 5),
	CONSTRAINT "japa_duration_valid" CHECK("japa_sessions"."duration_minutes" >= 0)
);
--> statement-breakpoint
CREATE INDEX `japa_user_date` ON `japa_sessions` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `jayananda_qualities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`source` text,
	`verified` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jayananda_qualities_name_unique` ON `jayananda_qualities` (`name`);--> statement-breakpoint
CREATE TABLE `krishna_book_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`duration_minutes` real NOT NULL,
	`chapter_number` integer,
	`chapter_title` text,
	`start_page` integer,
	`end_page` integer,
	`pages_read` integer DEFAULT 0 NOT NULL,
	`chapter_completed` integer DEFAULT false NOT NULL,
	`reflection` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "krishna_pages_order" CHECK("krishna_book_sessions"."end_page" >= "krishna_book_sessions"."start_page"),
	CONSTRAINT "krishna_duration_valid" CHECK("krishna_book_sessions"."duration_minutes" >= 0)
);
--> statement-breakpoint
CREATE INDEX `krishna_user_date` ON `krishna_book_sessions` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `monthly_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`realization` text,
	`obstacle` text,
	`strengthened` text,
	`weakened` text,
	`quality` text,
	`prayer` text,
	`sankalpa` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_user_date` ON `monthly_reviews` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `prabhupada_reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`instruction` text,
	`reflection` text,
	`prayer` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prabhupada_user_date` ON `prabhupada_reflections` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `personal_purpose` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purpose_user` ON `personal_purpose` (`user_id`);--> statement-breakpoint
CREATE TABLE `quality_reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`quality` text NOT NULL,
	`reflection` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quality_user_date` ON `quality_reflections` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_key_unique` ON `rate_limits` (`key`);--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`book` text NOT NULL,
	`chapter` text,
	`section` text,
	`pages` integer DEFAULT 0 NOT NULL,
	`duration_minutes` real NOT NULL,
	`verse_range` text,
	`reflection` text,
	`is_prabhupada` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reading_duration_valid" CHECK("reading_sessions"."duration_minutes" >= 0),
	CONSTRAINT "reading_pages_valid" CHECK("reading_sessions"."pages" >= 0)
);
--> statement-breakpoint
CREATE INDEX `reading_user_date` ON `reading_sessions` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `night_reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`best` text,
	`careless` text,
	`distraction` text,
	`avoid` text,
	`grateful` text,
	`prayer` text,
	`remembrance` text DEFAULT 'Sometimes' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reflection_user_date` ON `night_reflections` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`message` text NOT NULL,
	`time` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminders_user_date` ON `reminders` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `daily_sankalpas` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sankalpa_user_date` ON `daily_sankalpas` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `seva_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`service` text NOT NULL,
	`category` text NOT NULL,
	`duration_minutes` real DEFAULT 0,
	`attitude` text NOT NULL,
	`appreciation` text,
	`reflection` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `seva_user_date` ON `seva_entries` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verifications` (`identifier`);--> statement-breakpoint
CREATE TABLE `wake_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`actual_time` text,
	`sleep_time` text,
	`bath_completed` integer DEFAULT false,
	`program_completed` integer DEFAULT false,
	`practices` text DEFAULT '' NOT NULL,
	`phone_discipline` text DEFAULT 'Yes',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wake_user_date` ON `wake_records` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `weekly_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`helped` text,
	`weakened` text,
	`distractions` text,
	`improvement` text,
	`quality` text,
	`sankalpa` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_user_date` ON `weekly_reviews` (`user_id`,`date`);