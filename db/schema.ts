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
  idempotencyKey: text("idempotency_key").notNull(),
  visibility: text("visibility").notNull(),
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
