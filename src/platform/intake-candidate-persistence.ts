import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { conflictFindings, intakeCandidates, intakeMatchCandidates, intakeReviewDecisions, matters, previewEvents, previewOutbox } from "../../db/schema";
import type { IntakeCandidateCommand } from "@/domain/intake/candidate";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export const GOLDEN_INTAKE_CANDIDATE_ID = "intake-golden-001";
export const GOLDEN_CONFLICT_ID = "conflict-golden-001";
export const GOLDEN_MATCH_ID = "match-golden-001";

export async function readIntakeProjection(tenantId: string, candidateId: string) {
  const db = getPreviewDb();
  const [candidate] = await db.select().from(intakeCandidates).where(and(eq(intakeCandidates.tenantId, tenantId), eq(intakeCandidates.id, candidateId))).limit(1);
  if (!candidate) return { candidate: null, matches: [], conflicts: [], reviews: [], openConflictCount: 0, unresolvedMatchCount: 0 };
  const [matches, conflicts, reviews] = await Promise.all([
    db.select().from(intakeMatchCandidates).where(and(eq(intakeMatchCandidates.tenantId, tenantId), eq(intakeMatchCandidates.intakeCandidateId, candidateId))).orderBy(asc(intakeMatchCandidates.id)),
    db.select().from(conflictFindings).where(and(eq(conflictFindings.tenantId, tenantId), eq(conflictFindings.intakeCandidateId, candidateId))).orderBy(asc(conflictFindings.id)),
    db.select().from(intakeReviewDecisions).where(and(eq(intakeReviewDecisions.tenantId, tenantId), eq(intakeReviewDecisions.intakeCandidateId, candidateId))).orderBy(asc(intakeReviewDecisions.createdAt)),
  ]);
  return { candidate, matches, conflicts, reviews, openConflictCount: conflicts.filter((item) => item.status === "open").length, unresolvedMatchCount: matches.filter((item) => item.disposition === "possible_duplicate").length };
}

export async function readIntakeEventByIdempotency(tenantId: string, idempotencyKey: string) {
  const [event] = await getPreviewDb().select({ eventId: previewEvents.eventId, eventType: previewEvents.eventType }).from(previewEvents).where(and(eq(previewEvents.tenantId, tenantId), eq(previewEvents.idempotencyKey, idempotencyKey))).limit(1);
  return event ?? null;
}

export async function persistIntakeDecision(input: { command: IntakeCandidateCommand; fromStatus: string; toStatus: "conflict_review" | "missing_information" | "ready_to_open" | "opened" | "rejected"; event: EventEnvelope<Record<string, unknown>>; actor: RequestActor }) {
  const db = getPreviewDb(), now = new Date(input.event.occurredAt), { command } = input;
  const [prior] = await db.select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, command.tenantId), eq(previewEvents.idempotencyKey, command.idempotencyKey))).limit(1);
  if (prior) return { replayed: true, eventId: prior.eventId };
  const eventWrite = db.insert(previewEvents).values({ eventId: input.event.eventId, eventType: input.event.eventType, eventVersion: input.event.eventVersion, tenantId: input.event.tenantId, aggregateType: input.event.aggregateType, aggregateId: input.event.aggregateId, matterId: input.event.matterId, actorId: input.actor.userId, occurredAt: now, correlationId: input.event.correlationId, causationId: input.event.causationId, idempotencyKey: input.event.idempotencyKey, source: input.event.source, visibility: input.event.visibility, retentionPolicy: input.event.retentionPolicy, payload: input.event.payload });
  const outboxWrite = db.insert(previewOutbox).values({ id: createId(), tenantId: command.tenantId, eventId: input.event.eventId, topic: "athena.intake", payload: input.event, attempts: 0, availableAt: now });
  const reviewWrite = db.insert(intakeReviewDecisions).values({ id: createId(), tenantId: command.tenantId, intakeCandidateId: command.candidateId, action: command.action, fromStatus: input.fromStatus, toStatus: input.toStatus, reason: "reason" in command ? command.reason : "Deterministic sandbox referral preserved and candidate created.", actorId: input.actor.userId, eventId: input.event.eventId, idempotencyKey: command.idempotencyKey, createdAt: now });
  if (command.action === "create_candidate") {
    await db.batch([
      db.insert(intakeCandidates).values({ id: command.candidateId, tenantId: command.tenantId, proposedMatterId: command.matterId, sourceType: "referral_email", sourceRecordId: "sandbox-referral-rivera-0042", providerMode: "deterministic_sandbox", caption: "Rivera v. Northstar Logistics", clientName: "Summit Claims Services", employerName: "Northstar Logistics, Inc.", applicantName: "Elena Rivera", claimNumber: "SCS-CA-884103", adjNumber: "ADJ18420931", injuryDate: asDate("2025-11-04"), missingFields: ["claims_professional_email"], status: "conflict_review", revision: 1, createdAt: now, updatedAt: now }),
      db.insert(intakeMatchCandidates).values({ id: GOLDEN_MATCH_ID, tenantId: command.tenantId, intakeCandidateId: command.candidateId, existingMatterId: command.matterId, matchType: "applicant_employer_doi", scoreBasisPoints: 8400, evidence: ["applicant_exact", "employer_exact", "injury_date_exact"], disposition: "possible_duplicate" }),
      db.insert(conflictFindings).values({ id: GOLDEN_CONFLICT_ID, tenantId: command.tenantId, intakeCandidateId: command.candidateId, subjectName: "Northstar Logistics, Inc.", conflictType: "prior_representation_review", severity: "blocking", reason: "Synthetic prior representation requires partner review before opening.", sourceReference: "sandbox-conflict-index-0007", status: "open" }),
      reviewWrite, eventWrite, outboxWrite,
    ]);
  } else {
    const projection = await readIntakeProjection(command.tenantId, command.candidateId), candidate = projection.candidate;
    if (!candidate || candidate.revision !== command.expectedRevision) throw new Error("Intake candidate changed; refresh before retrying");
    const nextRevision = candidate.revision + 1;
    const writes = [];
    if (command.action === "clear_conflict") writes.push(db.update(conflictFindings).set({ status: "cleared", resolvedBy: input.actor.userId, resolvedAt: now, resolutionReason: command.reason }).where(and(eq(conflictFindings.tenantId, command.tenantId), eq(conflictFindings.intakeCandidateId, command.candidateId), eq(conflictFindings.id, command.conflictId), eq(conflictFindings.status, "open"))));
    if (command.action === "resolve_match") writes.push(db.update(intakeMatchCandidates).set({ disposition: command.disposition, reviewedBy: input.actor.userId, reviewedAt: now }).where(and(eq(intakeMatchCandidates.tenantId, command.tenantId), eq(intakeMatchCandidates.intakeCandidateId, command.candidateId), eq(intakeMatchCandidates.id, command.matchId), eq(intakeMatchCandidates.disposition, "possible_duplicate"))));
    const missingFields = command.action === "supply_information" ? candidate.missingFields.filter((field) => !command.fields.includes(field as never)) : candidate.missingFields;
    writes.push(db.update(intakeCandidates).set({ status: input.toStatus, missingFields, revision: nextRevision, updatedAt: now, openedBy: command.action === "approve_open" ? input.actor.userId : candidate.openedBy, openedAt: command.action === "approve_open" ? now : candidate.openedAt, rejectedBy: command.action === "reject" || (command.action === "resolve_match" && command.disposition === "confirmed_duplicate") ? input.actor.userId : candidate.rejectedBy, rejectedAt: input.toStatus === "rejected" ? now : candidate.rejectedAt, rejectionReason: input.toStatus === "rejected" ? command.reason : candidate.rejectionReason }).where(and(eq(intakeCandidates.tenantId, command.tenantId), eq(intakeCandidates.id, command.candidateId), eq(intakeCandidates.revision, command.expectedRevision))));
    if (command.action === "approve_open") writes.push(db.insert(matters).values({ id: command.matterId, tenantId: command.tenantId, matterNumber: "NRL-2026-0042", caption: candidate.caption, status: "open", clientName: candidate.clientName, employerName: candidate.employerName, applicantName: candidate.applicantName, assignedAttorneyId: input.actor.userId, revision: 1, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: matters.id, set: { status: "open", updatedAt: now } }));
    writes.push(reviewWrite, eventWrite, outboxWrite);
    await db.batch(writes as [typeof writes[number], ...typeof writes[number][]]);
  }
  return { replayed: false, eventId: input.event.eventId };
}
function asDate(value: string) { return new Date(`${value}T12:00:00.000Z`); }
