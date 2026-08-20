import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const factReviews = sqliteTable("fact_reviews", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  factId: text("fact_id").notNull(),
  decision: text("decision", { enum: ["verified", "rejected"] }).notNull(),
  editedValue: text("edited_value"),
  reason: text("reason"),
  actorId: text("actor_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  eventId: text("event_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_fact_reviews_tenant_idempotency").on(table.tenantId, table.idempotencyKey),
  index("idx_fact_reviews_tenant_matter").on(table.tenantId, table.matterId, table.createdAt),
]);

export const previewEvents = sqliteTable("preview_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  eventVersion: integer("event_version").notNull(),
  tenantId: text("tenant_id").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  matterId: text("matter_id"),
  actorId: text("actor_id").notNull(),
  occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
  correlationId: text("correlation_id").notNull(),
  causationId: text("causation_id"),
  idempotencyKey: text("idempotency_key").notNull(),
  source: text("source").notNull().default("athena.web"),
  visibility: text("visibility").notNull(),
  retentionPolicy: text("retention_policy").notNull().default("firm-default"),
  payload: text("payload", { mode: "json" }).notNull(),
}, (table) => [
  uniqueIndex("idx_preview_events_tenant_idempotency").on(table.tenantId, table.idempotencyKey),
  index("idx_preview_events_tenant_matter").on(table.tenantId, table.matterId, table.occurredAt),
]);

export const previewOutbox = sqliteTable("preview_outbox", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  eventId: text("event_id").notNull(),
  topic: text("topic").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  availableAt: integer("available_at", { mode: "timestamp_ms" }).notNull(),
  processedAt: integer("processed_at", { mode: "timestamp_ms" }),
  failedAt: integer("failed_at", { mode: "timestamp_ms" }),
}, (table) => [index("idx_preview_outbox_ready").on(table.processedAt, table.availableAt)]);

export const documentIntakes = sqliteTable("document_intakes", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id"),
  title: text("title").notNull(),
  objectKey: text("object_key").notNull(),
  sha256: text("sha256").notNull(),
  byteSize: integer("byte_size").notNull(),
  mimeType: text("mime_type").notNull(),
  classification: text("classification").notNull(),
  status: text("status", { enum: ["awaiting_scan", "quarantined", "ready", "failed"] }).notNull(),
  actorId: text("actor_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_document_intakes_object_key").on(table.objectKey),
  index("idx_document_intakes_tenant_matter").on(table.tenantId, table.matterId, table.createdAt),
  index("idx_document_intakes_tenant_sha").on(table.tenantId, table.sha256),
]);

export const workflowDecisions = sqliteTable("workflow_decisions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  workflowType: text("workflow_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  action: text("action").notNull(),
  reason: text("reason"),
  actorId: text("actor_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  eventId: text("event_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_workflow_decisions_tenant_idempotency").on(table.tenantId, table.idempotencyKey),
  index("idx_workflow_decisions_tenant_aggregate").on(table.tenantId, table.workflowType, table.aggregateId, table.createdAt),
]);

export const companionRuns = sqliteTable("companion_runs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  stage: text("stage", { enum: ["matter_imported", "analysis_ready", "draft_ready", "report_approved", "delivery_handoff_blocked", "time_confirmed", "export_ready"] }).notNull(),
  version: integer("version").notNull().default(1),
  sourceSystem: text("source_system").notNull().default("meruscase_deterministic_sandbox"),
  providerMode: text("provider_mode").notNull().default("deterministic_sandbox"),
  documentTitle: text("document_title"),
  reportTitle: text("report_title"),
  deliveryStatus: text("delivery_status"),
  candidateTimeMinutes: integer("candidate_time_minutes"),
  billingStatus: text("billing_status"),
  exportJobId: text("export_job_id"),
  lastEventId: text("last_event_id").notNull(),
  actorId: text("actor_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_companion_runs_tenant_matter").on(table.tenantId, table.matterId),
  index("idx_companion_runs_tenant_stage").on(table.tenantId, table.stage, table.updatedAt),
]);

export const workProductDrafts = sqliteTable("work_product_drafts", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  runId: text("run_id").notNull(),
  workProductType: text("work_product_type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sourceDocumentId: text("source_document_id").notNull(),
  sourceFactIds: text("source_fact_ids", { mode: "json" }).$type<string[]>().notNull(),
  status: text("status", { enum: ["draft", "approved"] }).notNull(),
  providerMode: text("provider_mode").notNull(),
  approvedBy: text("approved_by"),
  approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_work_product_tenant_run").on(table.tenantId, table.runId, table.createdAt)]);

export const integrationHandoffs = sqliteTable("integration_handoffs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  runId: text("run_id").notNull(),
  provider: text("provider").notNull(),
  operation: text("operation").notNull(),
  status: text("status").notNull(),
  providerMode: text("provider_mode").notNull(),
  retryable: integer("retryable", { mode: "boolean" }).notNull(),
  activationRequirement: text("activation_requirement").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_handoffs_tenant_run").on(table.tenantId, table.runId, table.createdAt)]);

export const candidateTimeEntries = sqliteTable("candidate_time_entries", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  runId: text("run_id").notNull(),
  minutes: integer("minutes").notNull(),
  narrative: text("narrative").notNull(),
  taskCode: text("task_code").notNull(),
  activityCode: text("activity_code").notNull(),
  status: text("status", { enum: ["candidate", "confirmed"] }).notNull(),
  confirmedBy: text("confirmed_by").notNull(),
  confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_candidate_time_tenant_run").on(table.tenantId, table.runId, table.confirmedAt)]);

export const billingValidations = sqliteTable("billing_validations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  runId: text("run_id").notNull(),
  candidateTimeId: text("candidate_time_id").notNull(),
  ruleCode: text("rule_code").notNull(),
  ruleVersion: text("rule_version").notNull(),
  outcome: text("outcome", { enum: ["pass", "warning", "hard_stop"] }).notNull(),
  explanation: text("explanation").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_billing_validations_tenant_run").on(table.tenantId, table.runId, table.createdAt)]);

export const exportJobs = sqliteTable("export_jobs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  runId: text("run_id").notNull(),
  status: text("status", { enum: ["ready", "failed"] }).notNull(),
  objectKey: text("object_key").notNull(),
  sha256: text("sha256").notNull(),
  byteSize: integer("byte_size").notNull(),
  format: text("format").notNull(),
  manifestVersion: integer("manifest_version").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_export_jobs_object_key").on(table.objectKey),
  index("idx_export_jobs_tenant_matter").on(table.tenantId, table.matterId, table.createdAt),
]);

export const auditRecords = sqliteTable("audit_records", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  actorId: text("actor_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  outcome: text("outcome").notNull(),
  reason: text("reason").notNull(),
  requestId: text("request_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_audit_tenant_request").on(table.tenantId, table.requestId),
  index("idx_audit_tenant_resource").on(table.tenantId, table.resourceType, table.resourceId, table.createdAt),
]);
