import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { calendarConflicts, calendarDecisions, calendarEventDependencies, calendarEvents, calendarReminders, calendarSeries, calendarSyncStates, previewEvents, previewOutbox } from "../../db/schema";
import type { DocketCommand } from "@/domain/calendar/docket";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export async function readCalendarSeries(tenantId: string, matterId: string, seriesId: string) {
  const [row] = await getPreviewDb().select().from(calendarSeries).where(and(eq(calendarSeries.tenantId, tenantId), eq(calendarSeries.matterId, matterId), eq(calendarSeries.id, seriesId))).limit(1);
  return row ?? null;
}
export async function readCalendarReminder(tenantId: string, matterId: string, reminderId: string) {
  const [row] = await getPreviewDb().select().from(calendarReminders).where(and(eq(calendarReminders.tenantId, tenantId), eq(calendarReminders.matterId, matterId), eq(calendarReminders.id, reminderId))).limit(1);
  return row ?? null;
}
export async function readCalendarConflict(tenantId: string, matterId: string, conflictId: string) {
  const [row] = await getPreviewDb().select().from(calendarConflicts).where(and(eq(calendarConflicts.tenantId, tenantId), eq(calendarConflicts.matterId, matterId), eq(calendarConflicts.id, conflictId))).limit(1);
  return row ?? null;
}
export async function readCalendarSyncState(tenantId: string, syncStateId: string) {
  const [row] = await getPreviewDb().select().from(calendarSyncStates).where(and(eq(calendarSyncStates.tenantId, tenantId), eq(calendarSyncStates.id, syncStateId))).limit(1);
  return row ?? null;
}
export async function readCalendarEventEnvelope(tenantId: string, idempotencyKey: string) {
  const [row] = await getPreviewDb().select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, tenantId), eq(previewEvents.idempotencyKey, idempotencyKey))).limit(1);
  return row ?? null;
}

export async function calendarProjection(tenantId: string, matterId: string) {
  const db = getPreviewDb();
  const [series, events, dependencies, reminders, conflicts, syncStates, decisions] = await Promise.all([
    db.select().from(calendarSeries).where(and(eq(calendarSeries.tenantId, tenantId), eq(calendarSeries.matterId, matterId))).orderBy(asc(calendarSeries.startsAt)),
    db.select().from(calendarEvents).where(and(eq(calendarEvents.tenantId, tenantId), eq(calendarEvents.matterId, matterId))).orderBy(asc(calendarEvents.startsAt)),
    db.select().from(calendarEventDependencies).where(and(eq(calendarEventDependencies.tenantId, tenantId), eq(calendarEventDependencies.matterId, matterId))).orderBy(asc(calendarEventDependencies.createdAt)),
    db.select().from(calendarReminders).where(and(eq(calendarReminders.tenantId, tenantId), eq(calendarReminders.matterId, matterId))).orderBy(asc(calendarReminders.remindAt)),
    db.select().from(calendarConflicts).where(and(eq(calendarConflicts.tenantId, tenantId), eq(calendarConflicts.matterId, matterId))).orderBy(asc(calendarConflicts.createdAt)),
    db.select().from(calendarSyncStates).where(eq(calendarSyncStates.tenantId, tenantId)).orderBy(asc(calendarSyncStates.createdAt)),
    db.select().from(calendarDecisions).where(and(eq(calendarDecisions.tenantId, tenantId), eq(calendarDecisions.matterId, matterId))).orderBy(asc(calendarDecisions.createdAt)),
  ]);
  const relevantOwners = new Set(events.map((event) => event.ownerId));
  return { series, events, dependencies, reminders, conflicts, syncStates: syncStates.filter((state) => relevantOwners.has(state.calendarOwnerId)), decisions };
}

export async function persistDocket(input: { command: DocketCommand; aggregateType: string; aggregateId: string; fromStatus: string; toStatus: string; event: EventEnvelope<Record<string, unknown>>; actor: RequestActor }) {
  const db = getPreviewDb();
  const c = input.command;
  const now = new Date(input.event.occurredAt);
  const eventWrite = db.insert(previewEvents).values(eventValues(input.event));
  const outboxWrite = db.insert(previewOutbox).values({ id: createId(), tenantId: c.tenantId, eventId: input.event.eventId, topic: "athena.calendar", payload: input.event, attempts: 0, availableAt: now });
  const decisionWrite = db.insert(calendarDecisions).values({ id: createId(), tenantId: c.tenantId, matterId: c.matterId, aggregateType: input.aggregateType, aggregateId: input.aggregateId, action: c.action, fromStatus: input.fromStatus, toStatus: input.toStatus, reason: "reason" in c ? c.reason : "Acknowledged deterministic sandbox docket fixture and local recurrence expansion.", actorId: input.actor.userId, eventId: input.event.eventId, idempotencyKey: c.idempotencyKey, createdAt: now });

  if (c.action === "materialize_fixture_docket") {
    const recurrenceStart = new Date(c.recurringStart);
    const recurrenceEnd = new Date(c.recurringEnd);
    const recurrenceDuration = recurrenceEnd.getTime() - recurrenceStart.getTime();
    const occurrenceWrites = c.recurringEventIds.map((id, index) => {
      const startsAt = new Date(recurrenceStart.getTime() + index * 7 * 86_400_000);
      return db.insert(calendarEvents).values({ id, tenantId: c.tenantId, matterId: c.matterId, seriesId: c.seriesId, parentEventId: null, eventKind: "client_call", title: `Weekly Rivera strategy call · occurrence ${index + 1}`, startsAt, endsAt: new Date(startsAt.getTime() + recurrenceDuration), allDay: false, timezone: c.timezone, location: "Athena private pilot", ownerId: c.ownerId, status: "scheduled", sourceType: "synthetic_firm_workflow", sourceId: `${c.seriesId}:${index + 1}`, externalProviderId: null, revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now });
    });
    await db.batch([
      db.insert(calendarSeries).values({ id: c.seriesId, tenantId: c.tenantId, matterId: c.matterId, title: "Weekly Rivera strategy call", recurrenceRule: "FREQ=WEEKLY;COUNT=3", timezone: c.timezone, startsAt: recurrenceStart, endsAt: recurrenceEnd, occurrenceCount: 3, status: "active", providerMode: "deterministic_sandbox", revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now }),
      db.insert(calendarEvents).values({ id: c.hearingEventId, tenantId: c.tenantId, matterId: c.matterId, seriesId: null, parentEventId: null, eventKind: "hearing", title: "MSC — Rivera v. Northstar", startsAt: new Date(c.hearingStart), endsAt: new Date(c.hearingEnd), allDay: false, timezone: c.timezone, location: "Los Angeles WCAB · synthetic room 405", ownerId: c.ownerId, status: "scheduled", sourceType: "synthetic_proceeding", sourceId: "proceeding-msc-golden-001", externalProviderId: null, revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now }),
      db.insert(calendarEvents).values({ id: c.preparationEventId, tenantId: c.tenantId, matterId: c.matterId, seriesId: null, parentEventId: c.hearingEventId, eventKind: "preparation", title: "MSC packet and authority review deadline", startsAt: new Date(c.preparationStart), endsAt: new Date(c.preparationEnd), allDay: false, timezone: c.timezone, location: "Athena", ownerId: c.ownerId, status: "scheduled", sourceType: "synthetic_firm_workflow", sourceId: c.dependencyId, externalProviderId: null, revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now }),
      ...occurrenceWrites,
      db.insert(calendarEvents).values({ id: c.conflictingEventId, tenantId: c.tenantId, matterId: c.matterId, seriesId: null, parentEventId: null, eventKind: "deposition", title: "Applicant deposition — conflict fixture", startsAt: new Date(c.conflictStart), endsAt: new Date(c.conflictEnd), allDay: false, timezone: c.timezone, location: "Remote · provider not connected", ownerId: c.ownerId, status: "scheduled", sourceType: "synthetic_conflict_fixture", sourceId: c.conflictId, externalProviderId: null, revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now }),
      db.insert(calendarEventDependencies).values({ id: c.dependencyId, tenantId: c.tenantId, matterId: c.matterId, parentEventId: c.hearingEventId, childEventId: c.preparationEventId, relationType: "preparation_for", offsetDays: -2, calculationBasis: "Synthetic firm workflow offset only; not a statutory deadline and pending attorney-approved content.", createdAt: now }),
      db.insert(calendarReminders).values({ id: c.reminderId, tenantId: c.tenantId, matterId: c.matterId, eventId: c.hearingEventId, channel: "in_app", offsetMinutes: 1440, remindAt: new Date(new Date(c.hearingStart).getTime() - 86_400_000), status: "scheduled", revision: 1, createdAt: now, updatedAt: now }),
      db.insert(calendarConflicts).values({ id: c.conflictId, tenantId: c.tenantId, matterId: c.matterId, eventId: c.recurringEventIds[0], conflictingEventId: c.conflictingEventId, conflictType: "owner_overlap", status: "open", explanation: "The same owner is scheduled for overlapping local events from 10:15–10:30 AM Pacific.", revision: 1, createdAt: now, updatedAt: now }),
      db.insert(calendarSyncStates).values({ id: c.syncStateId, tenantId: c.tenantId, provider: "microsoft_365", calendarOwnerId: c.ownerId, status: "not_connected", providerMode: "not_connected", grantedScopes: [], deltaCursor: null, subscriptionId: null, lastSuccessfulSyncAt: null, healthDetail: "Microsoft OAuth, calendar scopes, subscriptions, delta recovery, revocation, write reconciliation, and external event IDs are unavailable.", createdAt: now, updatedAt: now, revision: 1 }).onConflictDoUpdate({ target: [calendarSyncStates.tenantId, calendarSyncStates.provider, calendarSyncStates.calendarOwnerId], set: { status: "not_connected", providerMode: "not_connected", grantedScopes: [], deltaCursor: null, subscriptionId: null, lastSuccessfulSyncAt: null, updatedAt: now } }),
      decisionWrite, eventWrite, outboxWrite,
    ]);
  } else if (c.action === "acknowledge_reminder") {
    const current = await readCalendarReminder(c.tenantId, c.matterId, c.reminderId);
    if (!current) throw new Error("Reminder does not exist");
    await db.batch([db.update(calendarReminders).set({ status: "acknowledged", acknowledgedBy: input.actor.userId, acknowledgedAt: now, revision: current.revision + 1, updatedAt: now }).where(and(eq(calendarReminders.tenantId, c.tenantId), eq(calendarReminders.matterId, c.matterId), eq(calendarReminders.id, c.reminderId), eq(calendarReminders.revision, c.expectedRevision))), decisionWrite, eventWrite, outboxWrite]);
  } else if (c.action === "resolve_conflict") {
    const current = await readCalendarConflict(c.tenantId, c.matterId, c.conflictId);
    if (!current) throw new Error("Calendar conflict does not exist");
    await db.batch([db.update(calendarConflicts).set({ status: c.resolution, resolutionReason: c.reason, resolvedBy: input.actor.userId, resolvedAt: now, revision: current.revision + 1, updatedAt: now }).where(and(eq(calendarConflicts.tenantId, c.tenantId), eq(calendarConflicts.matterId, c.matterId), eq(calendarConflicts.id, c.conflictId), eq(calendarConflicts.revision, c.expectedRevision))), decisionWrite, eventWrite, outboxWrite]);
  } else {
    const current = await readCalendarSyncState(c.tenantId, c.syncStateId);
    if (!current) throw new Error("Calendar sync state does not exist");
    await db.batch([db.update(calendarSyncStates).set({ status: "not_connected", providerMode: "not_connected", grantedScopes: [], deltaCursor: null, subscriptionId: null, lastSuccessfulSyncAt: null, healthDetail: c.reason, revision: current.revision + 1, updatedAt: now }).where(and(eq(calendarSyncStates.tenantId, c.tenantId), eq(calendarSyncStates.id, c.syncStateId), eq(calendarSyncStates.revision, c.expectedRevision))), decisionWrite, eventWrite, outboxWrite]);
  }
  return { replayed: false, eventId: input.event.eventId };
}

function eventValues(event: EventEnvelope<Record<string, unknown>>) { return { eventId: event.eventId, eventType: event.eventType, eventVersion: event.eventVersion, tenantId: event.tenantId, aggregateType: event.aggregateType, aggregateId: event.aggregateId, matterId: event.matterId, actorId: event.actorId, occurredAt: new Date(event.occurredAt), correlationId: event.correlationId, causationId: event.causationId, idempotencyKey: event.idempotencyKey, source: event.source, visibility: event.visibility, retentionPolicy: event.retentionPolicy, payload: event.payload }; }
