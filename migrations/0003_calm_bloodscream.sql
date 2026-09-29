CREATE TABLE `acharya_catalog` (
	`video_id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`position` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `acharya_catalog_order` ON `acharya_catalog` (`active`,`position`);--> statement-breakpoint
CREATE TABLE `acharya_staging` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`video_id` text NOT NULL,
	`verdict` text NOT NULL,
	`value` text,
	`source_position` integer NOT NULL,
	`seed_position` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `acharya_stage_run_video` ON `acharya_staging` (`run_id`,`video_id`);--> statement-breakpoint
CREATE INDEX `acharya_stage_run` ON `acharya_staging` (`run_id`);--> statement-breakpoint
CREATE TABLE `acharya_sync` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`lease_token` text DEFAULT '' NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `acharya_video_cache` (
	`video_id` text PRIMARY KEY NOT NULL,
	`listed_title` text NOT NULL,
	`listed_duration` integer,
	`value` text NOT NULL,
	`checked_at` text NOT NULL
);
