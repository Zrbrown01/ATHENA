import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, notInArray } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  closureDecisions,
  matterClosureChecklists,
  matterStatusHistory,
  matterTasks,
  matters,
  previewEvents,
  previewOutbox,
} from "../../db/schema";
import type { ClosureCommand } from "@/domain/closure/lifecycle";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";
export async function readClosure(tenantId: string, matterId: string) {
  const [x] = await getPreviewDb()
    .select()
    .from(matterClosureChecklists)
    .where(
      and(
        eq(matterClosureChecklists.tenantId, tenantId),
        eq(matterClosureChecklists.matterId, matterId),
      ),
    )
    .limit(1);
  return x ?? null;
}
export async function listStatusHistory(tenantId: string, matterId: string) {
  return getPreviewDb()
    .select()
    .from(matterStatusHistory)
    .where(
      and(
        eq(matterStatusHistory.tenantId, tenantId),
        eq(matterStatusHistory.matterId, matterId),
      ),
    )
    .orderBy(asc(matterStatusHistory.occurredAt));
}
export async function countOpenMatterTasks(tenantId: string, matterId: string) {
  const rows = await getPreviewDb()
    .select({ id: matterTasks.id })
    .from(matterTasks)
    .where(
      and(
        eq(matterTasks.tenantId, tenantId),
        eq(matterTasks.matterId, matterId),
        notInArray(matterTasks.status, ["completed", "cancelled"]),
      ),
    );
  return rows.length;
}
export async function readClosureEvent(tenantId: string, key: string) {
  const [x] = await getPreviewDb()
    .select({ eventId: previewEvents.eventId })
    .from(previewEvents)
    .where(
      and(
        eq(previewEvents.tenantId, tenantId),
        eq(previewEvents.idempotencyKey, key),
      ),
    )
    .limit(1);
  return x ?? null;
}
export async function persistClosure(input: {
  command: ClosureCommand;
  nextStatus: "open" | "ready" | "closed" | "reopened";
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
}) {
  const db = getPreviewDb(),
    { command } = input,
    now = new Date(input.event.occurredAt);
  const eventWrite = db
      .insert(previewEvents)
      .values({
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
      }),
    outboxWrite = db
      .insert(previewOutbox)
      .values({
        id: createId(),
        tenantId: command.tenantId,
        eventId: input.event.eventId,
        topic: "athena.closure",
        payload: input.event,
        attempts: 0,
        availableAt: now,
      }),
    decisionWrite = db
      .insert(closureDecisions)
      .values({
        id: createId(),
        tenantId: command.tenantId,
        matterId: command.matterId,
        checklistId: command.checklistId,
        action: command.action,
        item: "item" in command ? command.item : null,
        evidence:
          "evidence" in command
            ? command.evidence
            : "reason" in command
              ? command.reason
              : null,
        actorId: input.actor.userId,
        eventId: input.event.eventId,
        idempotencyKey: command.idempotencyKey,
        createdAt: now,
      });
  if (command.action === "create_checklist") {
    await db.batch([
      db
        .insert(matters)
        .values({
          id: command.matterId,
          tenantId: command.tenantId,
          matterNumber: "NRL-2026-0042",
          caption: "Rivera v. Northstar Logistics",
          status: "open",
          clientName: "Summit Claims Services",
          employerName: "Northstar Logistics, Inc.",
          applicantName: "Elena Rivera",
          assignedAttorneyId: input.actor.userId,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: matters.id }),
      db
        .insert(matterClosureChecklists)
        .values({
          id: command.checklistId,
          tenantId: command.tenantId,
          matterId: command.matterId,
          status: "open",
          revision: 1,
          createdAt: now,
          updatedAt: now,
        }),
      decisionWrite,
      eventWrite,
      outboxWrite,
    ]);
  } else {
    const current = await readClosure(command.tenantId, command.matterId);
    if (!current || current.revision !== command.expectedRevision)
      throw new Error("Closure checklist changed; refresh before retrying");
    const patch: Record<string, unknown> = {
      status: input.nextStatus,
      revision: current.revision + 1,
      updatedAt: now,
    };
    if (command.action === "attest")
      patch[
        (
          {
            settlement: "settlementEvidence",
            final_report: "finalReportEvidence",
            billing: "billingEvidence",
            retention: "retentionEvidence",
            liens: "lienEvidence",
          } as const
        )[command.item]
      ] = command.evidence;
    if (command.action === "close")
      Object.assign(patch, { closedBy: input.actor.userId, closedAt: now });
    if (command.action === "reopen")
      Object.assign(patch, {
        reopenedBy: input.actor.userId,
        reopenedAt: now,
        reopenReason: command.reason,
        reopenSource: command.source,
      });
    const writes: unknown[] = [
      db
        .update(matterClosureChecklists)
        .set(patch)
        .where(
          and(
            eq(matterClosureChecklists.id, current.id),
            eq(matterClosureChecklists.revision, command.expectedRevision),
          ),
        ),
      decisionWrite,
      eventWrite,
      outboxWrite,
    ];
    if (command.action === "close" || command.action === "reopen") {
      const fromStatus = command.action === "close" ? "open" : "closed",
        toStatus = command.action === "close" ? "closed" : "open";
      writes.push(
        db
          .update(matters)
          .set({ status: toStatus, revision: 2, updatedAt: now })
          .where(
            and(
              eq(matters.tenantId, command.tenantId),
              eq(matters.id, command.matterId),
            ),
          ),
        db
          .insert(matterStatusHistory)
          .values({
            id: createId(),
            tenantId: command.tenantId,
            matterId: command.matterId,
            fromStatus,
            toStatus,
            reason: command.reason,
            source:
              command.action === "reopen"
                ? command.source
                : "Athena closure checklist",
            actorId: input.actor.userId,
            eventId: input.event.eventId,
            occurredAt: now,
          }),
      );
      if (command.action === "reopen")
        writes.push(
          db
            .insert(matterTasks)
            .values({
              id: `task-reopen-${input.event.eventId}`,
              tenantId: command.tenantId,
              matterId: command.matterId,
              title: "Review reopening source and reactivate defense plan",
              taskType: "reopening_review",
              priority: "critical",
              ownerId: input.actor.userId,
              dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
              status: "open",
              revision: 1,
              createdAt: now,
              updatedAt: now,
            }),
        );
    }
    await db.batch(writes as never);
  }
  return { replayed: false, eventId: input.event.eventId };
}
