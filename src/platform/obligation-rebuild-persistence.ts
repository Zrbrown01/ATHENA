import { createId } from "@paralleldrive/cuid2";
import { and, asc, desc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  governanceRules,
  obligationDependencies,
  obligationExceptions,
  obligationRebuildFindings,
  obligationRebuildRuns,
  obligations,
  optimisticWriteClaims,
  previewEvents,
  previewOutbox,
} from "../../db/schema";
import type {
  ObligationRebuildCommand,
  RebuildResult,
} from "@/domain/governance/obligation-rebuild";
import type { EventEnvelope } from "./events";
import { rethrowOptimisticClaimConflict } from "./optimistic-concurrency";
import type { RequestActor } from "./request-actor";

export async function readObligationRebuildEvent(
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

export async function readObligationRebuildRun(
  tenantId: string,
  matterId: string,
  id: string,
) {
  const [row] = await getPreviewDb()
    .select()
    .from(obligationRebuildRuns)
    .where(
      and(
        eq(obligationRebuildRuns.tenantId, tenantId),
        eq(obligationRebuildRuns.matterId, matterId),
        eq(obligationRebuildRuns.id, id),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function readObligationRebuildEvidence(
  tenantId: string,
  matterId: string,
) {
  const db = getPreviewDb();
  const [matterObligations, rules, dependencies, exceptions] =
    await Promise.all([
      db
        .select()
        .from(obligations)
        .where(
          and(
            eq(obligations.tenantId, tenantId),
            eq(obligations.matterId, matterId),
          ),
        )
        .orderBy(asc(obligations.createdAt)),
      db
        .select()
        .from(governanceRules)
        .where(eq(governanceRules.tenantId, tenantId))
        .orderBy(asc(governanceRules.code), asc(governanceRules.version)),
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
    ]);
  return { obligations: matterObligations, rules, dependencies, exceptions };
}

export async function obligationRebuildProjection(
  tenantId: string,
  matterId: string,
) {
  const db = getPreviewDb();
  const runs = await db
    .select()
    .from(obligationRebuildRuns)
    .where(
      and(
        eq(obligationRebuildRuns.tenantId, tenantId),
        eq(obligationRebuildRuns.matterId, matterId),
      ),
    )
    .orderBy(desc(obligationRebuildRuns.createdAt))
    .limit(20);
  if (!runs.length) return { runs, findings: [] };
  const findings = await db
    .select()
    .from(obligationRebuildFindings)
    .where(
      and(
        eq(obligationRebuildFindings.tenantId, tenantId),
        eq(obligationRebuildFindings.matterId, matterId),
      ),
    )
    .orderBy(
      desc(obligationRebuildFindings.createdAt),
      asc(obligationRebuildFindings.obligationId),
    );
  return {
    runs,
    findings: findings.filter((finding) =>
      runs.some((run) => run.id === finding.runId),
    ),
  };
}

export async function persistObligationRebuild(input: {
  command: ObligationRebuildCommand;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
  result?: RebuildResult | null;
}) {
  const db = getPreviewDb();
  const c = input.command;
  const now = new Date(input.event.occurredAt);
  const eventWrite = db
    .insert(previewEvents)
    .values({
      eventId: input.event.eventId,
      eventType: input.event.eventType,
      eventVersion: input.event.eventVersion,
      tenantId: c.tenantId,
      aggregateType: input.event.aggregateType,
      aggregateId: input.event.aggregateId,
      matterId: c.matterId,
      actorId: input.actor.userId,
      occurredAt: now,
      correlationId: input.event.correlationId,
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
      topic: "athena.obligation_rebuild",
      payload: input.event,
      attempts: 0,
      availableAt: now,
    });
  try {
    if (c.action === "run_rebuild") {
      if (!input.result) throw new Error("Rebuild result is required");
      await db.batch([
        db
          .insert(obligationRebuildRuns)
          .values({
            id: c.runId,
            tenantId: c.tenantId,
            matterId: c.matterId,
            asOf: dateOnly(c.asOfDate),
            outcome: input.result.outcome,
            status: "pending_review",
            obligationCount: input.result.findings.length,
            matchedCount: input.result.matchedCount,
            driftedCount: input.result.driftedCount,
            blockedCount: input.result.blockedCount,
            revision: 1,
            requestedBy: input.actor.userId,
            runEventId: input.event.eventId,
            createdAt: now,
          }),
        ...input.result.findings.map((finding) =>
          db
            .insert(obligationRebuildFindings)
            .values({
              id: createId(),
              runId: c.runId,
              tenantId: c.tenantId,
              matterId: c.matterId,
              obligationId: finding.obligationId,
              result: finding.result,
              actualDueAt: dateOnly(finding.actualDueDate),
              expectedDueAt: finding.expectedDueDate
                ? dateOnly(finding.expectedDueDate)
                : null,
              actualStatus: finding.actualStatus,
              expectedStatus: finding.expectedStatus,
              ruleCode: finding.ruleCode,
              ruleVersion: finding.ruleVersion,
              dependencyId: finding.dependencyId,
              exceptionIds: finding.exceptionIds,
              reasons: finding.reasons,
              calculation: finding.calculation,
              createdAt: now,
            }),
        ),
        eventWrite,
        outboxWrite,
      ] as never);
    } else {
      await db.batch([
        db
          .insert(optimisticWriteClaims)
          .values({
            id: createId(),
            tenantId: c.tenantId,
            aggregateType: "obligation_rebuild",
            aggregateId: c.runId,
            expectedRevision: c.expectedRevision,
            claimedRevision: c.expectedRevision + 1,
            actorId: input.actor.userId,
            eventId: input.event.eventId,
            idempotencyKey: c.idempotencyKey,
            createdAt: now,
          }),
        db
          .update(obligationRebuildRuns)
          .set({
            status: "reviewed",
            reviewOutcome: c.outcome,
            reviewNotes: c.notes,
            reviewedBy: input.actor.userId,
            reviewedAt: now,
            reviewEventId: input.event.eventId,
            revision: c.expectedRevision + 1,
          })
          .where(
            and(
              eq(obligationRebuildRuns.tenantId, c.tenantId),
              eq(obligationRebuildRuns.matterId, c.matterId),
              eq(obligationRebuildRuns.id, c.runId),
              eq(obligationRebuildRuns.status, "pending_review"),
              eq(obligationRebuildRuns.revision, c.expectedRevision),
            ),
          ),
        eventWrite,
        outboxWrite,
      ] as never);
    }
  } catch (error) {
    rethrowOptimisticClaimConflict(error);
    throw error;
  }
  return { replayed: false, eventId: input.event.eventId };
}

function dateOnly(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}
