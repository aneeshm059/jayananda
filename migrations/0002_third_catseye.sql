CREATE TABLE `companion_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "companion_version_positive" CHECK("companion_entries"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companion_user_key` ON `companion_entries` (`user_id`,`key`);