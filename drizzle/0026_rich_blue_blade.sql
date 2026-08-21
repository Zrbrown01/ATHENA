CREATE TABLE `report_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`report_instance_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason` text,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_report_decision_idempotency` ON `report_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_report_decision_instance` ON `report_decisions` (`tenant_id`,`report_instance_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `report_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_name` text NOT NULL,
	`code` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`report_type` text NOT NULL,
	`required_sections` text NOT NULL,
	`cadence` text NOT NULL,
	`schedule_mode` text NOT NULL,
	`content_status` text NOT NULL,
	`effective_at` integer NOT NULL,
	`review_by` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_report_definition_version` ON `report_definitions` (`tenant_id`,`code`,`version`);--> statement-breakpoint
CREATE TABLE `report_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`report_instance_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`provider_mode` text NOT NULL,
	`provider_delivery_attempted` integer NOT NULL,
	`recipient_addresses` text NOT NULL,
	`reason` text NOT NULL,
	`provider_message_id` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_report_delivery_instance` ON `report_deliveries` (`tenant_id`,`report_instance_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `report_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`definition_id` text NOT NULL,
	`definition_code` text NOT NULL,
	`definition_version` integer NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`due_at` integer NOT NULL,
	`recipient_addresses` text NOT NULL,
	`source_coverage_count` integer NOT NULL,
	`unresolved_conflict_count` integer NOT NULL,
	`schedule_mode` text NOT NULL,
	`provider_mode` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_report_instance_matter_due` ON `report_instances` (`tenant_id`,`matter_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `report_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`report_instance_id` text NOT NULL,
	`section_code` text NOT NULL,
	`title` text NOT NULL,
	`position` integer NOT NULL,
	`body` text NOT NULL,
	`body_sha256` text NOT NULL,
	`source_record_ids` text NOT NULL,
	`provider_mode` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_report_section_code` ON `report_sections` (`tenant_id`,`report_instance_id`,`section_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_report_section_position` ON `report_sections` (`tenant_id`,`report_instance_id`,`position`);--> statement-breakpoint
CREATE TABLE `report_validations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`report_instance_id` text NOT NULL,
	`revision` integer NOT NULL,
	`outcome` text NOT NULL,
	`checks` text NOT NULL,
	`source_coverage_count` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_report_validation_instance` ON `report_validations` (`tenant_id`,`report_instance_id`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;
