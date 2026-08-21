import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  conflictFindings,
  governanceRules,
  intakeCandidates,
  intakeMatchCandidates,
  intakeReviewDecisions,
  matters,
  obligations,
  optimisticWriteClaims,
  previewEvents,
  previewOutbox,
} from "../../db/schema";
import type { IntakeCandidateCommand } from "@/domain/intake/candidate";
import {
  OPENING_RULE_CODES,
  type OpeningObligationPlan,
} from "@/domain/intake/opening-obligations";
import type { EventEnvelope } from "./events";
import {
  OptimisticConcurrencyError,
  rethrowOptimisticClaimConflict,
} from "./optimistic-concurrency";
import type { RequestActor } from "./request-actor";

export const GOLDEN_INTAKE_CANDIDATE_ID = "intake-golden-001";
export const GOLDEN_CONFLICT_ID = "conflict-golden-001";
export const GOLDEN_MATCH_ID = "match-golden-001";

export async function readIntakeProjection(
  tenantId: string,
  candidateId: string,
) {
  const db = getPreviewDb();
  const [candidate] = await db
    .select()
    .from(intakeCandidates)
    .where(
      and(
        eq(intakeCandidates.tenantId, tenantId),
        eq(intakeCandidates.id, candidateId),
      ),
    )
    .limit(1);
  if (!candidate)
    return {
      candidate: null,
      matches: [],
      conflicts: [],
      reviews: [],
      openingObligations: [],
      openConflictCount: 0,
      unresolvedMatchCount: 0,
    };
  const [matches, conflicts, reviews, openingObligations] = await Promise.all([
    db
      .select()
      .from(intakeMatchCandidates)
      .where(
        and(
          eq(intakeMatchCandidates.tenantId, tenantId),
          eq(intakeMatchCandidates.intakeCandidateId, candidateId),
        ),
      )
      .orderBy(asc(intakeMatchCandidates.id)),
    db
      .select()
      .from(conflictFindings)
      .where(
        and(
          eq(conflictFindings.tenantId, tenantId),
          eq(conflictFindings.intakeCandidateId, candidateId),
        ),
      )
      .orderBy(asc(conflictFindings.id)),
    db
      .select()
      .from(intakeReviewDecisions)
      .where(
        and(
          eq(intakeReviewDecisions.tenantId, tenantId),
          eq(intakeReviewDecisions.intakeCandidateId, candidateId),
        ),
      )
      .orderBy(asc(intakeReviewDecisions.createdAt)),
    db
      .select()
      .from(obligations)
      .where(
        and(
          eq(obligations.tenantId, tenantId),
          eq(obligations.matterId, candidate.proposedMatterId),
          eq(obligations.triggerSourceType, "intake_candidate"),
          eq(obligations.triggerSourceId, candidateId),
        ),
      )
      .orderBy(asc(obligations.dueAt)),
  ]);
  return {
    candidate,
    matches,
    conflicts,
    reviews,
    openingObligations,
    openConflictCount: conflicts.filter((item) => item.status === "open")
      .length,
    unresolvedMatchCount: matches.filter(
      (item) => item.disposition === "possible_duplicate",
    ).length,
  };
}

export async function readIntakeOpeningRules(tenantId: string) {
  return getPreviewDb()
    .select()
    .from(governanceRules)
    .where(
      and(
        eq(governanceRules.tenantId, tenantId),
        inArray(governanceRules.code, [...OPENING_RULE_CODES]),
      ),
    )
    .orderBy(asc(governanceRules.code), asc(governanceRules.version));
}

export async function readIntakeEventByIdempotency(
  tenantId: string,
  idempotencyKey: string,
) {
  const [event] = await getPreviewDb()
    .select({
      eventId: previewEvents.eventId,
      eventType: previewEvents.eventType,
    })
    .from(previewEvents)
    .where(
      and(
        eq(previewEvents.tenantId, tenantId),
        eq(previewEvents.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return event ?? null;
}

export async function persistIntakeDecision(input: {
  command: IntakeCandidateCommand;
  fromStatus: string;
  toStatus:
    | "conflict_review"
    | "missing_information"
    | "ready_to_open"
    | "opened"
    | "rejected";
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
  openingPlan?: OpeningObligationPlan[];
}) {
  const db = getPreviewDb(),
    now = new Date(input.event.occurredAt),
    { command } = input;
  const [prior] = await db
    .select({ eventId: previewEvents.eventId })
    .from(previewEvents)
    .where(
      and(
        eq(previewEvents.tenantId, command.tenantId),
        eq(previewEvents.idempotencyKey, command.idempotencyKey),
      ),
    )
    .limit(1);
  if (prior) return { replayed: true, eventId: prior.eventId };
  const eventWrite = eventInsert(db, input.event, input.actor.userId, now);
  const outboxWrite = outboxInsert(db, input.event, "athena.intake", now);
  const reviewWrite = db.insert(intakeReviewDecisions).values({
    id: createId(),
    tenantId: command.tenantId,
    intakeCandidateId: command.candidateId,
    action: command.action,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    reason:
      "reason" in command
        ? command.reason
        : "Deterministic sandbox referral preserved and candidate created.",
    actorId: input.actor.userId,
    eventId: input.event.eventId,
    idempotencyKey: command.idempotencyKey,
    createdAt: now,
  });
  if (command.action === "create_candidate") {
    await db.batch([
      db.insert(intakeCandidates).values({
        id: command.candidateId,
        tenantId: command.tenantId,
        proposedMatterId: command.matterId,
        sourceType: "referral_email",
        sourceRecordId: "sandbox-referral-rivera-0042",
        providerMode: "deterministic_sandbox",
        caption: "Rivera v. Northstar Logistics",
        clientName: "Summit Claims Services",
        employerName: "Northstar Logistics, Inc.",
        applicantName: "Elena Rivera",
        claimNumber: "SCS-CA-884103",
        adjNumber: "ADJ18420931",
        injuryDate: asDate("2025-11-04"),
        missingFields: ["claims_professional_email"],
        status: "conflict_review",
        revision: 1,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(intakeMatchCandidates).values({
        id: GOLDEN_MATCH_ID,
        tenantId: command.tenantId,
        intakeCandidateId: command.candidateId,
        existingMatterId: command.matterId,
        matchType: "applicant_employer_doi",
        scoreBasisPoints: 8400,
        evidence: ["applicant_exact", "employer_exact", "injury_date_exact"],
        disposition: "possible_duplicate",
      }),
      db.insert(conflictFindings).values({
        id: GOLDEN_CONFLICT_ID,
        tenantId: command.tenantId,
        intakeCandidateId: command.candidateId,
        subjectName: "Northstar Logistics, Inc.",
        conflictType: "prior_representation_review",
        severity: "blocking",
        reason:
          "Synthetic prior representation requires partner review before opening.",
        sourceReference: "sandbox-conflict-index-0007",
        status: "open",
      }),
      reviewWrite,
      eventWrite,
      outboxWrite,
    ]);
    return { replayed: false, eventId: input.event.eventId };
  }

  const projection = await readIntakeProjection(
      command.tenantId,
      command.candidateId,
    ),
    candidate = projection.candidate;
  if (!candidate || candidate.revision !== command.expectedRevision)
    throw new Error("Intake candidate changed; refresh before retrying");
  const nextRevision = candidate.revision + 1;
  const writes: unknown[] = [
    db.insert(optimisticWriteClaims).values({
      id: createId(),
      tenantId: command.tenantId,
      aggregateType: "intake_candidate",
      aggregateId: command.candidateId,
      expectedRevision: command.expectedRevision,
      claimedRevision: nextRevision,
      actorId: input.actor.userId,
      eventId: input.event.eventId,
      idempotencyKey: command.idempotencyKey,
      createdAt: now,
    }),
  ];
  if (command.action === "clear_conflict")
    writes.push(
      db
        .update(conflictFindings)
        .set({
          status: "cleared",
          resolvedBy: input.actor.userId,
          resolvedAt: now,
          resolutionReason: command.reason,
        })
        .where(
          and(
            eq(conflictFindings.tenantId, command.tenantId),
            eq(conflictFindings.intakeCandidateId, command.candidateId),
            eq(conflictFindings.id, command.conflictId),
            eq(conflictFindings.status, "open"),
          ),
        ),
    );
  if (command.action === "resolve_match")
    writes.push(
      db
        .update(intakeMatchCandidates)
        .set({
          disposition: command.disposition,
          reviewedBy: input.actor.userId,
          reviewedAt: now,
        })
        .where(
          and(
            eq(intakeMatchCandidates.tenantId, command.tenantId),
            eq(intakeMatchCandidates.intakeCandidateId, command.candidateId),
            eq(intakeMatchCandidates.id, command.matchId),
            eq(intakeMatchCandidates.disposition, "possible_duplicate"),
          ),
        ),
    );
  const missingFields =
    command.action === "supply_information"
      ? candidate.missingFields.filter(
          (field) => !command.fields.includes(field as never),
        )
      : candidate.missingFields;
  writes.push(
    db
      .update(intakeCandidates)
      .set({
        status: input.toStatus,
        missingFields,
        revision: nextRevision,
        updatedAt: now,
        openedBy:
          command.action === "approve_open"
            ? input.actor.userId
            : candidate.openedBy,
        openedAt: command.action === "approve_open" ? now : candidate.openedAt,
        rejectedBy:
          command.action === "reject" ||
          (command.action === "resolve_match" &&
            command.disposition === "confirmed_duplicate")
            ? input.actor.userId
            : candidate.rejectedBy,
        rejectedAt: input.toStatus === "rejected" ? now : candidate.rejectedAt,
        rejectionReason:
          input.toStatus === "rejected"
            ? command.reason
            : candidate.rejectionReason,
      })
      .where(
        and(
          eq(intakeCandidates.tenantId, command.tenantId),
          eq(intakeCandidates.id, command.candidateId),
          eq(intakeCandidates.revision, command.expectedRevision),
        ),
      ),
  );
  if (command.action === "approve_open")
    writes.push(
      db
        .insert(matters)
        .values({
          id: command.matterId,
          tenantId: command.tenantId,
          matterNumber: "NRL-2026-0042",
          caption: candidate.caption,
          status: "open",
          clientName: candidate.clientName,
          employerName: candidate.employerName,
          applicantName: candidate.applicantName,
          assignedAttorneyId: input.actor.userId,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: matters.id,
          set: { status: "open", updatedAt: now },
        }),
    );
  if (
    command.action === "approve_open" ||
    command.action === "materialize_initial_obligations"
  ) {
    if (input.openingPlan?.length !== 2)
      throw new Error("Opening obligation plan is required for persistence");
    for (const planned of input.openingPlan) {
      const childEvent = openingEvent(input, planned, now);
      writes.push(
        db.insert(obligations).values({
          id: planned.id,
          tenantId: command.tenantId,
          matterId: command.matterId,
          ruleId: planned.ruleId,
          ruleCode: planned.ruleCode,
          ruleVersion: planned.ruleVersion,
          authorityCitation: planned.authorityCitation,
          title: planned.title,
          requirement: planned.requirement,
          triggerAt: asDate(planned.triggerDate),
          triggerSourceType: "intake_candidate",
          triggerSourceId: command.candidateId,
          dueAt: asDate(planned.dueDate),
          ownerId: planned.ownerId,
          status: "open",
          calculation: planned.calculation,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        }),
        eventInsert(db, childEvent, input.actor.userId, now),
        outboxInsert(db, childEvent, "athena.obligations", now),
      );
    }
  }
  writes.push(reviewWrite, eventWrite, outboxWrite);
  try {
    await db.batch(writes as never);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("obligations.id") ||
      message.includes("idx_preview_event_idempotency")
    )
      throw new OptimisticConcurrencyError();
    rethrowOptimisticClaimConflict(error);
    throw error;
  }
  return { replayed: false, eventId: input.event.eventId };
}

function openingEvent(
  input: {
    command: IntakeCandidateCommand;
    event: EventEnvelope<Record<string, unknown>>;
    actor: RequestActor;
  },
  plan: OpeningObligationPlan,
  now: Date,
): EventEnvelope<Record<string, unknown>> {
  return {
    eventId: createId(),
    eventType: "obligation.created_from_matter_opening",
    eventVersion: 1,
    tenantId: input.command.tenantId,
    aggregateType: "obligation",
    aggregateId: plan.id,
    matterId: input.command.matterId,
    actorId: input.actor.userId,
    occurredAt: now.toISOString(),
    correlationId: input.event.eventId,
    causationId: input.event.eventId,
    idempotencyKey: `opening:${input.command.candidateId}:${plan.ruleCode}:v${plan.ruleVersion}`,
    source: "athena.web",
    visibility: "restricted",
    retentionPolicy: "matter-lifecycle-plus-firm-retention",
    payload: {
      action: "create_from_matter_opening",
      ruleCode: plan.ruleCode,
      ruleVersion: plan.ruleVersion,
      dueDate: plan.dueDate,
      humanAuthorized: true,
      contentStatus: "synthetic_sandbox",
      californiaLegalContentApproved: false,
    },
  };
}

function eventInsert(
  db: ReturnType<typeof getPreviewDb>,
  event: EventEnvelope<Record<string, unknown>>,
  actorId: string,
  now: Date,
) {
  return db.insert(previewEvents).values({
    eventId: event.eventId,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    tenantId: event.tenantId,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    matterId: event.matterId,
    actorId,
    occurredAt: now,
    correlationId: event.correlationId,
    causationId: event.causationId,
    idempotencyKey: event.idempotencyKey,
    source: event.source,
    visibility: event.visibility,
    retentionPolicy: event.retentionPolicy,
    payload: event.payload,
  });
}
function outboxInsert(
  db: ReturnType<typeof getPreviewDb>,
  event: EventEnvelope<Record<string, unknown>>,
  topic: string,
  now: Date,
) {
  return db.insert(previewOutbox).values({
    id: createId(),
    tenantId: event.tenantId,
    eventId: event.eventId,
    topic,
    payload: event,
    attempts: 0,
    availableAt: now,
  });
}
function asDate(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}
