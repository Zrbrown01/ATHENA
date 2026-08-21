import { z } from "zod";
import { createEvent } from "@/platform/events";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";

const id = z.string().min(3).max(160);
const base = { tenantId: z.string().min(1), matterId: z.string().min(1), idempotencyKey: z.string().min(8).max(200) };
const instant = z.iso.datetime();
const reason = z.string().trim().min(12).max(1500);

export const docketCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("materialize_fixture_docket"), ...base,
    seriesId: id, hearingEventId: id, preparationEventId: id, recurringEventIds: z.array(id).length(3),
    conflictingEventId: id, dependencyId: id, reminderId: id, conflictId: id, syncStateId: id,
    ownerId: id, hearingStart: instant, hearingEnd: instant, preparationStart: instant, preparationEnd: instant,
    recurringStart: instant, recurringEnd: instant, conflictStart: instant, conflictEnd: instant,
    timezone: z.literal("America/Los_Angeles"), sandboxAcknowledged: z.literal(true),
  }).superRefine((value, context) => {
    const ordered = (start: string, end: string) => new Date(end) > new Date(start);
    if (![ordered(value.hearingStart, value.hearingEnd), ordered(value.preparationStart, value.preparationEnd), ordered(value.recurringStart, value.recurringEnd), ordered(value.conflictStart, value.conflictEnd)].every(Boolean)) context.addIssue({ code: "custom", path: ["hearingEnd"], message: "Every event must end after it starts" });
    if (new Date(value.preparationEnd) >= new Date(value.hearingStart)) context.addIssue({ code: "custom", path: ["preparationEnd"], message: "Preparation deadline must precede the hearing" });
    if (!overlaps(value.recurringStart, value.recurringEnd, value.conflictStart, value.conflictEnd)) context.addIssue({ code: "custom", path: ["conflictStart"], message: "Fixture conflict must actually overlap" });
  }),
  z.object({ action: z.literal("acknowledge_reminder"), ...base, reminderId: id, expectedRevision: z.number().int().positive(), reason }),
  z.object({ action: z.literal("resolve_conflict"), ...base, conflictId: id, expectedRevision: z.number().int().positive(), resolution: z.enum(["reschedule_required", "accepted_with_reason"]), reason }),
  z.object({ action: z.literal("record_sync_block"), ...base, syncStateId: id, expectedRevision: z.number().int().positive(), reason }),
]);

export type DocketCommand = z.infer<typeof docketCommand>;
export type ReminderState = { id: string; status: "scheduled" | "acknowledged" | "cancelled"; revision: number };
export type ConflictState = { id: string; status: "open" | "reschedule_required" | "accepted_with_reason"; revision: number };
export type SyncState = { id: string; status: "not_connected" | "connected" | "revoked" | "error"; providerMode: "not_connected" | "live"; revision: number };

export function overlaps(firstStart: string, firstEnd: string, secondStart: string, secondEnd: string) {
  return new Date(firstStart) < new Date(secondEnd) && new Date(secondStart) < new Date(firstEnd);
}

export function decideDocket(input: { context: TenantContext; raw: unknown; targetExists?: boolean; reminder?: ReminderState | null; conflict?: ConflictState | null; syncState?: SyncState | null }) {
  const command = docketCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId);
  requireRole(input.context, ["attorney", "partner", "docketing_specialist"]);
  let aggregateType = "calendar_docket";
  const aggregateId = command.action === "materialize_fixture_docket" ? command.seriesId : command.action === "acknowledge_reminder" ? command.reminderId : command.action === "resolve_conflict" ? command.conflictId : command.syncStateId;
  let fromStatus = "not_created";
  let toStatus = "active";

  if (command.action === "materialize_fixture_docket") {
    if (input.targetExists) throw new Error("Calendar fixture identity already exists");
    toStatus = "materialized";
  } else if (command.action === "acknowledge_reminder") {
    aggregateType = "calendar_reminder";
    const current = input.reminder;
    if (!current || current.revision !== command.expectedRevision) throw new Error("Reminder changed; refresh before retrying");
    if (current.status !== "scheduled") throw new Error("Only a scheduled reminder can be acknowledged");
    fromStatus = current.status;
    toStatus = "acknowledged";
  } else if (command.action === "resolve_conflict") {
    aggregateType = "calendar_conflict";
    const current = input.conflict;
    if (!current || current.revision !== command.expectedRevision) throw new Error("Conflict changed; refresh before retrying");
    if (current.status !== "open") throw new Error("Only an open conflict can be resolved");
    fromStatus = current.status;
    toStatus = command.resolution;
  } else {
    aggregateType = "calendar_sync_state";
    const current = input.syncState;
    if (!current || current.revision !== command.expectedRevision) throw new Error("Calendar sync state changed; refresh before retrying");
    if (current.status !== "not_connected" || current.providerMode !== "not_connected") throw new Error("A sync block is valid only while Microsoft is not connected");
    fromStatus = current.status;
    toStatus = "not_connected";
  }

  const event = createEvent({
    eventType: `calendar.${({ materialize_fixture_docket: "fixture_docket_materialized", acknowledge_reminder: "reminder_acknowledged", resolve_conflict: "conflict_resolved", record_sync_block: "sync_blocked" } as const)[command.action]}`,
    tenantId: command.tenantId, aggregateType, aggregateId, matterId: command.matterId, actorId: input.context.userId,
    correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "internal",
    retentionPolicy: "matter-lifecycle-plus-firm-retention",
    payload: { action: command.action, fromStatus, toStatus, humanAuthorized: true, microsoftConnected: false, providerWriteAttempted: false, recurrenceExpandedLocally: command.action === "materialize_fixture_docket" },
  });
  return { command, aggregateType, aggregateId, fromStatus, toStatus, event };
}
