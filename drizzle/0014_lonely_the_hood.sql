CREATE TABLE `matter_parties` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`party_type` text NOT NULL,
	`party_id` text NOT NULL,
	`role` text NOT NULL,
	`claim_id` text,
	`injury_id` text,
	`adjudication_case_id` text,
	`status` text NOT NULL,
	`source_link_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_matter_party_identity` ON `matter_parties` (`tenant_id`,`matter_id`,`party_type`,`party_id`,`role`);--> statement-breakpoint
CREATE INDEX `idx_matter_party_role` ON `matter_parties` (`tenant_id`,`matter_id`,`role`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`organization_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_organization_normalized_name` ON `organizations` (`tenant_id`,`normalized_name`);--> statement-breakpoint
CREATE TABLE `party_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`party_type` text NOT NULL,
	`party_id` text NOT NULL,
	`alias` text NOT NULL,
	`normalized_alias` text NOT NULL,
	`alias_type` text NOT NULL,
	`source_link_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_party_alias_identity` ON `party_aliases` (`tenant_id`,`party_type`,`party_id`,`normalized_alias`);--> statement-breakpoint
CREATE INDEX `idx_party_alias_lookup` ON `party_aliases` (`tenant_id`,`normalized_alias`);--> statement-breakpoint
CREATE TABLE `persons` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`given_name` text NOT NULL,
	`family_name` text NOT NULL,
	`display_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_person_normalized_name` ON `persons` (`tenant_id`,`normalized_name`);--> statement-breakpoint
PRAGMA optimize;
