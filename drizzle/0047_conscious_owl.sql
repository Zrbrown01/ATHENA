CREATE TABLE `governance_policy_layers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`code` text NOT NULL,
	`version` integer NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`business_days` integer NOT NULL,
	`day_kind` text DEFAULT 'business' NOT NULL,
	`roll_convention` text DEFAULT 'next_business_day' NOT NULL,
	`authority_citation` text NOT NULL,
	`effective_at` integer NOT NULL,
	`review_by` integer NOT NULL,
	`content_status` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`supersedes_layer_id` text,
	`reason` text NOT NULL,
	`created_by` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_governance_policy_layer_version` ON `governance_policy_layers` (`tenant_id`,`code`,`scope_type`,`scope_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_governance_policy_layer_resolution` ON `governance_policy_layers` (`tenant_id`,`code`,`status`,`scope_type`,`scope_id`);--> statement-breakpoint
CREATE TABLE `governance_policy_simulations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`code` text NOT NULL,
	`trigger_at` integer NOT NULL,
	`as_of` integer NOT NULL,
	`client_id` text NOT NULL,
	`matter_type` text NOT NULL,
	`selected_layer_id` text NOT NULL,
	`selected_scope_type` text NOT NULL,
	`selected_version` integer NOT NULL,
	`due_at` integer NOT NULL,
	`applicable_layer_ids` text NOT NULL,
	`selected_layer_snapshot` text NOT NULL,
	`calculation` text NOT NULL,
	`created_by` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_governance_policy_simulation_matter` ON `governance_policy_simulations` (`tenant_id`,`matter_id`,`created_at`);
PRAGMA optimize;
