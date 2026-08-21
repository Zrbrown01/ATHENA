import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

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
  status: text("status", { enum: ["pending", "leased", "processed", "dead_letter"] }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: integer("available_at", { mode: "timestamp_ms" }).notNull(),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
  lastError: text("last_error"),
  processedAt: integer("processed_at", { mode: "timestamp_ms" }),
  failedAt: integer("failed_at", { mode: "timestamp_ms" }),
}, (table) => [
  uniqueIndex("idx_preview_outbox_tenant_event_topic").on(table.tenantId, table.eventId, table.topic),
  index("idx_preview_outbox_ready").on(table.tenantId, table.status, table.availableAt),
  index("idx_preview_outbox_lease").on(table.status, table.leaseExpiresAt),
]);

export const outboxDeliveries = sqliteTable("outbox_deliveries", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  outboxId: text("outbox_id").notNull(),
  eventId: text("event_id").notNull(),
  destination: text("destination").notNull(),
  outcome: text("outcome", { enum: ["delivered", "failed", "dead_lettered"] }).notNull(),
  attempt: integer("attempt").notNull(),
  detail: text("detail").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_outbox_delivery_outbox_attempt").on(table.outboxId, table.attempt),
  index("idx_outbox_delivery_tenant_event").on(table.tenantId, table.eventId, table.createdAt),
]);

export const accessDecisionEvents = sqliteTable("access_decision_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  actorId: text("actor_id").notNull(),
  matterId: text("matter_id").notNull(),
  plane: text("plane").notNull(),
  outcome: text("outcome", { enum: ["allowed", "denied"] }).notNull(),
  reasonCode: text("reason_code").notNull(),
  requestId: text("request_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_access_decision_request").on(table.tenantId, table.requestId),
  index("idx_access_decision_matter").on(table.tenantId, table.matterId, table.createdAt),
  index("idx_access_decision_actor").on(table.tenantId, table.actorId, table.createdAt),
]);

export const rateLimitWindows = sqliteTable("rate_limit_windows", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  windowStartedAt: integer("window_started_at", { mode: "timestamp_ms" }).notNull(),
  count: integer("count").notNull().default(1),
  limit: integer("limit").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_rate_limit_expiry").on(table.tenantId, table.expiresAt),
  index("idx_rate_limit_actor").on(table.tenantId, table.actorId, table.windowStartedAt),
]);

export const supportAccessGrants = sqliteTable("support_access_grants", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  supportUserId: text("support_user_id").notNull(),
  purpose: text("purpose").notNull(),
  ticketReference: text("ticket_reference").notNull(),
  status: text("status", { enum: ["active", "revoked"] }).notNull(),
  approvedBy: text("approved_by").notNull(),
  approvedAt: integer("approved_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  revokedBy: text("revoked_by"),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  revocationReason: text("revocation_reason"),
  revision: integer("revision").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_support_grant_scope").on(table.tenantId, table.matterId, table.supportUserId),
  index("idx_support_grant_active").on(table.tenantId, table.status, table.expiresAt),
]);

export const outboxConsumerCheckpoints = sqliteTable("outbox_consumer_checkpoints", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  consumer: text("consumer").notNull(),
  eventId: text("event_id").notNull(),
  outboxId: text("outbox_id").notNull(),
  payloadHash: text("payload_hash").notNull(),
  processedAt: integer("processed_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_consumer_event_once").on(table.tenantId, table.consumer, table.eventId),
  index("idx_consumer_checkpoint_outbox").on(table.tenantId, table.outboxId),
]);

export const outboxReconciliationRuns = sqliteTable("outbox_reconciliation_runs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  consumer: text("consumer").notNull(),
  trigger: text("trigger").notNull(),
  processedMessages: integer("processed_messages").notNull(),
  checkpoints: integer("checkpoints").notNull(),
  deliveryReceipts: integer("delivery_receipts").notNull(),
  exceptions: integer("exceptions").notNull(),
  outcome: text("outcome", { enum: ["matched", "exceptions"] }).notNull(),
  detail: text("detail").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_reconciliation_tenant_time").on(table.tenantId, table.finishedAt)]);

export const accessReviewAttestations = sqliteTable("access_review_attestations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  periodStartedAt: integer("period_started_at", { mode: "timestamp_ms" }).notNull(),
  periodEndedAt: integer("period_ended_at", { mode: "timestamp_ms" }).notNull(),
  outcome: text("outcome", { enum: ["certified", "exceptions_noted"] }).notNull(),
  notes: text("notes").notNull(),
  snapshot: text("snapshot", { mode: "json" }).$type<Record<string, number>>().notNull(),
  reviewerId: text("reviewer_id").notNull(),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_access_review_period").on(table.tenantId, table.periodEndedAt)]);

export const retentionPolicies = sqliteTable("retention_policies", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  code: text("code").notNull(),
  version: integer("version").notNull(),
  retainDays: integer("retain_days").notNull(),
  disposition: text("disposition", { enum: ["review_required", "retain"] }).notNull(),
  effectiveAt: integer("effective_at", { mode: "timestamp_ms" }).notNull(),
  supersededAt: integer("superseded_at", { mode: "timestamp_ms" }),
}, (table) => [
  uniqueIndex("idx_retention_policy_version").on(table.tenantId, table.code, table.version),
  index("idx_retention_policy_effective").on(table.tenantId, table.effectiveAt),
]);

export const legalHolds = sqliteTable("legal_holds", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  name: text("name").notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["active", "released"] }).notNull(),
  placedBy: text("placed_by").notNull(),
  placedAt: integer("placed_at", { mode: "timestamp_ms" }).notNull(),
  releasedBy: text("released_by"),
  releasedAt: integer("released_at", { mode: "timestamp_ms" }),
  releaseReason: text("release_reason"),
  revision: integer("revision").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_legal_hold_identity").on(table.tenantId, table.matterId, table.name),
  index("idx_legal_holds_tenant_matter").on(table.tenantId, table.matterId, table.status),
]);

export const retentionDispositionReviews = sqliteTable("retention_disposition_reviews", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  policyCode: text("policy_code").notNull(),
  policyVersion: integer("policy_version").notNull(),
  evaluationOutcome: text("evaluation_outcome", { enum: ["retain", "held", "eligible_for_review"] }).notNull(),
  evaluationReason: text("evaluation_reason").notNull(),
  activeLegalHold: integer("active_legal_hold", { mode: "boolean" }).notNull(),
  conclusion: text("conclusion", { enum: ["continue_retention", "escalate_for_disposition_review"] }).notNull(),
  notes: text("notes").notNull(),
  reviewedBy: text("reviewed_by").notNull(),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_retention_review_matter").on(table.tenantId, table.matterId, table.reviewedAt)]);

export const matters = sqliteTable("matters", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterNumber: text("matter_number").notNull(),
  caption: text("caption").notNull(),
  status: text("status", { enum: ["intake", "open", "stayed", "closed"] }).notNull(),
  clientName: text("client_name").notNull(),
  employerName: text("employer_name").notNull(),
  applicantName: text("applicant_name").notNull(),
  assignedAttorneyId: text("assigned_attorney_id"),
  revision: integer("revision").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_matters_tenant_number").on(table.tenantId, table.matterNumber),
  index("idx_matters_tenant_status").on(table.tenantId, table.status, table.updatedAt),
]);

export const claims = sqliteTable("claims", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  claimNumber: text("claim_number").notNull(),
  carrierName: text("carrier_name"),
  administratorName: text("administrator_name"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_claims_tenant_number").on(table.tenantId, table.claimNumber),
  index("idx_claims_tenant_matter").on(table.tenantId, table.matterId),
]);

export const injuries = sqliteTable("injuries", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  claimId: text("claim_id"),
  injuryType: text("injury_type", { enum: ["specific", "cumulative", "occupational_disease", "other"] }).notNull(),
  dateFrom: integer("date_from", { mode: "timestamp_ms" }).notNull(),
  dateTo: integer("date_to", { mode: "timestamp_ms" }),
  bodyParts: text("body_parts", { mode: "json" }).$type<string[]>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_injuries_tenant_matter").on(table.tenantId, table.matterId)]);

export const adjudicationCases = sqliteTable("adjudication_cases", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  adjNumber: text("adj_number").notNull(),
  venue: text("venue"),
  districtOffice: text("district_office"),
  status: text("status", { enum: ["unfiled", "active", "stayed", "closed"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_adjudication_tenant_number").on(table.tenantId, table.adjNumber),
  index("idx_adjudication_tenant_matter").on(table.tenantId, table.matterId),
]);

export const sourceRecordLinks = sqliteTable("source_record_links", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  entityType: text("entity_type", { enum: ["matter", "claim", "injury", "adjudication_case", "person", "organization", "matter_party"] }).notNull(),
  entityId: text("entity_id").notNull(),
  sourceSystem: text("source_system").notNull(),
  sourceRecordId: text("source_record_id").notNull(),
  providerMode: text("provider_mode").notNull(),
  importedAt: integer("imported_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_source_record_identity").on(table.tenantId, table.sourceSystem, table.sourceRecordId),
  index("idx_source_record_entity").on(table.tenantId, table.entityType, table.entityId),
]);

export const matterRelationships = sqliteTable("matter_relationships", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  fromEntityType: text("from_entity_type").notNull(),
  fromEntityId: text("from_entity_id").notNull(),
  relationshipType: text("relationship_type").notNull(),
  toEntityType: text("to_entity_type").notNull(),
  toEntityId: text("to_entity_id").notNull(),
  sourceLinkId: text("source_link_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_matter_relationship_identity").on(table.tenantId, table.fromEntityType, table.fromEntityId, table.relationshipType, table.toEntityType, table.toEntityId),
  index("idx_matter_relationship_matter").on(table.tenantId, table.matterId),
]);

export const intakeCandidates = sqliteTable("intake_candidates", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  proposedMatterId: text("proposed_matter_id").notNull(),
  sourceType: text("source_type").notNull(),
  sourceRecordId: text("source_record_id").notNull(),
  providerMode: text("provider_mode").notNull(),
  caption: text("caption").notNull(),
  clientName: text("client_name").notNull(),
  employerName: text("employer_name").notNull(),
  applicantName: text("applicant_name").notNull(),
  claimNumber: text("claim_number"),
  adjNumber: text("adj_number"),
  injuryDate: integer("injury_date", { mode: "timestamp_ms" }),
  missingFields: text("missing_fields", { mode: "json" }).$type<string[]>().notNull(),
  status: text("status", { enum: ["conflict_review", "missing_information", "ready_to_open", "opened", "rejected"] }).notNull(),
  revision: integer("revision").notNull().default(1),
  openedBy: text("opened_by"),
  openedAt: integer("opened_at", { mode: "timestamp_ms" }),
  rejectedBy: text("rejected_by"),
  rejectedAt: integer("rejected_at", { mode: "timestamp_ms" }),
  rejectionReason: text("rejection_reason"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_intake_source_identity").on(table.tenantId, table.sourceType, table.sourceRecordId),
  index("idx_intake_tenant_status").on(table.tenantId, table.status, table.updatedAt),
]);

export const intakeMatchCandidates = sqliteTable("intake_match_candidates", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), intakeCandidateId: text("intake_candidate_id").notNull(), existingMatterId: text("existing_matter_id").notNull(), matchType: text("match_type").notNull(), scoreBasisPoints: integer("score_basis_points").notNull(), evidence: text("evidence", { mode: "json" }).$type<string[]>().notNull(), disposition: text("disposition", { enum: ["possible_duplicate", "ruled_out", "confirmed_duplicate"] }).notNull(), reviewedBy: text("reviewed_by"), reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
}, (table) => [uniqueIndex("idx_intake_match_identity").on(table.tenantId, table.intakeCandidateId, table.existingMatterId)]);

export const conflictFindings = sqliteTable("conflict_findings", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), intakeCandidateId: text("intake_candidate_id").notNull(), subjectName: text("subject_name").notNull(), conflictType: text("conflict_type").notNull(), severity: text("severity", { enum: ["review", "blocking"] }).notNull(), reason: text("reason").notNull(), sourceReference: text("source_reference").notNull(), status: text("status", { enum: ["open", "cleared", "confirmed"] }).notNull(), resolvedBy: text("resolved_by"), resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }), resolutionReason: text("resolution_reason"),
}, (table) => [index("idx_conflict_candidate_status").on(table.tenantId, table.intakeCandidateId, table.status)]);

export const intakeReviewDecisions = sqliteTable("intake_review_decisions", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), intakeCandidateId: text("intake_candidate_id").notNull(), action: text("action").notNull(), fromStatus: text("from_status").notNull(), toStatus: text("to_status").notNull(), reason: text("reason").notNull(), actorId: text("actor_id").notNull(), eventId: text("event_id").notNull(), idempotencyKey: text("idempotency_key").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_intake_review_idempotency").on(table.tenantId, table.idempotencyKey), index("idx_intake_review_candidate").on(table.tenantId, table.intakeCandidateId, table.createdAt)]);

export const persons = sqliteTable("persons", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), givenName: text("given_name").notNull(), familyName: text("family_name").notNull(), displayName: text("display_name").notNull(), normalizedName: text("normalized_name").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_person_normalized_name").on(table.tenantId, table.normalizedName)]);

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), name: text("name").notNull(), normalizedName: text("normalized_name").notNull(), organizationType: text("organization_type", { enum: ["carrier", "tpa", "employer", "insured", "law_firm", "medical_provider", "vendor", "other"] }).notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_organization_normalized_name").on(table.tenantId, table.normalizedName)]);

export const partyAliases = sqliteTable("party_aliases", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), partyType: text("party_type", { enum: ["person", "organization"] }).notNull(), partyId: text("party_id").notNull(), alias: text("alias").notNull(), normalizedAlias: text("normalized_alias").notNull(), aliasType: text("alias_type", { enum: ["alternate", "former_name", "dba", "source_spelling"] }).notNull(), sourceLinkId: text("source_link_id").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_party_alias_identity").on(table.tenantId, table.partyType, table.partyId, table.normalizedAlias), index("idx_party_alias_lookup").on(table.tenantId, table.normalizedAlias)]);

export const matterParties = sqliteTable("matter_parties", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), partyType: text("party_type", { enum: ["person", "organization"] }).notNull(), partyId: text("party_id").notNull(), role: text("role").notNull(), claimId: text("claim_id"), injuryId: text("injury_id"), adjudicationCaseId: text("adjudication_case_id"), status: text("status", { enum: ["active", "former"] }).notNull(), sourceLinkId: text("source_link_id").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_matter_party_identity").on(table.tenantId, table.matterId, table.partyType, table.partyId, table.role), index("idx_matter_party_role").on(table.tenantId, table.matterId, table.role)]);

export const matterTasks = sqliteTable("matter_tasks", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), title: text("title").notNull(), taskType: text("task_type").notNull(), priority: text("priority", { enum: ["critical", "high", "normal", "low"] }).notNull(), ownerId: text("owner_id").notNull(), dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(), status: text("status", { enum: ["open", "in_progress", "blocked", "completed", "cancelled"] }).notNull(), blockerReason: text("blocker_reason"), completionEvidence: text("completion_evidence"), completedBy: text("completed_by"), completedAt: integer("completed_at", { mode: "timestamp_ms" }), cancelledBy: text("cancelled_by"), cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }), cancellationReason: text("cancellation_reason"), revision: integer("revision").notNull().default(1), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_matter_task_queue").on(table.tenantId, table.ownerId, table.status, table.dueAt), index("idx_matter_task_matter").on(table.tenantId, table.matterId, table.status)]);

export const taskDependencies = sqliteTable("task_dependencies", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), taskId: text("task_id").notNull(), dependsOnTaskId: text("depends_on_task_id").notNull(), dependencyType: text("dependency_type", { enum: ["finish_to_start"] }).notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_task_dependency_identity").on(table.tenantId, table.taskId, table.dependsOnTaskId)]);

export const taskDecisions = sqliteTable("task_decisions", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), taskId: text("task_id").notNull(), action: text("action").notNull(), fromStatus: text("from_status").notNull(), toStatus: text("to_status").notNull(), reason: text("reason"), actorId: text("actor_id").notNull(), eventId: text("event_id").notNull(), idempotencyKey: text("idempotency_key").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_task_decision_idempotency").on(table.tenantId, table.idempotencyKey), index("idx_task_decision_history").on(table.tenantId, table.taskId, table.createdAt)]);

export const recordRequests = sqliteTable("record_requests", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), requestType: text("request_type", { enum: ["authorization", "subpoena", "informal_request"] }).notNull(), custodianName: text("custodian_name").notNull(), scope: text("scope").notNull(), authorityBasis: text("authority_basis"), status: text("status", { enum: ["identified", "prepared", "served", "received", "deficient", "reviewed", "delivered", "closed", "cancelled"] }).notNull(), preparedBy: text("prepared_by"), preparedAt: integer("prepared_at", { mode: "timestamp_ms" }), serviceMethod: text("service_method"), servedBy: text("served_by"), servedAt: integer("served_at", { mode: "timestamp_ms" }), serviceEvidence: text("service_evidence"), complianceDueAt: integer("compliance_due_at", { mode: "timestamp_ms" }), receivedAt: integer("received_at", { mode: "timestamp_ms" }), receivedDocumentCount: integer("received_document_count"), completenessEvidence: text("completeness_evidence"), deficiencyReason: text("deficiency_reason"), deliveredTo: text("delivered_to"), deliveryEvidence: text("delivery_evidence"), deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }), costCents: integer("cost_cents"), billingDisposition: text("billing_disposition"), closedBy: text("closed_by"), closedAt: integer("closed_at", { mode: "timestamp_ms" }), cancellationReason: text("cancellation_reason"), revision: integer("revision").notNull().default(1), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_record_request_matter").on(table.tenantId, table.matterId, table.status), index("idx_record_request_due").on(table.tenantId, table.status, table.complianceDueAt)]);

export const recordRequestDecisions = sqliteTable("record_request_decisions", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), recordRequestId: text("record_request_id").notNull(), action: text("action").notNull(), fromStatus: text("from_status").notNull(), toStatus: text("to_status").notNull(), evidence: text("evidence"), actorId: text("actor_id").notNull(), eventId: text("event_id").notNull(), idempotencyKey: text("idempotency_key").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_record_request_decision_idempotency").on(table.tenantId, table.idempotencyKey), index("idx_record_request_decision_history").on(table.tenantId, table.recordRequestId, table.createdAt)]);

export const authorityCandidates = sqliteTable("authority_candidates", {
  id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),classification:text("classification",{enum:["request","recommendation","grant","historical_quote","hypothetical","third_party_statement"]}).notNull(),amountCents:integer("amount_cents"),currency:text("currency").notNull(),settlementStructure:text("settlement_structure"),scope:text("scope"),includes:text("includes",{mode:"json"}).$type<string[]>().notNull(),excludes:text("excludes",{mode:"json"}).$type<string[]>().notNull(),conditions:text("conditions",{mode:"json"}).$type<string[]>().notNull(),negotiationThresholdCents:integer("negotiation_threshold_cents"),grantorName:text("grantor_name").notNull(),grantorRole:text("grantor_role").notNull(),grantorOrganization:text("grantor_organization").notNull(),effectiveAt:integer("effective_at",{mode:"timestamp_ms"}),expiresAt:integer("expires_at",{mode:"timestamp_ms"}),sourceType:text("source_type").notNull(),sourceId:text("source_id").notNull(),sourceExcerpt:text("source_excerpt").notNull(),status:text("status",{enum:["proposed","confirmed","not_authority"]}).notNull(),revision:integer("revision").notNull().default(1),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).notNull(),
},table=>[uniqueIndex("idx_authority_candidate_source").on(table.tenantId,table.sourceType,table.sourceId),index("idx_authority_candidate_matter").on(table.tenantId,table.matterId,table.status)]);
export const authorityLedger=sqliteTable("authority_ledger",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),sourceCandidateId:text("source_candidate_id").notNull(),amountCents:integer("amount_cents").notNull(),currency:text("currency").notNull(),settlementStructure:text("settlement_structure").notNull(),scope:text("scope").notNull(),includes:text("includes",{mode:"json"}).$type<string[]>().notNull(),excludes:text("excludes",{mode:"json"}).$type<string[]>().notNull(),conditions:text("conditions",{mode:"json"}).$type<string[]>().notNull(),negotiationThresholdCents:integer("negotiation_threshold_cents"),grantorName:text("grantor_name").notNull(),grantorRole:text("grantor_role").notNull(),grantorOrganization:text("grantor_organization").notNull(),effectiveAt:integer("effective_at",{mode:"timestamp_ms"}).notNull(),expiresAt:integer("expires_at",{mode:"timestamp_ms"}),status:text("status",{enum:["confirmed","expired","withdrawn","used","superseded"]}).notNull(),verifiedBy:text("verified_by").notNull(),verifiedAt:integer("verified_at",{mode:"timestamp_ms"}).notNull(),supersededById:text("superseded_by_id"),revision:integer("revision").notNull().default(1)},table=>[index("idx_authority_ledger_matter").on(table.tenantId,table.matterId,table.verifiedAt),uniqueIndex("idx_authority_ledger_candidate").on(table.tenantId,table.sourceCandidateId)]);
export const authorityDecisions=sqliteTable("authority_decisions",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),candidateId:text("candidate_id"),ledgerId:text("ledger_id"),action:text("action").notNull(),reason:text("reason").notNull(),actorId:text("actor_id").notNull(),eventId:text("event_id").notNull(),idempotencyKey:text("idempotency_key").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_authority_decision_idempotency").on(table.tenantId,table.idempotencyKey),index("idx_authority_decision_matter").on(table.tenantId,table.matterId,table.createdAt)]);

export const matterClosureChecklists=sqliteTable("matter_closure_checklists",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),status:text("status",{enum:["open","ready","closed","reopened"]}).notNull(),settlementEvidence:text("settlement_evidence"),finalReportEvidence:text("final_report_evidence"),billingEvidence:text("billing_evidence"),retentionEvidence:text("retention_evidence"),lienEvidence:text("lien_evidence"),closedBy:text("closed_by"),closedAt:integer("closed_at",{mode:"timestamp_ms"}),reopenedBy:text("reopened_by"),reopenedAt:integer("reopened_at",{mode:"timestamp_ms"}),reopenReason:text("reopen_reason"),reopenSource:text("reopen_source"),revision:integer("revision").notNull().default(1),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_closure_checklist_matter").on(table.tenantId,table.matterId)]);
export const matterStatusHistory=sqliteTable("matter_status_history",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),fromStatus:text("from_status").notNull(),toStatus:text("to_status").notNull(),reason:text("reason").notNull(),source:text("source").notNull(),actorId:text("actor_id").notNull(),eventId:text("event_id").notNull(),occurredAt:integer("occurred_at",{mode:"timestamp_ms"}).notNull()},table=>[index("idx_matter_status_history").on(table.tenantId,table.matterId,table.occurredAt)]);
export const closureDecisions=sqliteTable("closure_decisions",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),checklistId:text("checklist_id").notNull(),action:text("action").notNull(),item:text("item"),evidence:text("evidence"),actorId:text("actor_id").notNull(),eventId:text("event_id").notNull(),idempotencyKey:text("idempotency_key").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_closure_decision_idempotency").on(table.tenantId,table.idempotencyKey),index("idx_closure_decision_history").on(table.tenantId,table.matterId,table.createdAt)]);

export const readinessAssessments=sqliteTable("readiness_assessments",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),assessmentType:text("assessment_type",{enum:["settlement"]}).notNull(),conclusion:text("conclusion",{enum:["ready_for_human_decision","not_ready","blocked"]}).notNull(),passCount:integer("pass_count").notNull(),gapCount:integer("gap_count").notNull(),blockedCount:integer("blocked_count").notNull(),dataAsOf:integer("data_as_of",{mode:"timestamp_ms"}).notNull(),evaluatedBy:text("evaluated_by").notNull(),nonAutonomous:integer("non_autonomous",{mode:"boolean"}).notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[index("idx_readiness_assessment_matter").on(table.tenantId,table.matterId,table.createdAt)]);
export const readinessFindings=sqliteTable("readiness_findings",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),assessmentId:text("assessment_id").notNull(),code:text("code").notNull(),label:text("label").notNull(),category:text("category",{enum:["missing_data","missing_document","inconsistency","client_decision","court_requirement","firm_preference","external_dependency"]}).notNull(),status:text("status",{enum:["pass","gap","blocked","not_applicable"]}).notNull(),severity:text("severity",{enum:["critical","high","normal","info"]}).notNull(),explanation:text("explanation").notNull(),evidenceType:text("evidence_type"),evidenceId:text("evidence_id"),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_readiness_finding_code").on(table.tenantId,table.assessmentId,table.code),index("idx_readiness_finding_matter").on(table.tenantId,table.matterId,table.status)]);
export const readinessReviews=sqliteTable("readiness_reviews",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),assessmentId:text("assessment_id").notNull(),outcome:text("outcome",{enum:["acknowledged","work_required"]}).notNull(),notes:text("notes").notNull(),reviewedBy:text("reviewed_by").notNull(),eventId:text("event_id").notNull(),idempotencyKey:text("idempotency_key").notNull(),reviewedAt:integer("reviewed_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_readiness_review_idempotency").on(table.tenantId,table.idempotencyKey),index("idx_readiness_review_assessment").on(table.tenantId,table.assessmentId,table.reviewedAt)]);

export const proceedings=sqliteTable("proceedings",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),proceedingType:text("proceeding_type",{enum:["status_conference","priority_conference","msc","rating_msc","lien_conference","expedited_hearing","trial","petition_reconsideration","petition_reopen","settlement_approval","other"]}).notNull(),title:text("title").notNull(),scheduledAt:integer("scheduled_at",{mode:"timestamp_ms"}).notNull(),venue:text("venue").notNull(),sourceType:text("source_type").notNull(),sourceId:text("source_id").notNull(),contentStatus:text("content_status",{enum:["synthetic_sandbox","pending_attorney_review","attorney_approved"]}).notNull(),status:text("status",{enum:["scheduled","completed","cancelled"]}).notNull(),revision:integer("revision").notNull().default(1),createdBy:text("created_by").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_proceeding_source").on(table.tenantId,table.sourceType,table.sourceId),index("idx_proceeding_matter_date").on(table.tenantId,table.matterId,table.scheduledAt)]);
export const proceedingReadinessItems=sqliteTable("proceeding_readiness_items",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),proceedingId:text("proceeding_id").notNull(),code:text("code").notNull(),label:text("label").notNull(),category:text("category",{enum:["missing_data","missing_document","inconsistency","client_decision","court_requirement","firm_preference","external_dependency"]}).notNull(),severity:text("severity",{enum:["critical","high","normal","info"]}).notNull(),status:text("status",{enum:["missing","verified","not_required"]}).notNull(),evidence:text("evidence"),evidenceType:text("evidence_type"),evidenceId:text("evidence_id"),providerMode:text("provider_mode",{enum:["athena_native","human_verified_external"]}).notNull(),verifiedBy:text("verified_by"),verifiedAt:integer("verified_at",{mode:"timestamp_ms"}),revision:integer("revision").notNull().default(1),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_proceeding_item_code").on(table.tenantId,table.proceedingId,table.code),index("idx_proceeding_item_status").on(table.tenantId,table.matterId,table.status)]);
export const proceedingAssessments=sqliteTable("proceeding_assessments",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),proceedingId:text("proceeding_id").notNull(),state:text("state",{enum:["ready","ready_with_warning","at_risk","blocked","client_decision_required","external_dependency"]}).notNull(),passCount:integer("pass_count").notNull(),gapCount:integer("gap_count").notNull(),blockedCount:integer("blocked_count").notNull(),dataAsOf:integer("data_as_of",{mode:"timestamp_ms"}).notNull(),evaluatedBy:text("evaluated_by").notNull(),nonAutonomous:integer("non_autonomous",{mode:"boolean"}).notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[index("idx_proceeding_assessment_history").on(table.tenantId,table.proceedingId,table.createdAt)]);
export const proceedingFindings=sqliteTable("proceeding_findings",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),proceedingId:text("proceeding_id").notNull(),assessmentId:text("assessment_id").notNull(),code:text("code").notNull(),category:text("category",{enum:["missing_data","missing_document","inconsistency","client_decision","court_requirement","firm_preference","external_dependency"]}).notNull(),status:text("status",{enum:["pass","gap","blocked","not_applicable"]}).notNull(),severity:text("severity",{enum:["critical","high","normal","info"]}).notNull(),explanation:text("explanation").notNull(),evidenceType:text("evidence_type"),evidenceId:text("evidence_id"),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_proceeding_finding_code").on(table.tenantId,table.assessmentId,table.code),index("idx_proceeding_finding_status").on(table.tenantId,table.proceedingId,table.status)]);
export const proceedingDecisions=sqliteTable("proceeding_decisions",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),proceedingId:text("proceeding_id").notNull(),action:text("action").notNull(),itemCode:text("item_code"),fromStatus:text("from_status"),toStatus:text("to_status"),evidence:text("evidence"),actorId:text("actor_id").notNull(),eventId:text("event_id").notNull(),idempotencyKey:text("idempotency_key").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_proceeding_decision_idempotency").on(table.tenantId,table.idempotencyKey),index("idx_proceeding_decision_history").on(table.tenantId,table.proceedingId,table.createdAt)]);

export const jurisdictionFormDefinitions=sqliteTable("jurisdiction_form_definitions",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),jurisdiction:text("jurisdiction").notNull(),formCode:text("form_code").notNull(),version:integer("version").notNull(),officialTitle:text("official_title").notNull(),effectiveAt:integer("effective_at",{mode:"timestamp_ms"}).notNull(),reviewBy:integer("review_by",{mode:"timestamp_ms"}).notNull(),sourceAuthority:text("source_authority").notNull(),contentStatus:text("content_status",{enum:["synthetic_sandbox","pending_attorney_review","attorney_approved"]}).notNull(),supersedesId:text("supersedes_id"),requiredDocumentKinds:text("required_document_kinds",{mode:"json"}).$type<string[]>().notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_form_definition_version").on(table.tenantId,table.jurisdiction,table.formCode,table.version)]);
export const filingPackets=sqliteTable("filing_packets",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),proceedingId:text("proceeding_id").notNull(),formDefinitionId:text("form_definition_id").notNull(),packetType:text("packet_type").notNull(),adjNumber:text("adj_number"),uan:text("uan"),venue:text("venue"),judge:text("judge"),status:text("status",{enum:["draft","validation_failed","ready_for_approval","approved","handoff_blocked","handed_off","rejected","accepted","superseded"]}).notNull(),revisionNumber:integer("revision_number").notNull(),priorPacketId:text("prior_packet_id"),correctionReason:text("correction_reason"),submissionIdentity:text("submission_identity").notNull(),revision:integer("revision").notNull().default(1),approvedBy:text("approved_by"),approvedAt:integer("approved_at",{mode:"timestamp_ms"}),externalStatusEvidence:text("external_status_evidence"),externalReference:text("external_reference"),providerMode:text("provider_mode",{enum:["not_connected","human_verified_external","approved_provider"]}).notNull(),createdBy:text("created_by").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_filing_submission_revision").on(table.tenantId,table.submissionIdentity,table.revisionNumber),index("idx_filing_packet_matter").on(table.tenantId,table.matterId,table.createdAt)]);
export const filingPacketDocuments=sqliteTable("filing_packet_documents",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),packetId:text("packet_id").notNull(),kind:text("kind",{enum:["primary_form","cover_sheet","separator_sheet","proof_of_service","attachment"]}).notNull(),title:text("title").notNull(),position:integer("position").notNull(),sha256:text("sha256").notNull(),signatureStatus:text("signature_status",{enum:["present","missing","not_required"]}).notNull(),sourceDocumentId:text("source_document_id").notNull(),createdBy:text("created_by").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_filing_packet_document_position").on(table.tenantId,table.packetId,table.position),uniqueIndex("idx_filing_packet_document_source").on(table.tenantId,table.packetId,table.sourceDocumentId)]);
export const filingPacketValidations=sqliteTable("filing_packet_validations",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),packetId:text("packet_id").notNull(),packetRevision:integer("packet_revision").notNull(),outcome:text("outcome",{enum:["pass","fail"]}).notNull(),checks:text("checks",{mode:"json"}).$type<Array<{code:string;status:"pass"|"fail";explanation:string}>>().notNull(),eventId:text("event_id").notNull(),validatedBy:text("validated_by").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[index("idx_filing_validation_history").on(table.tenantId,table.packetId,table.createdAt)]);
export const filingPacketDecisions=sqliteTable("filing_packet_decisions",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),packetId:text("packet_id").notNull(),action:text("action").notNull(),fromStatus:text("from_status").notNull(),toStatus:text("to_status").notNull(),reason:text("reason"),actorId:text("actor_id").notNull(),eventId:text("event_id").notNull(),idempotencyKey:text("idempotency_key").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_filing_packet_decision_idempotency").on(table.tenantId,table.idempotencyKey),index("idx_filing_packet_decision_history").on(table.tenantId,table.packetId,table.createdAt)]);

export const clientBillingProfiles=sqliteTable("client_billing_profiles",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),clientId:text("client_id").notNull(),name:text("name").notNull(),version:integer("version").notNull(),effectiveAt:integer("effective_at",{mode:"timestamp_ms"}).notNull(),expiresAt:integer("expires_at",{mode:"timestamp_ms"}),hourlyRateCents:integer("hourly_rate_cents").notNull(),billingIncrementMinutes:integer("billing_increment_minutes").notNull(),approvedTimekeeperIds:text("approved_timekeeper_ids",{mode:"json"}).$type<string[]>().notNull(),allowedTaskCodes:text("allowed_task_codes",{mode:"json"}).$type<string[]>().notNull(),allowedActivityCodes:text("allowed_activity_codes",{mode:"json"}).$type<string[]>().notNull(),allowedExpenseCodes:text("allowed_expense_codes",{mode:"json"}).$type<string[]>().notNull(),contentStatus:text("content_status",{enum:["synthetic_sandbox","client_approved"]}).notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_billing_profile_version").on(table.tenantId,table.clientId,table.version)]);
export const matterExpenses=sqliteTable("matter_expenses",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),expenseCode:text("expense_code").notNull(),description:text("description").notNull(),amountCents:integer("amount_cents").notNull(),incurredAt:integer("incurred_at",{mode:"timestamp_ms"}).notNull(),status:text("status",{enum:["recorded","prebilled","invoiced","paid","written_off"]}).notNull(),sourceType:text("source_type").notNull(),sourceId:text("source_id").notNull(),createdBy:text("created_by").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_expense_source").on(table.tenantId,table.sourceType,table.sourceId),index("idx_expense_matter").on(table.tenantId,table.matterId,table.status)]);
export const prebills=sqliteTable("prebills",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),billingProfileId:text("billing_profile_id").notNull(),periodStart:integer("period_start",{mode:"timestamp_ms"}).notNull(),periodEnd:integer("period_end",{mode:"timestamp_ms"}).notNull(),status:text("status",{enum:["draft","approved","invoiced"]}).notNull(),timeAmountCents:integer("time_amount_cents").notNull(),expenseAmountCents:integer("expense_amount_cents").notNull(),adjustmentAmountCents:integer("adjustment_amount_cents").notNull(),totalCents:integer("total_cents").notNull(),revision:integer("revision").notNull().default(1),approvedBy:text("approved_by"),approvedAt:integer("approved_at",{mode:"timestamp_ms"}),createdBy:text("created_by").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).notNull()},table=>[index("idx_prebill_matter").on(table.tenantId,table.matterId,table.createdAt)]);
export const prebillLines=sqliteTable("prebill_lines",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),prebillId:text("prebill_id").notNull(),lineType:text("line_type",{enum:["time","expense","adjustment"]}).notNull(),sourceId:text("source_id").notNull(),taskCode:text("task_code"),activityCode:text("activity_code"),expenseCode:text("expense_code"),minutes:integer("minutes"),rateCents:integer("rate_cents"),amountCents:integer("amount_cents").notNull(),narrative:text("narrative").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_prebill_line_source").on(table.tenantId,table.prebillId,table.lineType,table.sourceId)]);
export const invoices=sqliteTable("invoices",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),prebillId:text("prebill_id").notNull(),invoiceNumber:text("invoice_number").notNull(),clientMatterId:text("client_matter_id").notNull(),status:text("status",{enum:["draft","validated","submitted_manual","rejected","appealed","partially_paid","paid","written_off"]}).notNull(),grossAmountCents:integer("gross_amount_cents").notNull(),reductionAmountCents:integer("reduction_amount_cents").notNull(),appealRecoveryCents:integer("appeal_recovery_cents").notNull(),paidAmountCents:integer("paid_amount_cents").notNull(),balanceCents:integer("balance_cents").notNull(),providerMode:text("provider_mode",{enum:["not_connected","human_verified_external"]}).notNull(),revision:integer("revision").notNull().default(1),createdBy:text("created_by").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_invoice_number").on(table.tenantId,table.invoiceNumber),uniqueIndex("idx_invoice_prebill").on(table.tenantId,table.prebillId)]);
export const ledesExports=sqliteTable("ledes_exports",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),invoiceId:text("invoice_id").notNull(),format:text("format",{enum:["LEDES1998B"]}).notNull(),outcome:text("outcome",{enum:["pass","fail"]}).notNull(),checks:text("checks",{mode:"json"}).$type<Array<{code:string;status:"pass"|"fail";explanation:string}>>().notNull(),sha256:text("sha256").notNull(),providerMode:text("provider_mode",{enum:["not_connected"]}).notNull(),createdBy:text("created_by").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[index("idx_ledes_invoice").on(table.tenantId,table.invoiceId,table.createdAt)]);
export const invoiceAdjustments=sqliteTable("invoice_adjustments",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),invoiceId:text("invoice_id").notNull(),adjustmentType:text("adjustment_type",{enum:["reduction","rejection","appeal_opened","appeal_resolved","write_off"]}).notNull(),amountCents:integer("amount_cents").notNull(),reasonCode:text("reason_code").notNull(),explanation:text("explanation").notNull(),externalReference:text("external_reference"),providerMode:text("provider_mode",{enum:["athena_native","human_verified_external"]}).notNull(),actorId:text("actor_id").notNull(),eventId:text("event_id").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[index("idx_invoice_adjustment_history").on(table.tenantId,table.invoiceId,table.createdAt)]);
export const invoicePayments=sqliteTable("invoice_payments",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),invoiceId:text("invoice_id").notNull(),amountCents:integer("amount_cents").notNull(),paidAt:integer("paid_at",{mode:"timestamp_ms"}).notNull(),externalReference:text("external_reference").notNull(),providerMode:text("provider_mode",{enum:["human_verified_external"]}).notNull(),recordedBy:text("recorded_by").notNull(),eventId:text("event_id").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_invoice_payment_reference").on(table.tenantId,table.externalReference),index("idx_invoice_payment_history").on(table.tenantId,table.invoiceId,table.paidAt)]);
export const billingLifecycleDecisions=sqliteTable("billing_lifecycle_decisions",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),aggregateType:text("aggregate_type").notNull(),aggregateId:text("aggregate_id").notNull(),action:text("action").notNull(),fromStatus:text("from_status").notNull(),toStatus:text("to_status").notNull(),amountCents:integer("amount_cents"),reason:text("reason"),actorId:text("actor_id").notNull(),eventId:text("event_id").notNull(),idempotencyKey:text("idempotency_key").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_billing_lifecycle_idempotency").on(table.tenantId,table.idempotencyKey),index("idx_billing_lifecycle_history").on(table.tenantId,table.aggregateType,table.aggregateId,table.createdAt)]);

export const governanceRules = sqliteTable("governance_rules", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  code: text("code").notNull(),
  version: integer("version").notNull(),
  authorityType: text("authority_type").notNull(),
  authorityCitation: text("authority_citation").notNull(),
  businessDays: integer("business_days").notNull(),
  effectiveAt: integer("effective_at", { mode: "timestamp_ms" }).notNull(),
  reviewBy: integer("review_by", { mode: "timestamp_ms" }).notNull(),
  contentStatus: text("content_status", { enum: ["synthetic_sandbox", "pending_attorney_review", "attorney_approved"] }).notNull().default("pending_attorney_review"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
}, (table) => [uniqueIndex("idx_governance_rule_version").on(table.tenantId, table.code, table.version)]);

export const obligations = sqliteTable("obligations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  ruleId: text("rule_id").notNull(),
  ruleCode: text("rule_code").notNull().default("legacy"),
  ruleVersion: integer("rule_version").notNull().default(1),
  authorityCitation: text("authority_citation").notNull().default("Legacy obligation; review required"),
  title: text("title").notNull(),
  requirement: text("requirement").notNull().default("Review obligation requirements"),
  triggerAt: integer("trigger_at", { mode: "timestamp_ms" }).notNull().default(sql`0`),
  triggerSourceType: text("trigger_source_type").notNull().default("legacy"),
  triggerSourceId: text("trigger_source_id").notNull().default("legacy"),
  dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
  ownerId: text("owner_id").notNull(),
  status: text("status", { enum: ["open", "completed", "cancelled"] }).notNull(),
  calculation: text("calculation", { mode: "json" }).$type<string[]>().notNull(),
  revision: integer("revision").notNull().default(1),
  completedBy: text("completed_by"),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  completionEvidence: text("completion_evidence"),
  cancelledBy: text("cancelled_by"),
  cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
  cancellationReason: text("cancellation_reason"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`0`),
}, (table) => [index("idx_obligations_tenant_due").on(table.tenantId, table.status, table.dueAt)]);

export const matterAccessPolicies = sqliteTable("matter_access_policies", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id").notNull(),
  userId: text("user_id").notNull(),
  effect: text("effect", { enum: ["allow", "deny"] }).notNull(),
  status: text("status", { enum: ["active", "released"] }).notNull().default("active"),
  reason: text("reason").notNull(),
  source: text("source").notNull(),
  placedBy: text("placed_by").notNull().default("legacy"),
  effectiveAt: integer("effective_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  releasedBy: text("released_by"),
  releasedAt: integer("released_at", { mode: "timestamp_ms" }),
  releaseReason: text("release_reason"),
  revision: integer("revision").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_matter_access_policy_identity").on(table.tenantId, table.matterId, table.userId, table.source),
  index("idx_matter_access_policy_user").on(table.tenantId, table.userId, table.effect),
]);

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

export const documentEvidenceRecords=sqliteTable("document_evidence_records",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),sourceType:text("source_type").notNull(),sourceId:text("source_id").notNull(),title:text("title").notNull(),originalObjectKey:text("original_object_key").notNull(),originalSha256:text("original_sha256").notNull(),byteSize:integer("byte_size").notNull(),mimeType:text("mime_type").notNull(),pageCount:integer("page_count").notNull(),custodyStatus:text("custody_status",{enum:["trusted_synthetic_fixture","quarantined_pending_scan","failed"]}).notNull(),privilege:text("privilege",{enum:["none","attorney_client","work_product"]}).notNull(),confidentiality:text("confidentiality",{enum:["public","internal","confidential","highly_confidential"]}).notNull(),retentionPolicyId:text("retention_policy_id"),legalHoldRequired:integer("legal_hold_required",{mode:"boolean"}).notNull(),createdBy:text("created_by").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_evidence_source").on(table.tenantId,table.sourceType,table.sourceId),uniqueIndex("idx_evidence_original_object").on(table.originalObjectKey),index("idx_evidence_matter").on(table.tenantId,table.matterId,table.createdAt)]);
export const documentDerivatives=sqliteTable("document_derivatives",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),evidenceId:text("evidence_id").notNull(),parentDerivativeId:text("parent_derivative_id"),derivativeKind:text("derivative_kind",{enum:["ocr_text","redacted_copy","bates_copy","medical_index","exhibit_version","filing_copy","ai_summary","final_attorney_approved"]}).notNull(),version:integer("version").notNull(),title:text("title").notNull(),objectKey:text("object_key"),sha256:text("sha256"),sourcePageStart:integer("source_page_start").notNull(),sourcePageEnd:integer("source_page_end").notNull(),status:text("status",{enum:["draft","approved","blocked"]}).notNull(),providerMode:text("provider_mode",{enum:["deterministic_sandbox","human_authored","not_connected"]}).notNull(),approvedBy:text("approved_by"),approvedAt:integer("approved_at",{mode:"timestamp_ms"}),createdBy:text("created_by").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_derivative_version").on(table.tenantId,table.evidenceId,table.derivativeKind,table.version),uniqueIndex("idx_derivative_object").on(table.objectKey),index("idx_derivative_lineage").on(table.tenantId,table.evidenceId,table.parentDerivativeId)]);
export const batesAssignments=sqliteTable("bates_assignments",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),derivativeId:text("derivative_id").notNull(),prefix:text("prefix").notNull(),startNumber:integer("start_number").notNull(),endNumber:integer("end_number").notNull(),digits:integer("digits").notNull(),assignedBy:text("assigned_by").notNull(),eventId:text("event_id").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_bates_derivative").on(table.tenantId,table.derivativeId),uniqueIndex("idx_bates_range_start").on(table.tenantId,table.matterId,table.prefix,table.startNumber)]);
export const exhibitAssignments=sqliteTable("exhibit_assignments",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),derivativeId:text("derivative_id").notNull(),proceedingId:text("proceeding_id").notNull(),exhibitLabel:text("exhibit_label").notNull(),description:text("description").notNull(),assignedBy:text("assigned_by").notNull(),eventId:text("event_id").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_exhibit_label").on(table.tenantId,table.proceedingId,table.exhibitLabel),uniqueIndex("idx_exhibit_derivative").on(table.tenantId,table.proceedingId,table.derivativeId)]);
export const productionSets=sqliteTable("production_sets",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),title:text("title").notNull(),purpose:text("purpose").notNull(),status:text("status",{enum:["draft","validated","approved","export_ready"]}).notNull(),itemCount:integer("item_count").notNull(),pageCount:integer("page_count").notNull(),manifestObjectKey:text("manifest_object_key"),manifestSha256:text("manifest_sha256"),revision:integer("revision").notNull().default(1),approvedBy:text("approved_by"),approvedAt:integer("approved_at",{mode:"timestamp_ms"}),createdBy:text("created_by").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull(),updatedAt:integer("updated_at",{mode:"timestamp_ms"}).notNull()},table=>[index("idx_production_set_matter").on(table.tenantId,table.matterId,table.createdAt)]);
export const productionSetItems=sqliteTable("production_set_items",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),productionSetId:text("production_set_id").notNull(),evidenceId:text("evidence_id").notNull(),derivativeId:text("derivative_id").notNull(),position:integer("position").notNull(),includedPageStart:integer("included_page_start").notNull(),includedPageEnd:integer("included_page_end").notNull(),privilegeReviewed:integer("privilege_reviewed",{mode:"boolean"}).notNull(),confidentialityReviewed:integer("confidentiality_reviewed",{mode:"boolean"}).notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_production_item_position").on(table.tenantId,table.productionSetId,table.position),uniqueIndex("idx_production_item_derivative").on(table.tenantId,table.productionSetId,table.derivativeId)]);
export const documentEvidenceDecisions=sqliteTable("document_evidence_decisions",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),matterId:text("matter_id").notNull(),aggregateType:text("aggregate_type").notNull(),aggregateId:text("aggregate_id").notNull(),action:text("action").notNull(),fromStatus:text("from_status").notNull(),toStatus:text("to_status").notNull(),evidence:text("evidence"),actorId:text("actor_id").notNull(),eventId:text("event_id").notNull(),idempotencyKey:text("idempotency_key").notNull(),createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull()},table=>[uniqueIndex("idx_document_evidence_decision_idempotency").on(table.tenantId,table.idempotencyKey),index("idx_document_evidence_decision_history").on(table.tenantId,table.aggregateType,table.aggregateId,table.createdAt)]);

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
  completeness: text("completeness", { enum: ["complete", "partial"] }).notNull().default("partial"),
  missingItems: text("missing_items", { mode: "json" }).$type<string[]>().notNull().default([]),
  archiveEntryCount: integer("archive_entry_count").notNull().default(1),
  restorationVerifiedAt: integer("restoration_verified_at", { mode: "timestamp_ms" }),
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

export const mailboxConnections = sqliteTable("mailbox_connections", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  provider: text("provider", { enum: ["microsoft_365"] }).notNull(),
  mailboxAddress: text("mailbox_address").notNull(),
  status: text("status", { enum: ["not_connected", "connected", "revoked", "error"] }).notNull(),
  providerMode: text("provider_mode", { enum: ["not_connected", "live"] }).notNull(),
  grantedScopes: text("granted_scopes", { mode: "json" }).$type<string[]>().notNull().default([]),
  deltaCursor: text("delta_cursor"),
  lastSuccessfulSyncAt: integer("last_successful_sync_at", { mode: "timestamp_ms" }),
  healthDetail: text("health_detail").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_mailbox_tenant_address").on(table.tenantId, table.mailboxAddress),
  index("idx_mailbox_tenant_status").on(table.tenantId, table.status, table.updatedAt),
]);

export const communicationThreads = sqliteTable("communication_threads", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  mailboxConnectionId: text("mailbox_connection_id").notNull(),
  providerThreadId: text("provider_thread_id"),
  subject: text("subject").notNull(),
  participants: text("participants", { mode: "json" }).$type<string[]>().notNull(),
  matterId: text("matter_id"),
  associationStatus: text("association_status", { enum: ["unreviewed", "suggested", "filed", "excluded"] }).notNull(),
  autoFilingExcluded: integer("auto_filing_excluded", { mode: "boolean" }).notNull().default(false),
  messageCount: integer("message_count").notNull().default(0),
  lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }).notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_communication_thread_matter").on(table.tenantId, table.matterId, table.lastMessageAt),
  index("idx_communication_thread_review").on(table.tenantId, table.associationStatus, table.lastMessageAt),
]);

export const communicationMessages = sqliteTable("communication_messages", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  threadId: text("thread_id").notNull(),
  matterId: text("matter_id"),
  providerMessageId: text("provider_message_id"),
  internetMessageId: text("internet_message_id"),
  direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
  fromAddress: text("from_address").notNull(),
  toAddresses: text("to_addresses", { mode: "json" }).$type<string[]>().notNull(),
  ccAddresses: text("cc_addresses", { mode: "json" }).$type<string[]>().notNull().default([]),
  subject: text("subject").notNull(),
  bodyText: text("body_text").notNull(),
  bodySha256: text("body_sha256").notNull(),
  receivedOrDraftedAt: integer("received_or_drafted_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status", { enum: ["preserved", "draft", "approved", "blocked_not_connected", "sent", "failed"] }).notNull(),
  providerMode: text("provider_mode", { enum: ["deterministic_sandbox", "human_authored", "not_connected", "live"] }).notNull(),
  deliveryAttempted: integer("delivery_attempted", { mode: "boolean" }).notNull().default(false),
  approvedBy: text("approved_by"),
  approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
  revision: integer("revision").notNull().default(1),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_communication_message_provider").on(table.tenantId, table.providerMessageId),
  index("idx_communication_message_thread").on(table.tenantId, table.threadId, table.receivedOrDraftedAt),
  index("idx_communication_message_matter").on(table.tenantId, table.matterId, table.receivedOrDraftedAt),
]);

export const communicationAttachments = sqliteTable("communication_attachments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  threadId: text("thread_id").notNull(),
  messageId: text("message_id").notNull(),
  matterId: text("matter_id"),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  sha256: text("sha256").notNull(),
  providerAttachmentId: text("provider_attachment_id"),
  sourceObjectKey: text("source_object_key"),
  extractionStatus: text("extraction_status", { enum: ["preserved_metadata", "quarantined", "released", "blocked_not_connected"] }).notNull(),
  documentEvidenceId: text("document_evidence_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_communication_attachment_message").on(table.tenantId, table.messageId, table.id),
  index("idx_communication_attachment_thread").on(table.tenantId, table.threadId, table.createdAt),
]);

export const matterAssociationCandidates = sqliteTable("matter_association_candidates", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  threadId: text("thread_id").notNull(),
  messageId: text("message_id").notNull(),
  suggestedMatterId: text("suggested_matter_id").notNull(),
  targetMatterId: text("target_matter_id"),
  signals: text("signals", { mode: "json" }).$type<string[]>().notNull(),
  confidenceBasis: text("confidence_basis").notNull(),
  status: text("status", { enum: ["pending", "filed", "do_not_file", "excluded", "undone"] }).notNull(),
  resolutionReason: text("resolution_reason"),
  resolvedBy: text("resolved_by"),
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  revision: integer("revision").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_association_candidate_message").on(table.tenantId, table.messageId),
  index("idx_association_candidate_review").on(table.tenantId, table.status, table.updatedAt),
]);

export const communicationDecisions = sqliteTable("communication_decisions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  matterId: text("matter_id"),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  action: text("action").notNull(),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  actorId: text("actor_id").notNull(),
  eventId: text("event_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_communication_decision_idempotency").on(table.tenantId, table.idempotencyKey),
  index("idx_communication_decision_aggregate").on(table.tenantId, table.aggregateType, table.aggregateId, table.createdAt),
]);

export const calendarSeries = sqliteTable("calendar_series", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(),
  title: text("title").notNull(), recurrenceRule: text("recurrence_rule").notNull(), timezone: text("timezone").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(), endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  occurrenceCount: integer("occurrence_count").notNull(), status: text("status", { enum: ["active", "cancelled"] }).notNull(),
  providerMode: text("provider_mode", { enum: ["deterministic_sandbox", "human_authored", "live"] }).notNull(),
  revision: integer("revision").notNull().default(1), createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_calendar_series_matter").on(table.tenantId, table.matterId, table.startsAt)]);

export const calendarEvents = sqliteTable("calendar_events", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(),
  seriesId: text("series_id"), parentEventId: text("parent_event_id"),
  eventKind: text("event_kind", { enum: ["hearing", "deposition", "qme_appointment", "deadline", "preparation", "client_call"] }).notNull(),
  title: text("title").notNull(), startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(), endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  allDay: integer("all_day", { mode: "boolean" }).notNull().default(false), timezone: text("timezone").notNull(), location: text("location"),
  ownerId: text("owner_id").notNull(), status: text("status", { enum: ["scheduled", "completed", "cancelled"] }).notNull(),
  sourceType: text("source_type").notNull(), sourceId: text("source_id").notNull(), externalProviderId: text("external_provider_id"),
  revision: integer("revision").notNull().default(1), createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_calendar_event_matter_time").on(table.tenantId, table.matterId, table.startsAt),
  index("idx_calendar_event_owner_time").on(table.tenantId, table.ownerId, table.startsAt, table.endsAt),
]);

export const calendarEventDependencies = sqliteTable("calendar_event_dependencies", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(),
  parentEventId: text("parent_event_id").notNull(), childEventId: text("child_event_id").notNull(),
  relationType: text("relation_type", { enum: ["deadline_chain", "preparation_for"] }).notNull(),
  offsetDays: integer("offset_days").notNull(), calculationBasis: text("calculation_basis").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_calendar_dependency_edge").on(table.tenantId, table.parentEventId, table.childEventId),
  index("idx_calendar_dependency_matter").on(table.tenantId, table.matterId, table.createdAt),
]);

export const calendarReminders = sqliteTable("calendar_reminders", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), eventId: text("event_id").notNull(),
  channel: text("channel", { enum: ["in_app"] }).notNull(), offsetMinutes: integer("offset_minutes").notNull(),
  remindAt: integer("remind_at", { mode: "timestamp_ms" }).notNull(), status: text("status", { enum: ["scheduled", "acknowledged", "cancelled"] }).notNull(),
  acknowledgedBy: text("acknowledged_by"), acknowledgedAt: integer("acknowledged_at", { mode: "timestamp_ms" }),
  revision: integer("revision").notNull().default(1), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_calendar_reminder_due").on(table.tenantId, table.status, table.remindAt)]);

export const calendarConflicts = sqliteTable("calendar_conflicts", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(),
  eventId: text("event_id").notNull(), conflictingEventId: text("conflicting_event_id").notNull(), conflictType: text("conflict_type", { enum: ["owner_overlap"] }).notNull(),
  status: text("status", { enum: ["open", "reschedule_required", "accepted_with_reason"] }).notNull(), explanation: text("explanation").notNull(),
  resolutionReason: text("resolution_reason"), resolvedBy: text("resolved_by"), resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  revision: integer("revision").notNull().default(1), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_calendar_conflict_pair").on(table.tenantId, table.eventId, table.conflictingEventId),
  index("idx_calendar_conflict_status").on(table.tenantId, table.status, table.updatedAt),
]);

export const calendarSyncStates = sqliteTable("calendar_sync_states", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), provider: text("provider", { enum: ["microsoft_365"] }).notNull(),
  calendarOwnerId: text("calendar_owner_id").notNull(), status: text("status", { enum: ["not_connected", "connected", "revoked", "error"] }).notNull(),
  providerMode: text("provider_mode", { enum: ["not_connected", "live"] }).notNull(), grantedScopes: text("granted_scopes", { mode: "json" }).$type<string[]>().notNull().default([]),
  deltaCursor: text("delta_cursor"), subscriptionId: text("subscription_id"), lastSuccessfulSyncAt: integer("last_successful_sync_at", { mode: "timestamp_ms" }),
  healthDetail: text("health_detail").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  revision: integer("revision").notNull().default(1),
}, (table) => [uniqueIndex("idx_calendar_sync_owner").on(table.tenantId, table.provider, table.calendarOwnerId)]);

export const calendarDecisions = sqliteTable("calendar_decisions", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(),
  aggregateType: text("aggregate_type").notNull(), aggregateId: text("aggregate_id").notNull(), action: text("action").notNull(),
  fromStatus: text("from_status").notNull(), toStatus: text("to_status").notNull(), reason: text("reason"),
  actorId: text("actor_id").notNull(), eventId: text("event_id").notNull(), idempotencyKey: text("idempotency_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_calendar_decision_idempotency").on(table.tenantId, table.idempotencyKey),
  index("idx_calendar_decision_aggregate").on(table.tenantId, table.aggregateType, table.aggregateId, table.createdAt),
]);

export const reportDefinitions = sqliteTable("report_definitions", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), clientName: text("client_name").notNull(),
  code: text("code").notNull(), version: integer("version").notNull(), title: text("title").notNull(),
  reportType: text("report_type", { enum: ["initial", "status", "significant_event", "closure", "portfolio"] }).notNull(),
  requiredSections: text("required_sections", { mode: "json" }).$type<string[]>().notNull(),
  cadence: text("cadence").notNull(), scheduleMode: text("schedule_mode", { enum: ["local_intent", "external_connected"] }).notNull(),
  contentStatus: text("content_status", { enum: ["synthetic_sandbox", "pending_attorney_review", "attorney_approved"] }).notNull(),
  effectiveAt: integer("effective_at", { mode: "timestamp_ms" }).notNull(), reviewBy: integer("review_by", { mode: "timestamp_ms" }).notNull(),
  createdBy: text("created_by").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_report_definition_version").on(table.tenantId, table.code, table.version)]);

export const reportInstances = sqliteTable("report_instances", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), definitionId: text("definition_id").notNull(),
  definitionCode: text("definition_code").notNull(), definitionVersion: integer("definition_version").notNull(), title: text("title").notNull(),
  status: text("status", { enum: ["draft", "validated", "approved", "delivery_blocked", "delivered"] }).notNull(),
  dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(), recipientAddresses: text("recipient_addresses", { mode: "json" }).$type<string[]>().notNull(),
  sourceCoverageCount: integer("source_coverage_count").notNull(), unresolvedConflictCount: integer("unresolved_conflict_count").notNull(),
  scheduleMode: text("schedule_mode", { enum: ["local_intent", "external_connected"] }).notNull(),
  providerMode: text("provider_mode", { enum: ["deterministic_sandbox", "human_authored", "not_connected", "live"] }).notNull(),
  revision: integer("revision").notNull().default(1), approvedBy: text("approved_by"), approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
  createdBy: text("created_by").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_report_instance_matter_due").on(table.tenantId, table.matterId, table.dueAt)]);

export const reportSections = sqliteTable("report_sections", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), reportInstanceId: text("report_instance_id").notNull(),
  sectionCode: text("section_code").notNull(), title: text("title").notNull(), position: integer("position").notNull(), body: text("body").notNull(),
  bodySha256: text("body_sha256").notNull(), sourceRecordIds: text("source_record_ids", { mode: "json" }).$type<string[]>().notNull(),
  providerMode: text("provider_mode", { enum: ["deterministic_sandbox", "human_authored"] }).notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_report_section_code").on(table.tenantId, table.reportInstanceId, table.sectionCode),
  uniqueIndex("idx_report_section_position").on(table.tenantId, table.reportInstanceId, table.position),
]);

export const reportValidations = sqliteTable("report_validations", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), reportInstanceId: text("report_instance_id").notNull(),
  revision: integer("revision").notNull(), outcome: text("outcome", { enum: ["pass", "fail"] }).notNull(),
  checks: text("checks", { mode: "json" }).$type<Array<{ code: string; status: string; explanation: string }>>().notNull(),
  sourceCoverageCount: integer("source_coverage_count").notNull(), createdBy: text("created_by").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_report_validation_instance").on(table.tenantId, table.reportInstanceId, table.createdAt)]);

export const reportDeliveries = sqliteTable("report_deliveries", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), reportInstanceId: text("report_instance_id").notNull(),
  provider: text("provider", { enum: ["microsoft_365"] }).notNull(), status: text("status", { enum: ["blocked_not_connected", "sent", "failed"] }).notNull(),
  providerMode: text("provider_mode", { enum: ["not_connected", "live"] }).notNull(), providerDeliveryAttempted: integer("provider_delivery_attempted", { mode: "boolean" }).notNull(),
  recipientAddresses: text("recipient_addresses", { mode: "json" }).$type<string[]>().notNull(), reason: text("reason").notNull(), providerMessageId: text("provider_message_id"),
  createdBy: text("created_by").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_report_delivery_instance").on(table.tenantId, table.reportInstanceId, table.createdAt)]);

export const reportDecisions = sqliteTable("report_decisions", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), reportInstanceId: text("report_instance_id").notNull(),
  action: text("action").notNull(), fromStatus: text("from_status").notNull(), toStatus: text("to_status").notNull(), reason: text("reason"),
  actorId: text("actor_id").notNull(), eventId: text("event_id").notNull(), idempotencyKey: text("idempotency_key").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_report_decision_idempotency").on(table.tenantId, table.idempotencyKey),
  index("idx_report_decision_instance").on(table.tenantId, table.reportInstanceId, table.createdAt),
]);

export const matterBudgets = sqliteTable("matter_budgets", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(),
  title: text("title").notNull(), currency: text("currency").notNull(), totalBudgetCents: integer("total_budget_cents").notNull(),
  status: text("status", { enum: ["draft", "approved", "closed"] }).notNull(), contentStatus: text("content_status", { enum: ["synthetic_sandbox", "client_approved"] }).notNull(),
  effectiveDate: integer("effective_date", { mode: "timestamp_ms" }).notNull(), revision: integer("revision").notNull().default(1),
  approvedBy: text("approved_by"), approvedAt: integer("approved_at", { mode: "timestamp_ms" }), createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_matter_budget_matter").on(table.tenantId, table.matterId, table.createdAt)]);

export const budgetPhases = sqliteTable("budget_phases", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), budgetId: text("budget_id").notNull(),
  phaseCode: text("phase_code").notNull(), title: text("title").notNull(), position: integer("position").notNull(), budgetCents: integer("budget_cents").notNull(),
  incurredCents: integer("incurred_cents").notNull().default(0), remainingCents: integer("remaining_cents").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_budget_phase_code").on(table.tenantId, table.budgetId, table.phaseCode),
  uniqueIndex("idx_budget_phase_position").on(table.tenantId, table.budgetId, table.position),
]);

export const accrualSnapshots = sqliteTable("accrual_snapshots", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), budgetId: text("budget_id").notNull(),
  period: text("period").notNull(), feesCents: integer("fees_cents").notNull(), expensesCents: integer("expenses_cents").notNull(),
  totalAccruedCents: integer("total_accrued_cents").notNull(), budgetVarianceCents: integer("budget_variance_cents").notNull(),
  sourceRecordIds: text("source_record_ids", { mode: "json" }).$type<string[]>().notNull(), recordedBy: text("recorded_by").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_accrual_budget_period").on(table.tenantId, table.budgetId, table.period)]);

export const profitabilitySnapshots = sqliteTable("profitability_snapshots", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), budgetId: text("budget_id").notNull(),
  asOfDate: integer("as_of_date", { mode: "timestamp_ms" }).notNull(), billedCents: integer("billed_cents").notNull(), collectedCents: integer("collected_cents").notNull(),
  workedValueCents: integer("worked_value_cents").notNull(), directCostCents: integer("direct_cost_cents").notNull(),
  realizationBasisPoints: integer("realization_basis_points").notNull(), contributionCents: integer("contribution_cents").notNull(),
  projectionMode: text("projection_mode", { enum: ["deterministic_sandbox", "firm_approved"] }).notNull(), sourceRecordIds: text("source_record_ids", { mode: "json" }).$type<string[]>().notNull(),
  createdBy: text("created_by").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_profitability_budget_date").on(table.tenantId, table.budgetId, table.asOfDate)]);

export const budgetDecisions = sqliteTable("budget_decisions", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), matterId: text("matter_id").notNull(), budgetId: text("budget_id").notNull(),
  action: text("action").notNull(), fromStatus: text("from_status").notNull(), toStatus: text("to_status").notNull(), reason: text("reason"),
  actorId: text("actor_id").notNull(), eventId: text("event_id").notNull(), idempotencyKey: text("idempotency_key").notNull(), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_budget_decision_idempotency").on(table.tenantId, table.idempotencyKey),
  index("idx_budget_decision_budget").on(table.tenantId, table.budgetId, table.createdAt),
]);
