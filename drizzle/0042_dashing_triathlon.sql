CREATE TABLE `cost_governance_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`rate_card_id` text NOT NULL,
	`usage_entry_id` text,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cost_decision_idempotency` ON `cost_governance_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_cost_decision_history` ON `cost_governance_decisions` (`tenant_id`,`rate_card_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `cost_rate_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`source_type` text NOT NULL,
	`source_ref` text NOT NULL,
	`status` text NOT NULL,
	`effective_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cost_rate_card_status` ON `cost_rate_cards` (`tenant_id`,`status`,`effective_at`);--> statement-breakpoint
CREATE TABLE `cost_rate_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`rate_card_id` text NOT NULL,
	`category` text NOT NULL,
	`unit` text NOT NULL,
	`unit_rate_micros` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cost_rate_item_unique` ON `cost_rate_items` (`tenant_id`,`rate_card_id`,`category`,`unit`);--> statement-breakpoint
CREATE TABLE `usage_cost_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text,
	`workflow_id` text NOT NULL,
	`category` text NOT NULL,
	`unit` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_rate_micros` integer NOT NULL,
	`cost_micros` integer NOT NULL,
	`pricing_state` text NOT NULL,
	`rate_card_id` text NOT NULL,
	`provider_name` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`evidence` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`recorded_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_usage_cost_tenant_workflow` ON `usage_cost_entries` (`tenant_id`,`workflow_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_usage_cost_tenant_category` ON `usage_cost_entries` (`tenant_id`,`category`,`occurred_at`);