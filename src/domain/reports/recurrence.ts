import { z } from "zod";
import { createEvent } from "@/platform/events";
import { recurrenceNominalDates, type RecurrenceSchedule } from "@/domain/work/task-recurrence";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/), id = z.string().min(3).max(160);
const sectionCode = z.enum(["matter_identity", "current_posture", "medical_status", "authority", "upcoming_events", "legal_spend"]);
const sectionTemplate = z.object({ sectionCode, title: z.string().min(4).max(160), body: z.string().min(20).max(10_000), sourceRecordIds: z.array(id).min(1).max(20) });
const base = { tenantId: z.string().min(1), matterId: z.string().min(1), seriesId: id, idempotencyKey: z.string().min(8).max(200) };
export const reportRecurrenceCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_series"), ...base, definitionId: id, definitionCode: z.literal("SUMMIT-RECURRING-STATUS"), titlePattern: z.string().min(8).max(240), recipientAddresses: z.array(z.email()).min(1).max(10), sectionTemplates: z.array(sectionTemplate).length(6), cadence: z.enum(["weekly", "monthly"]), interval: z.number().int().min(1).max(12), dayOfMonth: z.number().int().min(1).max(31).nullable().default(null), startsOn: dateOnly, endsOn: dateOnly.nullable().default(null), occurrenceLimit: z.number().int().min(1).max(12), timezone: z.literal("America/Los_Angeles"), sandboxAcknowledged: z.literal(true) }),
  z.object({ action: z.literal("activate_series"), ...base, expectedRevision: z.number().int().positive(), approval: z.string().trim().min(12).max(1500) }),
  z.object({ action: z.literal("set_exception"), ...base, expectedRevision: z.number().int().positive(), nominalDueOn: dateOnly, exceptionAction: z.enum(["skip", "move"]), movedDueOn: dateOnly.nullable().default(null), reason: z.string().trim().min(12).max(1500) }),
  z.object({ action: z.literal("materialize_window"), ...base, expectedRevision: z.number().int().positive(), throughDate: dateOnly }),
  z.object({ action: z.literal("cancel_series"), ...base, expectedRevision: z.number().int().positive(), reason: z.string().trim().min(12).max(1500) }),
]);
export type ReportRecurrenceCommand = z.infer<typeof reportRecurrenceCommand>;
export type ReportSectionTemplate = z.infer<typeof sectionTemplate>;
export type ReportRecurrenceState = RecurrenceSchedule & { id: string; status: "draft" | "active" | "cancelled"; revision: number; definitionId: string; definitionCode: string; titlePattern: string; recipientAddresses: string[]; sectionTemplates: ReportSectionTemplate[]; materializedCount: number; lastMaterializedThrough: Date | null };
export type ReportRecurrenceException = { nominalDueOn: Date; action: "skip" | "move"; movedDueOn: Date | null };
export type PlannedReportOccurrence = { id: string; reportInstanceId: string | null; sequence: number; nominalDueOn: string; effectiveDueOn: string | null; status: "materialized" | "skipped"; exceptionAction: "none" | "skip" | "move" };
const requiredCodes = sectionCode.options;
const iso = (date: Date) => date.toISOString().slice(0, 10);

export function planReportRecurrenceWindow(series: ReportRecurrenceState, throughDate: string, exceptions: ReportRecurrenceException[]) {
  const prior = series.lastMaterializedThrough ? iso(series.lastMaterializedThrough) : null, remaining = series.occurrenceLimit - series.materializedCount;
  const dates = recurrenceNominalDates(series, throughDate).filter(date => !prior || date > prior).slice(0, Math.min(6, remaining));
  const exceptionMap = new Map(exceptions.map(item => [iso(item.nominalDueOn), item]));
  return dates.map((nominalDueOn, index): PlannedReportOccurrence => {
    const exception = exceptionMap.get(nominalDueOn), exceptionAction = exception?.action ?? "none", skipped = exceptionAction === "skip";
    const effectiveDueOn = skipped ? null : exceptionAction === "move" && exception?.movedDueOn ? iso(exception.movedDueOn) : nominalDueOn;
    return { id: `${series.id}:occ:${nominalDueOn}`, reportInstanceId: skipped ? null : `${series.id}-report-${nominalDueOn}`, sequence: series.materializedCount + index + 1, nominalDueOn, effectiveDueOn, status: skipped ? "skipped" : "materialized", exceptionAction };
  });
}

export function decideReportRecurrence(input: { context: TenantContext; raw: unknown; current?: ReportRecurrenceState | null; exceptions?: ReportRecurrenceException[]; definitionContentStatus?: "synthetic_sandbox" | "pending_attorney_review" | "attorney_approved" | null }) {
  const command = reportRecurrenceCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId);
  requireRole(input.context, command.action === "create_series" || command.action === "materialize_window" ? ["attorney", "partner", "paralegal"] : ["attorney", "partner"]);
  if (command.action === "create_series") {
    const codes = command.sectionTemplates.map(item => item.sectionCode);
    if (new Set(codes).size !== requiredCodes.length || !requiredCodes.every(code => codes.includes(code))) throw new Error("Recurring report template must contain every required section exactly once");
    if (!command.titlePattern.includes("{due_date}")) throw new Error("Recurring report title must include {due_date}");
    if (command.cadence === "monthly" && !command.dayOfMonth) throw new Error("Monthly recurrence requires a day of month");
    if (command.cadence === "weekly" && command.dayOfMonth) throw new Error("Weekly recurrence cannot specify a day of month");
    if (command.endsOn && command.endsOn < command.startsOn) throw new Error("Series end date cannot precede its start date");
    return decision(command, "not_created", "draft", [], input.context.userId);
  }
  const current = input.current;
  if (!current || current.id !== command.seriesId) throw new Error("Recurring report series does not exist in this matter scope");
  if (current.revision !== command.expectedRevision) throw new Error("Recurring report series changed; refresh before retrying");
  if (current.status === "cancelled") throw new Error("Recurring report series is cancelled");
  if (command.action === "activate_series") {
    if (current.status !== "draft") throw new Error("Only a draft report series can be activated");
    if (!input.definitionContentStatus || input.definitionContentStatus === "pending_attorney_review") throw new Error("Report definition content is not approved for this environment");
  }
  if ((command.action === "set_exception" || command.action === "materialize_window") && current.status !== "active") throw new Error("Recurring report series must be active");
  if (command.action === "set_exception") {
    const valid = recurrenceNominalDates(current, command.nominalDueOn).includes(command.nominalDueOn);
    if (!valid || (current.lastMaterializedThrough && command.nominalDueOn <= iso(current.lastMaterializedThrough))) throw new Error("Exception must target an unmaterialized scheduled report");
    if (command.exceptionAction === "move" && !command.movedDueOn) throw new Error("Moved report requires a new due date");
    if (command.exceptionAction === "skip" && command.movedDueOn) throw new Error("Skipped report cannot include a new due date");
  }
  let occurrences: PlannedReportOccurrence[] = [];
  if (command.action === "materialize_window") {
    if (command.throughDate < iso(current.startsOn)) throw new Error("Materialization window cannot precede the series start");
    occurrences = planReportRecurrenceWindow(current, command.throughDate, input.exceptions ?? []);
    if (!occurrences.length) throw new Error("No unmaterialized reports exist in this window");
  }
  const toStatus = command.action === "activate_series" ? "active" : command.action === "cancel_series" ? "cancelled" : current.status;
  return decision(command, current.status, toStatus, occurrences, input.context.userId);
}

function decision(command: ReportRecurrenceCommand, fromStatus: string, toStatus: string, occurrences: PlannedReportOccurrence[], actorId: string) {
  const suffix = { create_series: "created", activate_series: "activated", set_exception: "exception_set", materialize_window: "materialized", cancel_series: "cancelled" }[command.action];
  return { command, fromStatus, toStatus, occurrences, event: createEvent({ eventType: `reporting_recurrence.${suffix}`, tenantId: command.tenantId, aggregateType: "report_recurrence_series", aggregateId: command.seriesId, matterId: command.matterId, actorId, correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "restricted", retentionPolicy: "matter-lifecycle-plus-firm-retention", payload: { action: command.action, fromStatus, toStatus, occurrenceCount: occurrences.length, humanAuthorized: true, sourceLinked: true, aiConnected: false, schedulerConnected: false, providerDeliveryAttempted: false } }) };
}
