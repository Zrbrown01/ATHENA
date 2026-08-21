import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  backupSnapshots,
  previewEvents,
  previewOutbox,
  recoveryApprovals,
  recoveryDecisions,
  recoveryExercises,
  recoveryVerificationChecks,
} from "../../db/schema";
import type { RecoveryCommand } from "@/domain/recovery/exercise";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";
export async function readRecoveryExercise(t: string, id: string) {
  const [x] = await getPreviewDb()
    .select()
    .from(recoveryExercises)
    .where(and(eq(recoveryExercises.tenantId, t), eq(recoveryExercises.id, id)))
    .limit(1);
  return x ?? null;
}
export async function readRecoveryEvent(t: string, key: string) {
  const [x] = await getPreviewDb()
    .select({ eventId: previewEvents.eventId })
    .from(previewEvents)
    .where(
      and(eq(previewEvents.tenantId, t), eq(previewEvents.idempotencyKey, key)),
    )
    .limit(1);
  return x ?? null;
}
export async function recoveryProjection(t: string) {
  const db = getPreviewDb(),
    [snapshots, exercises, checks, approvals, decisions] = await Promise.all([
      db.select().from(backupSnapshots).where(eq(backupSnapshots.tenantId, t)),
      db
        .select()
        .from(recoveryExercises)
        .where(eq(recoveryExercises.tenantId, t))
        .orderBy(asc(recoveryExercises.createdAt)),
      db
        .select()
        .from(recoveryVerificationChecks)
        .where(eq(recoveryVerificationChecks.tenantId, t)),
      db
        .select()
        .from(recoveryApprovals)
        .where(eq(recoveryApprovals.tenantId, t)),
      db
        .select()
        .from(recoveryDecisions)
        .where(eq(recoveryDecisions.tenantId, t))
        .orderBy(asc(recoveryDecisions.createdAt)),
    ]);
  return { snapshots, exercises, checks, approvals, decisions };
}
export async function persistRecovery(input: {
  command: RecoveryCommand;
  fromStatus: string;
  toStatus: string;
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
        topic: "athena.recovery",
        payload: input.event,
        attempts: 0,
        availableAt: now,
      }),
    decisionWrite = db
      .insert(recoveryDecisions)
      .values({
        id: createId(),
        tenantId: c.tenantId,
        exerciseId: c.exerciseId,
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
  if (c.action === "register_local_snapshot") {
    writes.push(
      db
        .insert(backupSnapshots)
        .values({
          id: c.snapshotId,
          tenantId: c.tenantId,
          scope: c.scope,
          sourceType: "local_d1_export",
          providerMode: "local_verified",
          objectRef: c.objectRef,
          sha256: c.snapshotSha256,
          byteSize: c.byteSize,
          tableCount: c.tableCount,
          dataAsOf: new Date(c.dataAsOf),
          immutable: true,
          createdBy: input.actor.userId,
          createdAt: now,
        }),
      db
        .insert(recoveryExercises)
        .values({
          id: c.exerciseId,
          tenantId: c.tenantId,
          snapshotId: c.snapshotId,
          status: "planned",
          targetEnvironment: "disposable-local-not-yet-restored",
          productionMutation: false,
          startedAt: now,
          revision: 1,
          operatorId: input.actor.userId,
          createdAt: now,
          updatedAt: now,
        }),
    );
  } else if (c.action === "record_disposable_restore") {
    writes.push(
      db
        .update(recoveryExercises)
        .set({
          status: "restored",
          targetEnvironment: c.targetEnvironment,
          productionMutation: false,
          completedAt: now,
          durationSeconds: c.durationSeconds,
          rpoSeconds: c.rpoSeconds,
          rtoSeconds: c.rtoSeconds,
          revision: 2,
          updatedAt: now,
        })
        .where(
          and(
            eq(recoveryExercises.tenantId, c.tenantId),
            eq(recoveryExercises.id, c.exerciseId),
            eq(recoveryExercises.revision, 1),
          ),
        ),
    );
  } else if (c.action === "verify_restore") {
    writes.push(
      db
        .update(recoveryExercises)
        .set({
          status: input.toStatus as "verified" | "failed",
          revision: 3,
          updatedAt: now,
        })
        .where(
          and(
            eq(recoveryExercises.tenantId, c.tenantId),
            eq(recoveryExercises.id, c.exerciseId),
            eq(recoveryExercises.revision, 2),
          ),
        ),
      ...c.checks.map((x) =>
        db
          .insert(recoveryVerificationChecks)
          .values({
            id: createId(),
            tenantId: c.tenantId,
            exerciseId: c.exerciseId,
            code: x.code,
            expectedValue: x.expectedValue,
            actualValue: x.actualValue,
            outcome: x.outcome,
            evidenceRef: x.evidenceRef,
            verifiedBy: input.actor.userId,
            createdAt: now,
          }),
      ),
    );
  } else {
    writes.push(
      db
        .update(recoveryExercises)
        .set({ status: "approved", revision: 4, updatedAt: now })
        .where(
          and(
            eq(recoveryExercises.tenantId, c.tenantId),
            eq(recoveryExercises.id, c.exerciseId),
            eq(recoveryExercises.revision, 3),
          ),
        ),
      db
        .insert(recoveryApprovals)
        .values({
          id: c.approvalId,
          tenantId: c.tenantId,
          exerciseId: c.exerciseId,
          outcome: "approved",
          scopeLimitation: c.scopeLimitation,
          notes: c.notes,
          approvedBy: input.actor.userId,
          approvedAt: now,
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
function reason(c: RecoveryCommand) {
  if (c.action === "register_local_snapshot") return c.scope;
  if (c.action === "record_disposable_restore") return c.evidenceRef;
  if (c.action === "verify_restore") return c.reason;
  return c.notes;
}
