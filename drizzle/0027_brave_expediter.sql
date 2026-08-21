CREATE TABLE `accrual_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`budget_id` text NOT NULL,
	`period` text NOT NULL,
	`fees_cents` integer NOT NULL,
	`expenses_cents` integer NOT NULL,
	`total_accrued_cents` integer NOT NULL,
	`budget_variance_cents` integer NOT NULL,
	`source_record_ids` text NOT NULL,
	`recorded_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_accrual_budget_period` ON `accrual_snapshots` (`tenant_id`,`budget_id`,`period`);--> statement-breakpoint
CREATE TABLE `budget_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`budget_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_budget_decision_idempotency` ON `budget_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_budget_decision_budget` ON `budget_decisions` (`tenant_id`,`budget_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `budget_phases` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`budget_id` text NOT NULL,
	`phase_code` text NOT NULL,
	`title` text NOT NULL,
	`position` integer NOT NULL,
	`budget_cents` integer NOT NULL,
	`incurred_cents` integer DEFAULT 0 NOT NULL,
	`remaining_cents` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_budget_phase_code` ON `budget_phases` (`tenant_id`,`budget_id`,`phase_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_budget_phase_position` ON `budget_phases` (`tenant_id`,`budget_id`,`position`);--> statement-breakpoint
CREATE TABLE `matter_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`title` text NOT NULL,
	`currency` text NOT NULL,
	`total_budget_cents` integer NOT NULL,
	`status` text NOT NULL,
	`content_status` text NOT NULL,
	`effective_date` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_matter_budget_matter` ON `matter_budgets` (`tenant_id`,`matter_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `profitability_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`budget_id` text NOT NULL,
	`as_of_date` integer NOT NULL,
	`billed_cents` integer NOT NULL,
	`collected_cents` integer NOT NULL,
	`worked_value_cents` integer NOT NULL,
	`direct_cost_cents` integer NOT NULL,
	`realization_basis_points` integer NOT NULL,
	`contribution_cents` integer NOT NULL,
	`projection_mode` text NOT NULL,
	`source_record_ids` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_profitability_budget_date` ON `profitability_snapshots` (`tenant_id`,`budget_id`,`as_of_date`);
--> statement-breakpoint
PRAGMA optimize;
