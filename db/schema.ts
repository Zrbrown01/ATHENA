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
