import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  complianceAgreements,
  complianceRegistryDecisions,
  dataUseAuthorities,
  previewEvents,
  previewOutbox,
  providerActivationAssessments,
  subprocessors,
  vendorSecurityReviews,
} from "../../db/schema";
import type {
  ActivationInputs,
  ComplianceRegistryCommand,
} from "@/domain/compliance/registry";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";
export async function readSubprocessor(t: string, id: string) {
  const [x] = await getPreviewDb()
    .select()
    .from(subprocessors)
    .where(and(eq(subprocessors.tenantId, t), eq(subprocessors.id, id)))
    .limit(1);
  return x ?? null;
}
export async function readComplianceEvent(t: string, key: string) {
  const [x] = await getPreviewDb()
    .select({ eventId: previewEvents.eventId })
    .from(previewEvents)
    .where(
      and(eq(previewEvents.tenantId, t), eq(previewEvents.idempotencyKey, key)),
    )
    .limit(1);
  return x ?? null;
}
export async function complianceProjection(t: string) {
  const db = getPreviewDb(),
    [vendors, reviews, agreements, authorities, assessments, decisions] =
      await Promise.all([
        db.select().from(subprocessors).where(eq(subprocessors.tenantId, t)),
        db
          .select()
          .from(vendorSecurityReviews)
          .where(eq(vendorSecurityReviews.tenantId, t)),
        db
          .select()
          .from(complianceAgreements)
          .where(eq(complianceAgreements.tenantId, t)),
        db
          .select()
          .from(dataUseAuthorities)
          .where(eq(dataUseAuthorities.tenantId, t)),
        db
          .select()
          .from(providerActivationAssessments)
          .where(eq(providerActivationAssessments.tenantId, t))
          .orderBy(asc(providerActivationAssessments.assessedAt)),
        db
          .select()
          .from(complianceRegistryDecisions)
          .where(eq(complianceRegistryDecisions.tenantId, t))
          .orderBy(asc(complianceRegistryDecisions.createdAt)),
      ]);
  return { vendors, reviews, agreements, authorities, assessments, decisions };
}
export async function buildActivationInputs(
  t: string,
  id: string,
  now = new Date(),
): Promise<ActivationInputs> {
  const db = getPreviewDb(),
    [reviews, agreements, authorities] = await Promise.all([
      db
        .select()
        .from(vendorSecurityReviews)
        .where(
          and(
            eq(vendorSecurityReviews.tenantId, t),
            eq(vendorSecurityReviews.subprocessorId, id),
          ),
        ),
      db
        .select()
        .from(complianceAgreements)
        .where(
          and(
            eq(complianceAgreements.tenantId, t),
            eq(complianceAgreements.subprocessorId, id),
          ),
        ),
      db
        .select()
        .from(dataUseAuthorities)
        .where(
          and(
            eq(dataUseAuthorities.tenantId, t),
            eq(dataUseAuthorities.subprocessorId, id),
          ),
        ),
    ]),
    review = reviews.at(-1),
    authority = authorities.find((x) => x.status === "approved"),
    satisfied = (type: "baa" | "dpa") =>
      agreements.some(
        (x) =>
          x.agreementType === type &&
          (x.status === "executed" || x.status === "not_required") &&
          (!x.expiresAt || x.expiresAt > now),
      );
  return {
    securityPass: review?.outcome === "pass",
    securityValid: Boolean(review && review.validUntil > now),
    baaSatisfied: satisfied("baa"),
    dpaSatisfied: satisfied("dpa"),
    dataUseApproved: Boolean(authority),
    authorizedCategories: authority?.allowedDataCategories ?? [],
    trainingUseProhibited: Boolean(authority?.trainingUseProhibited),
  };
}
export async function persistComplianceRegistry(input: {
  command: ComplianceRegistryCommand;
  fromStatus: string;
  toStatus: string;
  assessment?: {
    outcome: "blocked" | "contractually_eligible";
    missingRequirements: string[];
    credentialActivationAllowed: false;
    providerConnected: false;
  };
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
}) {
  const db = getPreviewDb(),
    c = input.command,
    now = new Date(input.event.occurredAt),
    eventWrite = db
      .insert(previewEvents)
      .values({
        eventId: input.event.eventId,
        eventType: input.event.eventType,
        eventVersion: input.event.eventVersion,
        tenantId: c.tenantId,
        aggregateType: input.event.aggregateType,
        aggregateId: input.event.aggregateId,
        actorId: input.actor.userId,
        occurredAt: now,
        correlationId: input.event.correlationId,
        idempotencyKey: input.event.idempotencyKey,
        source: input.event.source,
        visibility: input.event.visibility,
        retentionPolicy: input.event.retentionPolicy,
        payload: input.event.payload,
      }),
    outboxWrite = db
      .insert(previewOutbox)
      .values({
        id: createId(),
        tenantId: c.tenantId,
        eventId: input.event.eventId,
        topic: "athena.compliance",
        payload: input.event,
        attempts: 0,
        availableAt: now,
      }),
    decisionWrite = db
      .insert(complianceRegistryDecisions)
      .values({
        id: createId(),
        tenantId: c.tenantId,
        subprocessorId: c.subprocessorId,
        action: c.action,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        reason: reason(c),
        actorId: input.actor.userId,
        eventId: input.event.eventId,
        idempotencyKey: c.idempotencyKey,
        createdAt: now,
      }),
    writes: unknown[] = [];
  if (c.action === "register_candidate")
    writes.push(
      db
        .insert(subprocessors)
        .values({
          id: c.subprocessorId,
          tenantId: c.tenantId,
          name: c.name,
          service: c.service,
          status: "candidate",
          dataRegions: c.dataRegions,
          dataCategories: c.dataCategories,
          usesAi: c.usesAi,
          trainingUse: c.trainingUse,
          providerConnected: false,
          revision: 1,
          ownerId: c.ownerId,
          createdAt: now,
          updatedAt: now,
        }),
    );
  else if (c.action === "record_security_review")
    writes.push(
      db
        .insert(vendorSecurityReviews)
        .values({
          id: c.reviewId,
          tenantId: c.tenantId,
          subprocessorId: c.subprocessorId,
          outcome: c.outcome,
          controlsReviewed: c.controlsReviewed,
          evidenceRef: c.evidenceRef,
          evidenceSha256: c.evidenceSha256,
          validUntil: new Date(c.validUntil),
          reviewedBy: input.actor.userId,
          reviewedAt: now,
        }),
      updateVendor(db, c.tenantId, c.subprocessorId, c.expectedRevision, {
        status: c.outcome === "fail" ? "rejected" : "under_review",
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
    );
  else if (c.action === "record_agreement")
    writes.push(
      db
        .insert(complianceAgreements)
        .values({
          id: c.agreementId,
          tenantId: c.tenantId,
          subprocessorId: c.subprocessorId,
          agreementType: c.agreementType,
          status: c.status,
          effectiveAt: c.effectiveAt ? new Date(c.effectiveAt) : null,
          expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
          artifactRef: c.artifactRef,
          artifactSha256: c.artifactSha256,
          approvedBy: input.actor.userId,
          createdAt: now,
        }),
      updateVendor(db, c.tenantId, c.subprocessorId, c.expectedRevision, {
        status: "under_review",
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
    );
  else if (c.action === "approve_data_use")
    writes.push(
      db
        .insert(dataUseAuthorities)
        .values({
          id: c.authorityId,
          tenantId: c.tenantId,
          subprocessorId: c.subprocessorId,
          purpose: c.purpose,
          allowedDataCategories: c.allowedDataCategories,
          allowedOperations: c.allowedOperations,
          aiAllowed: c.aiAllowed,
          trainingUseProhibited: c.trainingUseProhibited,
          status: "approved",
          approvedBy: input.actor.userId,
          approvedAt: now,
        }),
      updateVendor(db, c.tenantId, c.subprocessorId, c.expectedRevision, {
        trainingUse: c.trainingUseProhibited ? "prohibited" : "unknown",
        status: "under_review",
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
    );
  else {
    if (!input.assessment) throw new Error("Activation assessment is required");
    writes.push(
      db
        .insert(providerActivationAssessments)
        .values({
          id: c.assessmentId,
          tenantId: c.tenantId,
          subprocessorId: c.subprocessorId,
          outcome: input.assessment.outcome,
          missingRequirements: input.assessment.missingRequirements,
          credentialActivationAllowed: false,
          providerConnected: false,
          detail: c.reason,
          assessedBy: input.actor.userId,
          assessedAt: now,
        }),
      updateVendor(db, c.tenantId, c.subprocessorId, c.expectedRevision, {
        status:
          input.assessment.outcome === "contractually_eligible"
            ? "contractually_eligible"
            : "under_review",
        providerConnected: false,
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
    );
  }
  await db.batch([
    ...(writes as never[]),
    decisionWrite,
    eventWrite,
    outboxWrite,
  ] as never);
  return { replayed: false, eventId: input.event.eventId };
}
function updateVendor(
  db: ReturnType<typeof getPreviewDb>,
  t: string,
  id: string,
  revision: number,
  patch: Record<string, unknown>,
) {
  return db
    .update(subprocessors)
    .set(patch)
    .where(
      and(
        eq(subprocessors.tenantId, t),
        eq(subprocessors.id, id),
        eq(subprocessors.revision, revision),
      ),
    );
}
function reason(c: ComplianceRegistryCommand) {
  if (c.action === "register_candidate")
    return `Registered acknowledged synthetic candidate for ${c.service}.`;
  if (c.action === "record_security_review") return c.evidenceRef;
  if (c.action === "record_agreement") return c.artifactRef;
  if (c.action === "approve_data_use") return c.purpose;
  return c.reason;
}
