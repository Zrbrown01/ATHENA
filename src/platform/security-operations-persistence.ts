import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  breachAssessments,
  controlEvidence,
  incidentActions,
  previewEvents,
  previewOutbox,
  riskTreatments,
  securityControls,
  securityIncidents,
  securityOperationsDecisions,
  securityRisks,
} from "../../db/schema";
import type { SecurityOperationsCommand } from "@/domain/security/operations";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export async function readSecurityIncident(
  tenantId: string,
  incidentId: string,
) {
  const [row] = await getPreviewDb()
    .select()
    .from(securityIncidents)
    .where(
      and(
        eq(securityIncidents.tenantId, tenantId),
        eq(securityIncidents.id, incidentId),
      ),
    )
    .limit(1);
  return row ?? null;
}
export async function readSecurityControl(tenantId: string, controlId: string) {
  const [row] = await getPreviewDb()
    .select()
    .from(securityControls)
    .where(
      and(
        eq(securityControls.tenantId, tenantId),
        eq(securityControls.id, controlId),
      ),
    )
    .limit(1);
  return row ?? null;
}
export async function readSecurityRisk(tenantId: string, riskId: string) {
  const [row] = await getPreviewDb()
    .select()
    .from(securityRisks)
    .where(
      and(eq(securityRisks.tenantId, tenantId), eq(securityRisks.id, riskId)),
    )
    .limit(1);
  return row ?? null;
}
export async function readSecurityOperationEvent(
  tenantId: string,
  idempotencyKey: string,
) {
  const [row] = await getPreviewDb()
    .select({ eventId: previewEvents.eventId })
    .from(previewEvents)
    .where(
      and(
        eq(previewEvents.tenantId, tenantId),
        eq(previewEvents.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function securityOperationsProjection(tenantId: string) {
  const db = getPreviewDb();
  const [
    incidents,
    actions,
    assessments,
    controls,
    evidence,
    risks,
    treatments,
    decisions,
  ] = await Promise.all([
    db
      .select()
      .from(securityIncidents)
      .where(eq(securityIncidents.tenantId, tenantId))
      .orderBy(asc(securityIncidents.createdAt)),
    db
      .select()
      .from(incidentActions)
      .where(eq(incidentActions.tenantId, tenantId))
      .orderBy(asc(incidentActions.performedAt)),
    db
      .select()
      .from(breachAssessments)
      .where(eq(breachAssessments.tenantId, tenantId))
      .orderBy(asc(breachAssessments.createdAt)),
    db
      .select()
      .from(securityControls)
      .where(eq(securityControls.tenantId, tenantId))
      .orderBy(asc(securityControls.createdAt)),
    db
      .select()
      .from(controlEvidence)
      .where(eq(controlEvidence.tenantId, tenantId))
      .orderBy(asc(controlEvidence.createdAt)),
    db
      .select()
      .from(securityRisks)
      .where(eq(securityRisks.tenantId, tenantId))
      .orderBy(asc(securityRisks.createdAt)),
    db
      .select()
      .from(riskTreatments)
      .where(eq(riskTreatments.tenantId, tenantId))
      .orderBy(asc(riskTreatments.createdAt)),
    db
      .select()
      .from(securityOperationsDecisions)
      .where(eq(securityOperationsDecisions.tenantId, tenantId))
      .orderBy(asc(securityOperationsDecisions.createdAt)),
  ]);
  return {
    incidents,
    actions,
    assessments,
    controls,
    evidence,
    risks,
    treatments,
    decisions,
  };
}

export async function persistSecurityOperations(input: {
  command: SecurityOperationsCommand;
  aggregateType: string;
  aggregateId: string;
  fromStatus: string;
  toStatus: string;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
}) {
  const db = getPreviewDb();
  const c = input.command;
  const now = new Date(input.event.occurredAt);
  const eventWrite = db.insert(previewEvents).values({
    eventId: input.event.eventId,
    eventType: input.event.eventType,
    eventVersion: input.event.eventVersion,
    tenantId: input.event.tenantId,
    aggregateType: input.event.aggregateType,
    aggregateId: input.event.aggregateId,
    matterId: input.event.matterId,
    actorId: input.actor.userId,
    occurredAt: now,
    correlationId: input.event.correlationId,
    causationId: input.event.causationId,
    idempotencyKey: input.event.idempotencyKey,
    source: input.event.source,
    visibility: input.event.visibility,
    retentionPolicy: input.event.retentionPolicy,
    payload: input.event.payload,
  });
  const outboxWrite = db
    .insert(previewOutbox)
    .values({
      id: createId(),
      tenantId: c.tenantId,
      eventId: input.event.eventId,
      topic: "athena.security",
      payload: input.event,
      attempts: 0,
      availableAt: now,
    });
  const decisionWrite = db.insert(securityOperationsDecisions).values({
    id: createId(),
    tenantId: c.tenantId,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    action: c.action,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    reason: commandReason(c),
    actorId: input.actor.userId,
    eventId: input.event.eventId,
    idempotencyKey: c.idempotencyKey,
    createdAt: now,
  });
  const writes: unknown[] = [];

  if (c.action === "create_incident") {
    writes.push(
      db.insert(securityIncidents).values({
        id: c.incidentId,
        tenantId: c.tenantId,
        title: c.title,
        detectedAt: new Date(c.detectedAt),
        detectionSource: c.detectionSource,
        severity: c.severity,
        status: "detected",
        systems: c.systems,
        affectedTenantIds: c.affectedTenantIds,
        affectedMatterIds: c.affectedMatterIds,
        informationCategories: c.informationCategories,
        suspectedAccess: c.suspectedAccess,
        confirmedAccess: false,
        evidencePreservationRef: null,
        providerMode: "not_connected",
        revision: 1,
        incidentLead: c.incidentLead,
        createdBy: input.actor.userId,
        createdAt: now,
        updatedAt: now,
      }),
    );
  } else if (c.action === "scope_incident") {
    writes.push(
      updateIncident(db, c.tenantId, c.incidentId, c.expectedRevision, {
        status: "scoped",
        systems: c.systems,
        affectedTenantIds: c.affectedTenantIds,
        affectedMatterIds: c.affectedMatterIds,
        informationCategories: c.informationCategories,
        suspectedAccess: c.suspectedAccess,
        confirmedAccess: c.confirmedAccess,
        evidencePreservationRef: c.evidencePreservationRef,
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
    );
    writes.push(
      actionWrite(
        db,
        c.tenantId,
        c.incidentId,
        "scope",
        c.scopeSummary,
        c.systems,
        false,
        "manual_verified",
        c.evidencePreservationRef,
        input.actor.userId,
        now,
      ),
    );
    writes.push(
      actionWrite(
        db,
        c.tenantId,
        c.incidentId,
        "evidence_preservation",
        "Preserved the scoped evidence references before containment changes.",
        c.systems,
        false,
        "manual_verified",
        c.evidencePreservationRef,
        input.actor.userId,
        now,
      ),
    );
  } else if (c.action === "contain_incident") {
    writes.push(
      updateIncident(db, c.tenantId, c.incidentId, c.expectedRevision, {
        status: "contained",
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
    );
    writes.push(
      actionWrite(
        db,
        c.tenantId,
        c.incidentId,
        "containment",
        c.containmentSummary,
        [],
        false,
        "manual_verified",
        c.containmentEvidenceRef,
        input.actor.userId,
        now,
      ),
    );
    writes.push(
      actionWrite(
        db,
        c.tenantId,
        c.incidentId,
        "token_session_revocation",
        c.sessionRevocationEvidence,
        [],
        c.sessionRevocationMode === "human_verified_external",
        c.sessionRevocationMode === "human_verified_external"
          ? "manual_verified"
          : "not_connected",
        c.sessionRevocationEvidence,
        input.actor.userId,
        now,
      ),
    );
  } else if (c.action === "assess_breach") {
    writes.push(
      updateIncident(db, c.tenantId, c.incidentId, c.expectedRevision, {
        status: "legal_review",
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
    );
    writes.push(
      db
        .insert(breachAssessments)
        .values({
          id: c.assessmentId,
          tenantId: c.tenantId,
          incidentId: c.incidentId,
          conclusion: c.conclusion,
          contractualDeadlines: c.contractualDeadlines,
          legalAnalysis: c.legalAnalysis,
          notificationDecision: c.notificationDecision,
          reviewedBy: input.actor.userId,
          privilegeRestricted: true,
          createdAt: now,
        }),
    );
  } else if (c.action === "begin_recovery") {
    writes.push(
      updateIncident(db, c.tenantId, c.incidentId, c.expectedRevision, {
        status: "recovering",
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
    );
    writes.push(
      actionWrite(
        db,
        c.tenantId,
        c.incidentId,
        "recovery",
        c.recoverySummary,
        [],
        false,
        "manual_verified",
        c.recoveryEvidenceRef,
        input.actor.userId,
        now,
      ),
    );
  } else if (c.action === "record_root_cause") {
    writes.push(
      updateIncident(db, c.tenantId, c.incidentId, c.expectedRevision, {
        status: "root_cause_review",
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
    );
    writes.push(
      actionWrite(
        db,
        c.tenantId,
        c.incidentId,
        "root_cause",
        c.rootCause,
        [],
        false,
        "manual_verified",
        c.correctiveActionEvidenceRef,
        input.actor.userId,
        now,
      ),
    );
    writes.push(
      actionWrite(
        db,
        c.tenantId,
        c.incidentId,
        "corrective_action",
        c.correctiveAction,
        [],
        false,
        "manual_verified",
        c.correctiveActionEvidenceRef,
        input.actor.userId,
        now,
      ),
    );
  } else if (c.action === "close_incident") {
    writes.push(
      updateIncident(db, c.tenantId, c.incidentId, c.expectedRevision, {
        status: "closed",
        revision: c.expectedRevision + 1,
        updatedAt: now,
        closedAt: now,
      }),
    );
    writes.push(
      actionWrite(
        db,
        c.tenantId,
        c.incidentId,
        "corrective_action",
        c.effectivenessReview,
        [],
        false,
        "manual_verified",
        c.closureApproval,
        input.actor.userId,
        now,
      ),
    );
  } else if (c.action === "register_control") {
    const nextReviewAt = new Date(
      now.getTime() + c.reviewCadenceDays * 86_400_000,
    );
    writes.push(
      db
        .insert(securityControls)
        .values({
          id: c.controlId,
          tenantId: c.tenantId,
          code: c.code,
          title: c.title,
          controlFamily: c.controlFamily,
          ownerId: c.ownerId,
          status: "designed",
          description: c.description,
          reviewCadenceDays: c.reviewCadenceDays,
          nextReviewAt,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        }),
    );
  } else if (c.action === "attach_control_evidence") {
    const status =
      c.outcome === "pass"
        ? "verified"
        : c.outcome === "fail"
          ? "deficient"
          : "implemented";
    writes.push(
      db
        .update(securityControls)
        .set({
          status,
          revision: c.expectedRevision + 1,
          nextReviewAt: new Date(c.validUntil),
          updatedAt: now,
        })
        .where(
          and(
            eq(securityControls.tenantId, c.tenantId),
            eq(securityControls.id, c.controlId),
            eq(securityControls.revision, c.expectedRevision),
          ),
        ),
    );
    writes.push(
      db
        .insert(controlEvidence)
        .values({
          id: c.evidenceId,
          tenantId: c.tenantId,
          controlId: c.controlId,
          evidenceType: c.evidenceType,
          title: c.title,
          evidenceRef: c.evidenceRef,
          sha256: c.evidenceSha256,
          outcome: c.outcome,
          validFrom: new Date(c.validFrom),
          validUntil: new Date(c.validUntil),
          verifiedBy: input.actor.userId,
          createdAt: now,
        }),
    );
  } else if (c.action === "register_risk") {
    const inherentScore = c.likelihood * c.impact;
    writes.push(
      db
        .insert(securityRisks)
        .values({
          id: c.riskId,
          tenantId: c.tenantId,
          title: c.title,
          category: c.category,
          description: c.description,
          likelihood: c.likelihood,
          impact: c.impact,
          inherentScore,
          residualScore: inherentScore,
          status: "open",
          ownerId: c.ownerId,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        }),
    );
  } else {
    const status = c.strategy === "accept" ? "accepted" : "treatment_planned";
    writes.push(
      db
        .update(securityRisks)
        .set({
          status,
          residualScore: c.residualScore,
          revision: c.expectedRevision + 1,
          updatedAt: now,
        })
        .where(
          and(
            eq(securityRisks.tenantId, c.tenantId),
            eq(securityRisks.id, c.riskId),
            eq(securityRisks.revision, c.expectedRevision),
          ),
        ),
    );
    writes.push(
      db
        .insert(riskTreatments)
        .values({
          id: c.treatmentId,
          tenantId: c.tenantId,
          riskId: c.riskId,
          strategy: c.strategy,
          actionPlan: c.actionPlan,
          controlIds: c.controlIds,
          ownerId: c.ownerId,
          dueAt: new Date(c.dueAt),
          status: c.strategy === "accept" ? "accepted" : "planned",
          approvalEvidence: c.approvalEvidence,
          createdAt: now,
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

function updateIncident(
  db: ReturnType<typeof getPreviewDb>,
  tenantId: string,
  incidentId: string,
  revision: number,
  patch: Record<string, unknown>,
) {
  return db
    .update(securityIncidents)
    .set(patch)
    .where(
      and(
        eq(securityIncidents.tenantId, tenantId),
        eq(securityIncidents.id, incidentId),
        eq(securityIncidents.revision, revision),
      ),
    );
}
function actionWrite(
  db: ReturnType<typeof getPreviewDb>,
  tenantId: string,
  incidentId: string,
  actionType:
    | "scope"
    | "containment"
    | "token_session_revocation"
    | "evidence_preservation"
    | "notification"
    | "recovery"
    | "root_cause"
    | "corrective_action",
  summary: string,
  systems: string[],
  externalOperation: boolean,
  providerMode: "manual_verified" | "not_connected" | "live",
  evidenceRef: string,
  actorId: string,
  now: Date,
) {
  return db
    .insert(incidentActions)
    .values({
      id: createId(),
      tenantId,
      incidentId,
      actionType,
      summary,
      systems,
      externalOperation,
      providerMode,
      evidenceRef,
      performedBy: actorId,
      performedAt: now,
    });
}
function commandReason(c: SecurityOperationsCommand) {
  if (c.action === "create_incident") return c.detectionSource;
  if (c.action === "scope_incident") return c.scopeSummary;
  if (c.action === "contain_incident") return c.containmentSummary;
  if (c.action === "assess_breach") return c.legalAnalysis;
  if (c.action === "begin_recovery") return c.recoverySummary;
  if (c.action === "record_root_cause") return c.rootCause;
  if (c.action === "close_incident") return c.closureApproval;
  if (c.action === "register_control") return c.description;
  if (c.action === "attach_control_evidence") return c.evidenceRef;
  if (c.action === "register_risk") return c.description;
  return c.actionPlan;
}
