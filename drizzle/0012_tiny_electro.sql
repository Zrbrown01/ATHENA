CREATE TABLE `adjudication_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`adj_number` text NOT NULL,
	`venue` text,
	`district_office` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_adjudication_tenant_number` ON `adjudication_cases` (`tenant_id`,`adj_number`);--> statement-breakpoint
CREATE INDEX `idx_adjudication_tenant_matter` ON `adjudication_cases` (`tenant_id`,`matter_id`);--> statement-breakpoint
CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`claim_number` text NOT NULL,
	`carrier_name` text,
	`administrator_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_claims_tenant_number` ON `claims` (`tenant_id`,`claim_number`);--> statement-breakpoint
CREATE INDEX `idx_claims_tenant_matter` ON `claims` (`tenant_id`,`matter_id`);--> statement-breakpoint
CREATE TABLE `injuries` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`claim_id` text,
	`injury_type` text NOT NULL,
	`date_from` integer NOT NULL,
	`date_to` integer,
	`body_parts` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_injuries_tenant_matter` ON `injuries` (`tenant_id`,`matter_id`);--> statement-breakpoint
CREATE TABLE `matter_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`from_entity_type` text NOT NULL,
	`from_entity_id` text NOT NULL,
	`relationship_type` text NOT NULL,
	`to_entity_type` text NOT NULL,
	`to_entity_id` text NOT NULL,
	`source_link_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_matter_relationship_identity` ON `matter_relationships` (`tenant_id`,`from_entity_type`,`from_entity_id`,`relationship_type`,`to_entity_type`,`to_entity_id`);--> statement-breakpoint
CREATE INDEX `idx_matter_relationship_matter` ON `matter_relationships` (`tenant_id`,`matter_id`);--> statement-breakpoint
CREATE TABLE `matters` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_number` text NOT NULL,
	`caption` text NOT NULL,
	`status` text NOT NULL,
	`client_name` text NOT NULL,
	`employer_name` text NOT NULL,
	`applicant_name` text NOT NULL,
	`assigned_attorney_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_matters_tenant_number` ON `matters` (`tenant_id`,`matter_number`);--> statement-breakpoint
CREATE INDEX `idx_matters_tenant_status` ON `matters` (`tenant_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `source_record_links` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`source_system` text NOT NULL,
	`source_record_id` text NOT NULL,
	`provider_mode` text NOT NULL,
	`imported_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_source_record_identity` ON `source_record_links` (`tenant_id`,`source_system`,`source_record_id`);--> statement-breakpoint
CREATE INDEX `idx_source_record_entity` ON `source_record_links` (`tenant_id`,`entity_type`,`entity_id`);--> statement-breakpoint
PRAGMA optimize;
