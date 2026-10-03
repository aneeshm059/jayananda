CREATE TABLE `soulful_reading_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`content_version` text NOT NULL,
	`activated_at` text NOT NULL,
	FOREIGN KEY (`content_version`) REFERENCES `soulful_reading_sources`(`content_version`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `soulful_reading_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`content_version` text NOT NULL,
	`module_id` text NOT NULL,
	`kind` text NOT NULL,
	`number` integer,
	`label` text NOT NULL,
	`title` text NOT NULL,
	`start_page` integer NOT NULL,
	`end_page` integer NOT NULL,
	`block_count` integer NOT NULL,
	`part_count` integer NOT NULL,
	`content_hash` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`content_version`) REFERENCES `soulful_reading_sources`(`content_version`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `soulful_module_version_id` ON `soulful_reading_modules` (`content_version`,`module_id`);--> statement-breakpoint
CREATE INDEX `soulful_module_order` ON `soulful_reading_modules` (`content_version`,`position`);--> statement-breakpoint
CREATE TABLE `soulful_reading_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`module_key` text NOT NULL,
	`position` integer NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`module_key`) REFERENCES `soulful_reading_modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `soulful_part_module_order` ON `soulful_reading_parts` (`module_key`,`position`);--> statement-breakpoint
CREATE TABLE `soulful_reading_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`module_id` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`anchor` integer DEFAULT 0 NOT NULL,
	`content_version` text NOT NULL,
	`last_opened_at` text,
	`updated_at` text NOT NULL,
	`version` integer NOT NULL,
	`last_request_id` text NOT NULL,
	`last_request` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "soulful_progress_version_positive" CHECK("soulful_reading_progress"."version" > 0),
	CONSTRAINT "soulful_progress_anchor_nonnegative" CHECK("soulful_reading_progress"."anchor" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `soulful_progress_user_module` ON `soulful_reading_progress` (`user_id`,`module_id`);--> statement-breakpoint
CREATE TABLE `soulful_reading_sources` (
	`content_version` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`entry_count` integer NOT NULL,
	`imported_at` text NOT NULL
);
