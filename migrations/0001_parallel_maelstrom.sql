CREATE TABLE `habit_checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "habit_completed_boolean" CHECK("habit_checkins"."completed" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_checkin_day` ON `habit_checkins` (`habit_id`,`date`);--> statement-breakpoint
CREATE INDEX `habit_checkin_user_date` ON `habit_checkins` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`intention` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`starter_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "habit_dates_order" CHECK("habits"."end_date" >= "habits"."start_date")
);
--> statement-breakpoint
CREATE INDEX `habits_user_dates` ON `habits` (`user_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `habits_user_starter` ON `habits` (`user_id`,`starter_key`);