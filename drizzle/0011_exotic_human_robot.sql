CREATE TABLE `retention_disposition_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`policy_code` text NOT NULL,
	`policy_version` integer NOT NULL,
	`evaluation_outcome` text NOT NULL,
	`evaluation_reason` text NOT NULL,
	`active_legal_hold` integer NOT NULL,
	`conclusion` text NOT NULL,
	`notes` text NOT NULL,
	`reviewed_by` text NOT NULL,
	`reviewed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_retention_review_matter` ON `retention_disposition_reviews` (`tenant_id`,`matter_id`,`reviewed_at`);--> statement-breakpoint
ALTER TABLE `legal_holds` ADD `release_reason` text;--> statement-breakpoint
ALTER TABLE `legal_holds` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_legal_hold_identity` ON `legal_holds` (`tenant_id`,`matter_id`,`name`);--> statement-breakpoint
PRAGMA optimize;
