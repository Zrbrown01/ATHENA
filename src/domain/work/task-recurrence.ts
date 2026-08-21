import { z } from "zod";
import { createEvent } from "@/platform/events";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const base = { tenantId: z.string().min(1), matterId: z.string().min(1), seriesId: z.string().min(3).max(120), idempotencyKey: z.string().min(8).max(200) };
export const taskRecurrenceCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_series"), ...base, title: z.string().trim().min(5).max(240), taskType: z.string().trim().min(3).max(80), priority: z.enum(["critical", "high", "normal", "low"]), ownerId: z.string().min(3), cadence: z.enum(["weekly", "monthly"]), interval: z.number().int().min(1).max(12), dayOfMonth: z.number().int().min(1).max(31).nullable().default(null), startsOn: dateOnly, endsOn: dateOnly.nullable().default(null), occurrenceLimit: z.number().int().min(1).max(24), timezone: z.literal("America/Los_Angeles") }),
  z.object({ action: z.literal("activate_series"), ...base, expectedRevision: z.number().int().positive(), approval: z.string().trim().min(12).max(1000) }),
  z.object({ action: z.literal("set_exception"), ...base, expectedRevision: z.number().int().positive(), nominalDueOn: dateOnly, exceptionAction: z.enum(["skip", "move"]), movedDueOn: dateOnly.nullable().default(null), reason: z.string().trim().min(12).max(1000) }),
  z.object({ action: z.literal("materialize_window"), ...base, expectedRevision: z.number().int().positive(), throughDate: dateOnly }),
  z.object({ action: z.literal("cancel_series"), ...base, expectedRevision: z.number().int().positive(), reason: z.string().trim().min(12).max(1000) }),
]);
export type TaskRecurrenceCommand = z.infer<typeof taskRecurrenceCommand>;
export type TaskRecurrenceState = { id: string; status: "draft" | "active" | "cancelled"; revision: number; cadence: "weekly" | "monthly"; interval: number; dayOfMonth: number | null; startsOn: Date; endsOn: Date | null; occurrenceLimit: number; materializedCount: number; lastMaterializedThrough: Date | null; title: string; taskType: string; priority: "critical" | "high" | "normal" | "low"; ownerId: string };
export type RecurrenceSchedule = Pick<TaskRecurrenceState, "cadence" | "interval" | "dayOfMonth" | "startsOn" | "endsOn" | "occurrenceLimit">;
export type RecurrenceException = { nominalDueOn: Date; action: "skip" | "move"; movedDueOn: Date | null };
export type PlannedOccurrence = { id: string; taskId: string | null; sequence: number; nominalDueOn: string; effectiveDueOn: string | null; status: "materialized" | "skipped"; exceptionAction: "none" | "skip" | "move" };

const iso = (date: Date) => date.toISOString().slice(0, 10);
const utcDate = (value: string) => new Date(`${value}T12:00:00.000Z`);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);
function monthlyDate(year: number, month: number, day: number) { return new Date(Date.UTC(year, month, Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()), 12)); }

export function recurrenceNominalDates(series: RecurrenceSchedule, throughDate: string) {
  const through = utcDate(throughDate), result: string[] = [];
  if (series.cadence === "weekly") {
    for (let current = new Date(series.startsOn); current <= through && result.length < series.occurrenceLimit; current = addDays(current, 7 * series.interval)) {
      if (!series.endsOn || current <= series.endsOn) result.push(iso(current));
    }
  } else {
    if (!series.dayOfMonth) throw new Error("Monthly recurrence requires a day of month");
    let year = series.startsOn.getUTCFullYear(), month = series.startsOn.getUTCMonth(), current = monthlyDate(year, month, series.dayOfMonth);
    if (current < series.startsOn) { month += series.interval; year += Math.floor(month / 12); month %= 12; current = monthlyDate(year, month, series.dayOfMonth); }
    while (current <= through && result.length < series.occurrenceLimit) {
      if (series.endsOn && current > series.endsOn) break;
      result.push(iso(current));
      month += series.interval; year += Math.floor(month / 12); month %= 12; current = monthlyDate(year, month, series.dayOfMonth);
    }
  }
  return result;
}

export function planRecurrenceWindow(series: TaskRecurrenceState, throughDate: string, exceptions: RecurrenceException[]): PlannedOccurrence[] {
  const prior = series.lastMaterializedThrough ? iso(series.lastMaterializedThrough) : null;
  const remaining = series.occurrenceLimit - series.materializedCount;
  const dates = recurrenceNominalDates(series, throughDate).filter(date => !prior || date > prior).slice(0, Math.min(12, remaining));
  const exceptionMap = new Map(exceptions.map(item => [iso(item.nominalDueOn), item]));
  return dates.map((nominalDueOn, index) => {
    const exception = exceptionMap.get(nominalDueOn), sequence = series.materializedCount + index + 1;
    const exceptionAction = exception?.action ?? "none";
    const skipped = exceptionAction === "skip";
    const effectiveDueOn = skipped ? null : exceptionAction === "move" && exception?.movedDueOn ? iso(exception.movedDueOn) : nominalDueOn;
    const id = `${series.id}:occ:${nominalDueOn}`;
    return { id, taskId: skipped ? null : `${series.id}-occ-${nominalDueOn}`, sequence, nominalDueOn, effectiveDueOn, status: skipped ? "skipped" : "materialized", exceptionAction };
  });
}

export function decideTaskRecurrence(input: { context: TenantContext; raw: unknown; current?: TaskRecurrenceState | null; exceptions?: RecurrenceException[] }) {
  const command = taskRecurrenceCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId);
  requireRole(input.context, command.action === "materialize_window" || command.action === "create_series" ? ["attorney", "partner", "paralegal", "legal_assistant", "docketing"] : ["attorney", "partner"]);
  if (command.action === "create_series") {
    if (command.cadence === "monthly" && !command.dayOfMonth) throw new Error("Monthly recurrence requires a day of month");
    if (command.cadence === "weekly" && command.dayOfMonth) throw new Error("Weekly recurrence cannot specify a day of month");
    if (command.endsOn && command.endsOn < command.startsOn) throw new Error("Series end date cannot precede its start date");
    return decision(command, "not_created", "draft", [], input.context.userId);
  }
  const current = input.current;
  if (!current || current.id !== command.seriesId) throw new Error("Recurring task series does not exist in this matter scope");
  if (current.revision !== command.expectedRevision) throw new Error("Recurring task series changed; refresh before retrying");
  if (current.status === "cancelled") throw new Error("Recurring task series is cancelled");
  if (command.action === "activate_series" && current.status !== "draft") throw new Error("Only a draft series can be activated");
  if ((command.action === "set_exception" || command.action === "materialize_window") && current.status !== "active") throw new Error("Recurring task series must be active");
  let occurrences: PlannedOccurrence[] = [];
  if (command.action === "set_exception") {
    const valid = recurrenceNominalDates(current, command.nominalDueOn).includes(command.nominalDueOn);
    if (!valid || (current.lastMaterializedThrough && command.nominalDueOn <= iso(current.lastMaterializedThrough))) throw new Error("Exception must target an unmaterialized scheduled occurrence");
    if (command.exceptionAction === "move" && !command.movedDueOn) throw new Error("Moved occurrence requires a new due date");
    if (command.exceptionAction === "skip" && command.movedDueOn) throw new Error("Skipped occurrence cannot include a new due date");
  }
  if (command.action === "materialize_window") {
    if (command.throughDate < iso(current.startsOn)) throw new Error("Materialization window cannot precede the series start");
    occurrences = planRecurrenceWindow(current, command.throughDate, input.exceptions ?? []);
    if (!occurrences.length) throw new Error("No unmaterialized occurrences exist in this window");
  }
  const toStatus = command.action === "activate_series" ? "active" : command.action === "cancel_series" ? "cancelled" : current.status;
  return decision(command, current.status, toStatus, occurrences, input.context.userId);
}

function decision(command: TaskRecurrenceCommand, fromStatus: string, toStatus: string, occurrences: PlannedOccurrence[], actorId: string) {
  const suffix = { create_series: "created", activate_series: "activated", set_exception: "exception_set", materialize_window: "materialized", cancel_series: "cancelled" }[command.action];
  const event = createEvent({ eventType: `task_recurrence.${suffix}`, tenantId: command.tenantId, aggregateType: "task_recurrence_series", aggregateId: command.seriesId, matterId: command.matterId, actorId, correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "internal", retentionPolicy: "matter-lifecycle-plus-firm-retention", payload: { action: command.action, fromStatus, toStatus, occurrenceCount: occurrences.length, humanAuthorized: true, schedulerConnected: false } });
  return { command, fromStatus, toStatus, occurrences, event };
}
