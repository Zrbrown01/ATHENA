import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  obligationDependencies,
  obligationEscalations,
  obligationExceptions,
  obligations,
  optimisticWriteClaims,
  previewEvents,
  previewOutbox,
} from "../../db/schema";
import type {
  EscalationEvaluation,
  ObligationGovernanceCommand,
} from "@/domain/governance/obligation-governance";
import type { EventEnvelope } from "./events";
import { rethrowOptimisticClaimConflict } from "./optimistic-concurrency";
import type { RequestActor } from "./request-actor";

export async function readObligationGovernanceEvent(
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

export async function obligationGovernanceProjection(
  tenantId: string,
  matterId: string,
) {
  const db = getPreviewDb();
  const [dependencies, exceptions, escalations] = await Promise.all([
    db
      .select()
      .from(obligationDependencies)
      .where(
        and(
          eq(obligationDependencies.tenantId, tenantId),
          eq(obligationDependencies.matterId, matterId),
        ),
      )
      .orderBy(asc(obligationDependencies.createdAt)),
    db
      .select()
      .from(obligationExceptions)
      .where(
        and(
          eq(obligationExceptions.tenantId, tenantId),
          eq(obligationExceptions.matterId, matterId),
        ),
      )
      .orderBy(asc(obligationExceptions.requestedAt)),
    db
      .select()
      .from(obligationEscalations)
      .where(
        and(
          eq(obligationEscalations.tenantId, tenantId),
          eq(obligationEscalations.matterId, matterId),
        ),
      )
      .orderBy(asc(obligationEscalations.createdAt)),
  ]);
  return { dependencies, exceptions, escalations };
}

export async function readObligationException(
  tenantId: string,
  matterId: string,
  id: string,
) {
  const [row] = await getPreviewDb()
    .select()
    .from(obligationExceptions)
    .where(
      and(
        eq(obligationExceptions.tenantId, tenantId),
        eq(obligationExceptions.matterId, matterId),
        eq(obligationExceptions.id, id),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function readObligationEscalation(
  tenantId: string,
  matterId: string,
  id: string,
) {
  const [row] = await getPreviewDb()
    .select()
    .from(obligationEscalations)
    .where(
      and(
        eq(obligationEscalations.tenantId, tenantId),
        eq(obligationEscalations.matterId, matterId),
        eq(obligationEscalations.id, id),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function countPendingObligationExceptions(
  tenantId: string,
  matterId: string,
  obligationId: string,
) {
  const rows = await getPreviewDb()
    .select({ id: obligationExceptions.id })
    .from(obligationExceptions)
    .where(
      and(
        eq(obligationExceptions.tenantId, tenantId),
        eq(obligationExceptions.matterId, matterId),
        eq(obligationExceptions.obligationId, obligationId),
        eq(obligationExceptions.status, "requested"),
      ),
    );
  return rows.length;
}

export async function countOpenBlockingDependencies(
  tenantId: string,
  matterId: string,
  predecessorObligationId: string,
) {
  const rows = await getPreviewDb()
    .select({ id: obligationDependencies.id })
    .from(obligationDependencies)
    .innerJoin(
      obligations,
      and(
        eq(obligationDependencies.tenantId, obligations.tenantId),
        eq(obligationDependencies.successorObligationId, obligations.id),
      ),
    )
    .where(
      and(
        eq(obligationDependencies.tenantId, tenantId),
        eq(obligationDependencies.matterId, matterId),
        eq(
          obligationDependencies.predecessorObligationId,
          predecessorObligationId,
        ),
        eq(obligationDependencies.blocksPredecessorCompletion, true),
        eq(obligations.status, "open"),
      ),
    );
  return rows.length;
}

export async function persistObligationGovernance(input: {
  command: ObligationGovernanceCommand;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
  dependency?: { dueDate: string; trace: string[] } | null;
  evaluation?: EscalationEvaluation | null;
}) {
  const db = getPreviewDb();
  const c = input.command;
  const now = new Date(input.event.occurredAt);
  const eventWrite = db.insert(previewEvents).values({
    eventId: input.event.eventId,
    eventType: input.event.eventType,
    eventVersion: input.event.eventVersion,
    tenantId: c.tenantId,
    aggregateType: input.event.aggregateType,
    aggregateId: input.event.aggregateId,
    matterId: input.event.matterId,
    actorId: input.actor.userId,
    occurredAt: now,
    correlationId: input.event.correlationId,
    idempotencyKey: input.event.idempotencyKey,
    source: input.event.source,
    visibility: input.event.visibility,
    retentionPolicy: input.event.retentionPolicy,
    payload: input.event.payload,
  });
  const outboxWrite = db.insert(previewOutbox).values({
    id: createId(),
    tenantId: c.tenantId,
    eventId: input.event.eventId,
    topic: "athena.obligation_governance",
    payload: input.event,
    attempts: 0,
    availableAt: now,
  });

  try {
    if (c.action === "create_dependent") {
      if (!input.dependency)
        throw new Error("Dependency calculation is required");
      const [predecessor] = await db
        .select()
        .from(obligations)
        .where(
          and(
            eq(obligations.tenantId, c.tenantId),
            eq(obligations.matterId, c.matterId),
            eq(obligations.id, c.predecessorObligationId),
          ),
        )
        .limit(1);
      if (!predecessor)
        throw new Error("Predecessor obligation does not exist");
      await db.batch([
        claim(
          db,
          c,
          input,
          "obligation",
          c.predecessorObligationId,
          c.expectedPredecessorRevision,
          now,
        ),
        db
          .update(obligations)
          .set({ revision: c.expectedPredecessorRevision + 1, updatedAt: now })
          .where(
            and(
              eq(obligations.tenantId, c.tenantId),
              eq(obligations.id, c.predecessorObligationId),
              eq(obligations.revision, c.expectedPredecessorRevision),
            ),
          ),
        db.insert(obligations).values({
          id: c.dependentObligationId,
          tenantId: c.tenantId,
          matterId: c.matterId,
          ruleId: predecessor.ruleId,
          ruleCode: predecessor.ruleCode,
          ruleVersion: predecessor.ruleVersion,
          authorityCitation: predecessor.authorityCitation,
          title: c.title,
          requirement: c.requirement,
          triggerAt: predecessor.dueAt,
          triggerSourceType: "firm_workflow",
          triggerSourceId: c.predecessorObligationId,
          dueAt: dateOnly(input.dependency.dueDate),
          ownerId: c.ownerId,
          status: "open",
          calculation: input.dependency.trace,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(obligationDependencies).values({
          id: c.dependencyId,
          tenantId: c.tenantId,
          matterId: c.matterId,
          predecessorObligationId: c.predecessorObligationId,
          successorObligationId: c.dependentObligationId,
          relationType: c.relationType,
          offsetBusinessDays: c.offsetBusinessDays,
          blocksPredecessorCompletion: true,
          calculation: input.dependency.trace,
          reason: c.reason,
          createdBy: input.actor.userId,
          eventId: input.event.eventId,
          createdAt: now,
        }),
        eventWrite,
        outboxWrite,
      ] as never);
    } else if (c.action === "request_exception") {
      await db.batch([
        claim(
          db,
          c,
          input,
          "obligation",
          c.obligationId,
          c.expectedRevision,
          now,
        ),
        bumpObligation(db, c.tenantId, c.obligationId, c.expectedRevision, now),
        db.insert(obligationExceptions).values({
          id: c.exceptionId,
          tenantId: c.tenantId,
          matterId: c.matterId,
          obligationId: c.obligationId,
          exceptionType: c.exceptionType,
          status: "requested",
          proposedDueAt: c.proposedDueDate ? dateOnly(c.proposedDueDate) : null,
          reason: c.reason,
          authorityBasis: c.authorityBasis,
          revision: 1,
          requestedBy: input.actor.userId,
          requestedAt: now,
          requestEventId: input.event.eventId,
          updatedAt: now,
        }),
        eventWrite,
        outboxWrite,
      ] as never);
    } else if (c.action === "decide_exception") {
      const exception = await readObligationException(
        c.tenantId,
        c.matterId,
        c.exceptionId,
      );
      if (!exception) throw new Error("Exception request does not exist");
      const approved = c.outcome === "approved";
      const obligationPatch: Record<string, unknown> = {
        revision: c.expectedRevision + 1,
        updatedAt: now,
      };
      if (approved && exception.exceptionType === "due_date_exception") {
        obligationPatch.dueAt = exception.proposedDueAt;
      } else if (approved && exception.exceptionType === "waiver") {
        obligationPatch.status = "waived";
      }
      await db.batch([
        claim(
          db,
          c,
          input,
          "obligation",
          c.obligationId,
          c.expectedRevision,
          now,
        ),
        db
          .update(obligations)
          .set(obligationPatch)
          .where(
            and(
              eq(obligations.tenantId, c.tenantId),
              eq(obligations.id, c.obligationId),
              eq(obligations.revision, c.expectedRevision),
            ),
          ),
        db
          .update(obligationExceptions)
          .set({
            status: approved ? "approved" : "denied",
            decisionReason: c.decisionReason,
            revision: c.expectedExceptionRevision + 1,
            decidedBy: input.actor.userId,
            decidedAt: now,
            decisionEventId: input.event.eventId,
            updatedAt: now,
          })
          .where(
            and(
              eq(obligationExceptions.tenantId, c.tenantId),
              eq(obligationExceptions.id, c.exceptionId),
              eq(obligationExceptions.revision, c.expectedExceptionRevision),
              eq(obligationExceptions.status, "requested"),
            ),
          ),
        eventWrite,
        outboxWrite,
      ] as never);
    } else if (c.action === "evaluate_escalation") {
      if (!input.evaluation)
        throw new Error("Escalation evaluation is required");
      const [obligation] = await db
        .select({ dueAt: obligations.dueAt })
        .from(obligations)
        .where(
          and(
            eq(obligations.tenantId, c.tenantId),
            eq(obligations.id, c.obligationId),
          ),
        )
        .limit(1);
      if (!obligation) throw new Error("Obligation does not exist");
      await db.batch([
        claim(
          db,
          c,
          input,
          "obligation",
          c.obligationId,
          c.expectedRevision,
          now,
        ),
        bumpObligation(db, c.tenantId, c.obligationId, c.expectedRevision, now),
        db.insert(obligationEscalations).values({
          id: c.escalationId,
          tenantId: c.tenantId,
          matterId: c.matterId,
          obligationId: c.obligationId,
          level: input.evaluation.level,
          status: "open",
          evaluatedAt: dateOnly(c.asOfDate),
          dueAt: obligation.dueAt,
          businessDaysRemaining: input.evaluation.businessDaysRemaining,
          basis: input.evaluation.basis,
          revision: 1,
          createdBy: input.actor.userId,
          eventId: input.event.eventId,
          createdAt: now,
          updatedAt: now,
        }),
        eventWrite,
        outboxWrite,
      ] as never);
    } else {
      await runOptimisticBatch(db, [
        claim(
          db,
          c,
          input,
          "obligation_escalation",
          c.escalationId,
          c.expectedEscalationRevision,
          now,
        ),
        db
          .update(obligationEscalations)
          .set({
            status: "acknowledged",
            response: c.response,
            revision: c.expectedEscalationRevision + 1,
            acknowledgedBy: input.actor.userId,
            acknowledgedAt: now,
            acknowledgmentEventId: input.event.eventId,
            updatedAt: now,
          })
          .where(
            and(
              eq(obligationEscalations.tenantId, c.tenantId),
              eq(obligationEscalations.id, c.escalationId),
              eq(obligationEscalations.revision, c.expectedEscalationRevision),
              eq(obligationEscalations.status, "open"),
            ),
          ),
        eventWrite,
        outboxWrite,
      ] as never);
    }
  } catch (error) {
    rethrowOptimisticClaimConflict(error);
  }
  return { replayed: false, eventId: input.event.eventId };
}

function claim(
  db: ReturnType<typeof getPreviewDb>,
  command: ObligationGovernanceCommand,
  input: { event: EventEnvelope<Record<string, unknown>>; actor: RequestActor },
  aggregateType: string,
  aggregateId: string,
  expectedRevision: number,
  now: Date,
) {
  return db.insert(optimisticWriteClaims).values({
    id: createId(),
    tenantId: command.tenantId,
    aggregateType,
    aggregateId,
    expectedRevision,
    claimedRevision: expectedRevision + 1,
    actorId: input.actor.userId,
    eventId: input.event.eventId,
    idempotencyKey: command.idempotencyKey,
    createdAt: now,
  });
}

async function runOptimisticBatch(
  db: ReturnType<typeof getPreviewDb>,
  statements: Parameters<typeof db.batch>[0],
) {
  try {
    return await db.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("SQLITE_BUSY")) throw error;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return db.batch(statements);
  }
}

function bumpObligation(
  db: ReturnType<typeof getPreviewDb>,
  tenantId: string,
  obligationId: string,
  revision: number,
  now: Date,
) {
  return db
    .update(obligations)
    .set({ revision: revision + 1, updatedAt: now })
    .where(
      and(
        eq(obligations.tenantId, tenantId),
        eq(obligations.id, obligationId),
        eq(obligations.revision, revision),
      ),
    );
}

function dateOnly(value: string) {
  return new Date(`${value}T17:00:00.000Z`);
}
