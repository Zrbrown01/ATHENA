CREATE TABLE `breach_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`incident_id` text NOT NULL,
	`conclusion` text NOT NULL,
	`contractual_deadlines` text NOT NULL,
	`legal_analysis` text NOT NULL,
	`notification_decision` text NOT NULL,
	`reviewed_by` text NOT NULL,
	`privilege_restricted` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_breach_assessment_incident` ON `breach_assessments` (`tenant_id`,`incident_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `control_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`control_id` text NOT NULL,
	`evidence_type` text NOT NULL,
	`title` text NOT NULL,
	`evidence_ref` text NOT NULL,
	`sha256` text NOT NULL,
	`outcome` text NOT NULL,
	`valid_from` integer NOT NULL,
	`valid_until` integer NOT NULL,
	`verified_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_control_evidence_control` ON `control_evidence` (`tenant_id`,`control_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `incident_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`incident_id` text NOT NULL,
	`action_type` text NOT NULL,
	`summary` text NOT NULL,
	`systems` text NOT NULL,
	`external_operation` integer NOT NULL,
	`provider_mode` text NOT NULL,
	`evidence_ref` text NOT NULL,
	`performed_by` text NOT NULL,
	`performed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_incident_action_timeline` ON `incident_actions` (`tenant_id`,`incident_id`,`performed_at`);--> statement-breakpoint
CREATE TABLE `risk_treatments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`risk_id` text NOT NULL,
	`strategy` text NOT NULL,
	`action_plan` text NOT NULL,
	`control_ids` text NOT NULL,
	`owner_id` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text NOT NULL,
	`approval_evidence` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_risk_treatment_risk` ON `risk_treatments` (`tenant_id`,`risk_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `security_controls` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`control_family` text NOT NULL,
	`owner_id` text NOT NULL,
	`status` text NOT NULL,
	`description` text NOT NULL,
	`review_cadence_days` integer NOT NULL,
	`next_review_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_security_control_code` ON `security_controls` (`tenant_id`,`code`);--> statement-breakpoint
CREATE TABLE `security_incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`detected_at` integer NOT NULL,
	`detection_source` text NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`systems` text NOT NULL,
	`affected_tenant_ids` text NOT NULL,
	`affected_matter_ids` text NOT NULL,
	`information_categories` text NOT NULL,
	`suspected_access` integer NOT NULL,
	`confirmed_access` integer NOT NULL,
	`evidence_preservation_ref` text,
	`provider_mode` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`incident_lead` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`closed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_security_incident_status` ON `security_incidents` (`tenant_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `security_operations_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_security_ops_decision_idempotency` ON `security_operations_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_security_ops_decision_aggregate` ON `security_operations_decisions` (`tenant_id`,`aggregate_type`,`aggregate_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `security_risks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`likelihood` integer NOT NULL,
	`impact` integer NOT NULL,
	`inherent_score` integer NOT NULL,
	`residual_score` integer NOT NULL,
	`status` text NOT NULL,
	`owner_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_security_risk_status` ON `security_risks` (`tenant_id`,`status`,`residual_score`);
--> statement-breakpoint
PRAGMA optimize;
