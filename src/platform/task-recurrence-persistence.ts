import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { matterTasks, optimisticWriteClaims, previewEvents, previewOutbox, taskRecurrenceDecisions, taskRecurrenceExceptions, taskRecurrenceOccurrences, taskRecurrenceSeries } from "../../db/schema";
import type { PlannedOccurrence, TaskRecurrenceCommand } from "@/domain/work/task-recurrence";
import type { EventEnvelope } from "./events";
import { rethrowOptimisticClaimConflict } from "./optimistic-concurrency";
import type { RequestActor } from "./request-actor";

export async function listTaskRecurrenceProjection(tenantId: string, matterId: string) {
  const db = getPreviewDb();
  const [series, exceptions, occurrences] = await Promise.all([
    db.select().from(taskRecurrenceSeries).where(and(eq(taskRecurrenceSeries.tenantId, tenantId), eq(taskRecurrenceSeries.matterId, matterId))).orderBy(asc(taskRecurrenceSeries.createdAt)),
    db.select().from(taskRecurrenceExceptions).where(and(eq(taskRecurrenceExceptions.tenantId, tenantId), eq(taskRecurrenceExceptions.matterId, matterId))).orderBy(asc(taskRecurrenceExceptions.nominalDueOn)),
    db.select().from(taskRecurrenceOccurrences).where(and(eq(taskRecurrenceOccurrences.tenantId, tenantId), eq(taskRecurrenceOccurrences.matterId, matterId))).orderBy(asc(taskRecurrenceOccurrences.sequence)),
  ]);
  return { series, exceptions, occurrences };
}

export async function readTaskRecurrenceSeries(tenantId: string, matterId: string, seriesId: string) {
  const [row] = await getPreviewDb().select().from(taskRecurrenceSeries).where(and(eq(taskRecurrenceSeries.tenantId, tenantId), eq(taskRecurrenceSeries.matterId, matterId), eq(taskRecurrenceSeries.id, seriesId))).limit(1);
  return row ?? null;
}

export async function listTaskRecurrenceExceptions(tenantId: string, matterId: string, seriesId: string) {
  return getPreviewDb().select().from(taskRecurrenceExceptions).where(and(eq(taskRecurrenceExceptions.tenantId, tenantId), eq(taskRecurrenceExceptions.matterId, matterId), eq(taskRecurrenceExceptions.seriesId, seriesId))).orderBy(asc(taskRecurrenceExceptions.nominalDueOn));
}

export async function readTaskRecurrenceEvent(tenantId: string, idempotencyKey: string) {
  const [row] = await getPreviewDb().select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, tenantId), eq(previewEvents.idempotencyKey, idempotencyKey))).limit(1);
  return row ?? null;
}

export async function persistTaskRecurrenceDecision(input: { command: TaskRecurrenceCommand; fromStatus: string; toStatus: string; occurrences: PlannedOccurrence[]; event: EventEnvelope<Record<string, unknown>>; actor: RequestActor }) {
  const db = getPreviewDb(), { command } = input, now = new Date(input.event.occurredAt);
  const prior = await readTaskRecurrenceEvent(command.tenantId, command.idempotencyKey);
  if (prior) return { replayed: true, eventId: prior.eventId };
  const eventWrite = db.insert(previewEvents).values({ eventId: input.event.eventId, eventType: input.event.eventType, eventVersion: input.event.eventVersion, tenantId: input.event.tenantId, aggregateType: input.event.aggregateType, aggregateId: input.event.aggregateId, matterId: input.event.matterId, actorId: input.actor.userId, occurredAt: now, correlationId: input.event.correlationId, causationId: input.event.causationId, idempotencyKey: input.event.idempotencyKey, source: input.event.source, visibility: input.event.visibility, retentionPolicy: input.event.retentionPolicy, payload: input.event.payload });
  const outboxWrite = db.insert(previewOutbox).values({ id: createId(), tenantId: command.tenantId, eventId: input.event.eventId, topic: "athena.task-recurrence", payload: input.event, attempts: 0, availableAt: now });
  const detail = command.action === "materialize_window" ? `${input.occurrences.length} occurrence(s) through ${command.throughDate}` : command.action === "set_exception" ? `${command.exceptionAction} ${command.nominalDueOn}: ${command.reason}` : "approval" in command ? command.approval : "reason" in command ? command.reason : null;
  const decisionWrite = db.insert(taskRecurrenceDecisions).values({ id: createId(), tenantId: command.tenantId, matterId: command.matterId, seriesId: command.seriesId, action: command.action, fromStatus: input.fromStatus, toStatus: input.toStatus, detail, actorId: input.actor.userId, eventId: input.event.eventId, idempotencyKey: command.idempotencyKey, createdAt: now });
  if (command.action === "create_series") {
    await db.batch([db.insert(taskRecurrenceSeries).values({ id: command.seriesId, tenantId: command.tenantId, matterId: command.matterId, title: command.title, taskType: command.taskType, priority: command.priority, ownerId: command.ownerId, cadence: command.cadence, interval: command.interval, dayOfMonth: command.dayOfMonth, startsOn: new Date(`${command.startsOn}T12:00:00.000Z`), endsOn: command.endsOn ? new Date(`${command.endsOn}T12:00:00.000Z`) : null, occurrenceLimit: command.occurrenceLimit, timezone: command.timezone, status: "draft", materializedCount: 0, revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now }), decisionWrite, eventWrite, outboxWrite] as never);
    return { replayed: false, eventId: input.event.eventId };
  }
  const current = await readTaskRecurrenceSeries(command.tenantId, command.matterId, command.seriesId);
  if (!current || current.revision !== command.expectedRevision) throw new Error("Recurring task series changed; refresh before retrying");
  const claim = db.insert(optimisticWriteClaims).values({ id: createId(), tenantId: command.tenantId, aggregateType: "task_recurrence_series", aggregateId: command.seriesId, expectedRevision: command.expectedRevision, claimedRevision: command.expectedRevision + 1, actorId: input.actor.userId, eventId: input.event.eventId, idempotencyKey: command.idempotencyKey, createdAt: now });
  const patch = { status: input.toStatus as "draft" | "active" | "cancelled", revision: current.revision + 1, updatedAt: now, approvedBy: command.action === "activate_series" ? input.actor.userId : current.approvedBy, approvedAt: command.action === "activate_series" ? now : current.approvedAt, cancelledBy: command.action === "cancel_series" ? input.actor.userId : current.cancelledBy, cancelledAt: command.action === "cancel_series" ? now : current.cancelledAt, cancellationReason: command.action === "cancel_series" ? command.reason : current.cancellationReason, lastMaterializedThrough: command.action === "materialize_window" ? new Date(`${input.occurrences.at(-1)!.nominalDueOn}T12:00:00.000Z`) : current.lastMaterializedThrough, materializedCount: command.action === "materialize_window" ? current.materializedCount + input.occurrences.length : current.materializedCount };
  const writes: unknown[] = [claim, db.update(taskRecurrenceSeries).set(patch).where(and(eq(taskRecurrenceSeries.tenantId, command.tenantId), eq(taskRecurrenceSeries.id, command.seriesId), eq(taskRecurrenceSeries.revision, command.expectedRevision)))];
  if (command.action === "set_exception") writes.push(db.insert(taskRecurrenceExceptions).values({ id: `${command.seriesId}:exception:${command.nominalDueOn}`, tenantId: command.tenantId, matterId: command.matterId, seriesId: command.seriesId, nominalDueOn: new Date(`${command.nominalDueOn}T12:00:00.000Z`), action: command.exceptionAction, movedDueOn: command.movedDueOn ? new Date(`${command.movedDueOn}T12:00:00.000Z`) : null, reason: command.reason, actorId: input.actor.userId, eventId: input.event.eventId, createdAt: now }));
  if (command.action === "materialize_window") for (const occurrence of input.occurrences) {
    writes.push(db.insert(taskRecurrenceOccurrences).values({ id: occurrence.id, tenantId: command.tenantId, matterId: command.matterId, seriesId: command.seriesId, taskId: occurrence.taskId, sequence: occurrence.sequence, nominalDueOn: new Date(`${occurrence.nominalDueOn}T12:00:00.000Z`), effectiveDueOn: occurrence.effectiveDueOn ? new Date(`${occurrence.effectiveDueOn}T12:00:00.000Z`) : null, status: occurrence.status, exceptionAction: occurrence.exceptionAction, eventId: input.event.eventId, createdAt: now }));
    if (occurrence.taskId && occurrence.effectiveDueOn) writes.push(db.insert(matterTasks).values({ id: occurrence.taskId, tenantId: command.tenantId, matterId: command.matterId, title: current.title, taskType: current.taskType, priority: current.priority, ownerId: current.ownerId, dueAt: new Date(`${occurrence.effectiveDueOn}T17:00:00.000Z`), status: "open", recurrenceSeriesId: current.id, recurrenceOccurrenceId: occurrence.id, revision: 1, createdAt: now, updatedAt: now }));
  }
  writes.push(decisionWrite, eventWrite, outboxWrite);
  try { await db.batch(writes as never); } catch (error) { rethrowOptimisticClaimConflict(error); }
  return { replayed: false, eventId: input.event.eventId };
}
