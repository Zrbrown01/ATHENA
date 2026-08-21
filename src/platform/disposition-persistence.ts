import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  dispositionApprovals,
  dispositionDecisions,
  dispositionExecutions,
  dispositionRequests,
  dispositionSandboxRecords,
  legalHolds,
  previewEvents,
  previewOutbox,
} from "../../db/schema";
import type { DispositionCommand } from "@/domain/disposition/lifecycle";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";
export async function readDispositionRequest(t: string, id: string) {
  const [x] = await getPreviewDb()
    .select()
    .from(dispositionRequests)
    .where(
      and(eq(dispositionRequests.tenantId, t), eq(dispositionRequests.id, id)),
    )
    .limit(1);
  return x ?? null;
}
export async function readDispositionTarget(t: string, id: string) {
  const [x] = await getPreviewDb()
    .select()
    .from(dispositionSandboxRecords)
    .where(
      and(
        eq(dispositionSandboxRecords.tenantId, t),
        eq(dispositionSandboxRecords.id, id),
      ),
    )
    .limit(1);
  return x ?? null;
}
export async function readDispositionApprovals(t: string, id: string) {
  return getPreviewDb()
    .select()
    .from(dispositionApprovals)
    .where(
      and(
        eq(dispositionApprovals.tenantId, t),
        eq(dispositionApprovals.requestId, id),
      ),
    )
    .orderBy(asc(dispositionApprovals.sequence));
}
export async function countDispositionHolds(t: string, m: string) {
  const rows = await getPreviewDb()
    .select({ id: legalHolds.id })
    .from(legalHolds)
    .where(
      and(
        eq(legalHolds.tenantId, t),
        eq(legalHolds.matterId, m),
        eq(legalHolds.status, "active"),
      ),
    );
  return rows.length;
}
export async function readDispositionEvent(t: string, key: string) {
  const [x] = await getPreviewDb()
    .select({ eventId: previewEvents.eventId })
    .from(previewEvents)
    .where(
      and(eq(previewEvents.tenantId, t), eq(previewEvents.idempotencyKey, key)),
    )
    .limit(1);
  return x ?? null;
}
export async function dispositionProjection(t: string) {
  const db = getPreviewDb(),
    [targets, requests, approvals, executions, decisions] = await Promise.all([
      db
        .select()
        .from(dispositionSandboxRecords)
        .where(eq(dispositionSandboxRecords.tenantId, t)),
      db
        .select()
        .from(dispositionRequests)
        .where(eq(dispositionRequests.tenantId, t)),
      db
        .select()
        .from(dispositionApprovals)
        .where(eq(dispositionApprovals.tenantId, t)),
      db
        .select()
        .from(dispositionExecutions)
        .where(eq(dispositionExecutions.tenantId, t)),
      db
        .select()
        .from(dispositionDecisions)
        .where(eq(dispositionDecisions.tenantId, t))
        .orderBy(asc(dispositionDecisions.createdAt)),
    ]);
  return { targets, requests, approvals, executions, decisions };
}
export async function persistDisposition(input: {
  command: DispositionCommand;
  fromStatus: string;
  toStatus: string;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
  target?: {
    id: string;
    payloadSha256: string;
    syntheticDisposable: boolean;
  } | null;
  legalHoldCount: number;
  approvalCount: number;
}) {
  const db = getPreviewDb(),
    c = input.command,
    now = new Date(input.event.occurredAt),
    eventWrite = db.insert(previewEvents).values({
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
    }),
    outboxWrite = db.insert(previewOutbox).values({
      id: createId(),
      tenantId: c.tenantId,
      eventId: input.event.eventId,
      topic: "athena.disposition",
      payload: input.event,
      attempts: 0,
      availableAt: now,
    }),
    decisionWrite = db.insert(dispositionDecisions).values({
      id: createId(),
      tenantId: c.tenantId,
      requestId: c.requestId,
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
  if (c.action === "materialize_sandbox_candidate") {
    const payloadSha256 = await digest(c.payload);
    writes.push(
      db.insert(dispositionSandboxRecords).values({
        id: c.targetId,
        tenantId: c.tenantId,
        matterId: c.matterId,
        payload: c.payload,
        payloadSha256,
        syntheticDisposable: true,
        createdAt: now,
      }),
      db.insert(dispositionRequests).values({
        id: c.requestId,
        tenantId: c.tenantId,
        matterId: c.matterId,
        targetType: "synthetic_disposable_record",
        targetId: c.targetId,
        status: "draft",
        reason: "Synthetic disposable lifecycle proof.",
        legalHoldCount: 0,
        previewItemCount: 0,
        immutableExclusions: [
          "preview_events",
          "audit_records",
          "disposition_decisions",
          "disposition_approvals",
          "disposition_executions",
        ],
        revision: 1,
        requestedBy: input.actor.userId,
        createdAt: now,
        updatedAt: now,
      }),
    );
  } else if (c.action === "preview_disposition")
    writes.push(
      updateRequest(db, c.tenantId, c.requestId, c.expectedRevision, {
        status: input.toStatus,
        reason: c.reason,
        legalHoldCount: input.legalHoldCount,
        previewItemCount: 1,
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
    );
  else if (c.action === "approve_disposition")
    writes.push(
      db.insert(dispositionApprovals).values({
        id: c.approvalId,
        tenantId: c.tenantId,
        requestId: c.requestId,
        sequence: input.approvalCount + 1,
        outcome: "approved",
        notes: c.notes,
        approverId: input.actor.userId,
        approvedAt: now,
      }),
      updateRequest(db, c.tenantId, c.requestId, c.expectedRevision, {
        status: input.toStatus,
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
    );
  else {
    if (!input.target)
      throw new Error("Disposition target disappeared before execution");
    writes.push(
      db
        .delete(dispositionSandboxRecords)
        .where(
          and(
            eq(dispositionSandboxRecords.tenantId, c.tenantId),
            eq(dispositionSandboxRecords.id, input.target.id),
            eq(dispositionSandboxRecords.syntheticDisposable, true),
          ),
        ),
      db.insert(dispositionExecutions).values({
        id: c.executionId,
        tenantId: c.tenantId,
        requestId: c.requestId,
        deletedItemCount: 1,
        deletedPayloadSha256: input.target.payloadSha256,
        auditRecordsPreserved: true,
        eventRecordsPreserved: true,
        executedBy: input.actor.userId,
        executedAt: now,
      }),
      updateRequest(db, c.tenantId, c.requestId, c.expectedRevision, {
        status: "executed",
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
function updateRequest(
  db: ReturnType<typeof getPreviewDb>,
  t: string,
  id: string,
  revision: number,
  patch: Record<string, unknown>,
) {
  return db
    .update(dispositionRequests)
    .set(patch)
    .where(
      and(
        eq(dispositionRequests.tenantId, t),
        eq(dispositionRequests.id, id),
        eq(dispositionRequests.revision, revision),
      ),
    );
}
async function digest(x: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x));
  return Array.from(new Uint8Array(b), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}
function reason(c: DispositionCommand) {
  if (c.action === "materialize_sandbox_candidate")
    return "Materialized an explicitly synthetic disposable target.";
  if (c.action === "preview_disposition" || c.action === "execute_disposition")
    return c.reason;
  return c.notes;
}
