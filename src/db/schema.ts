import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  version: integer("version").notNull().default(1),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
};

export const matterStatus = pgEnum("matter_status", [
  "intake",
  "open",
  "stayed",
  "closed",
]);
export const verificationStatus = pgEnum("verification_status", [
  "candidate",
  "verified",
  "rejected",
  "superseded",
]);
export const documentStatus = pgEnum("document_status", [
  "received",
  "scanning",
  "processing",
  "ready",
  "failed",
  "quarantined",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  ...auditColumns,
}, (table) => [uniqueIndex("tenants_slug_unique").on(table.slug)]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...auditColumns,
}, (table) => [
  uniqueIndex("users_tenant_email_unique").on(table.tenantId, table.email),
  index("users_tenant_idx").on(table.tenantId),
]);

export const matters = pgTable("matters", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  matterNumber: text("matter_number").notNull(),
  caption: text("caption").notNull(),
  status: matterStatus("status").notNull().default("intake"),
  clientName: text("client_name").notNull(),
  employerName: text("employer_name").notNull(),
  assignedAttorneyId: uuid("assigned_attorney_id").references(() => users.id),
  ...auditColumns,
}, (table) => [
  uniqueIndex("matters_tenant_number_unique").on(table.tenantId, table.matterNumber),
  index("matters_tenant_status_idx").on(table.tenantId, table.status),
]);

export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  matterId: uuid("matter_id").notNull().references(() => matters.id),
  claimNumber: text("claim_number").notNull(),
  carrierName: text("carrier_name"),
  administratorName: text("administrator_name"),
  ...auditColumns,
}, (table) => [index("claims_tenant_matter_idx").on(table.tenantId, table.matterId)]);

export const injuries = pgTable("injuries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  matterId: uuid("matter_id").notNull().references(() => matters.id),
  claimId: uuid("claim_id").references(() => claims.id),
  injuryType: text("injury_type").notNull(),
  dateFrom: timestamp("date_from", { withTimezone: true }).notNull(),
  dateTo: timestamp("date_to", { withTimezone: true }),
  ...auditColumns,
}, (table) => [index("injuries_tenant_matter_idx").on(table.tenantId, table.matterId)]);

export const adjudicationCases = pgTable("adjudication_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  matterId: uuid("matter_id").notNull().references(() => matters.id),
  adjNumber: text("adj_number").notNull(),
  venue: text("venue"),
  ...auditColumns,
}, (table) => [
  uniqueIndex("adjudication_tenant_number_unique").on(table.tenantId, table.adjNumber),
]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  matterId: uuid("matter_id").notNull().references(() => matters.id),
  title: text("title").notNull(),
  classification: text("classification").notNull(),
  status: documentStatus("status").notNull().default("received"),
  originalObjectKey: text("original_object_key").notNull(),
  originalSha256: text("original_sha256").notNull(),
  mimeType: text("mime_type").notNull(),
  pageCount: integer("page_count"),
  ...auditColumns,
}, (table) => [index("documents_tenant_matter_idx").on(table.tenantId, table.matterId)]);

export const factObservations = pgTable("fact_observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  matterId: uuid("matter_id").notNull().references(() => matters.id),
  documentId: uuid("document_id").references(() => documents.id),
  factType: text("fact_type").notNull(),
  originalValue: text("original_value").notNull(),
  normalizedValue: jsonb("normalized_value").notNull(),
  sourcePage: integer("source_page"),
  sourceExcerpt: text("source_excerpt"),
  extractionMethod: text("extraction_method").notNull(),
  confidenceBasisPoints: integer("confidence_basis_points").notNull(),
  verificationStatus: verificationStatus("verification_status").notNull().default("candidate"),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  supersedesId: uuid("supersedes_id"),
  conflictGroupId: uuid("conflict_group_id"),
  ...auditColumns,
}, (table) => [
  index("facts_tenant_matter_status_idx").on(table.tenantId, table.matterId, table.verificationStatus),
]);

export const businessEvents = pgTable("business_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("event_type").notNull(),
  eventVersion: integer("event_version").notNull().default(1),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  matterId: uuid("matter_id").references(() => matters.id),
  actorId: uuid("actor_id").references(() => users.id),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  correlationId: uuid("correlation_id").notNull(),
  causationId: uuid("causation_id"),
  idempotencyKey: text("idempotency_key").notNull(),
  visibility: text("visibility").notNull().default("internal"),
  payload: jsonb("payload").notNull(),
}, (table) => [
  uniqueIndex("events_tenant_idempotency_unique").on(table.tenantId, table.idempotencyKey),
  index("events_tenant_matter_time_idx").on(table.tenantId, table.matterId, table.occurredAt),
]);

export const outboxMessages = pgTable("outbox_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  eventId: uuid("event_id").notNull().references(() => businessEvents.id),
  topic: text("topic").notNull(),
  payload: jsonb("payload").notNull(),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  ...auditColumns,
}, (table) => [index("outbox_ready_idx").on(table.processedAt, table.availableAt)]);
