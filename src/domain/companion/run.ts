import { z } from "zod";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";
import { createEvent } from "@/platform/events";

export const companionStages = [
  "not_started",
  "matter_imported",
  "analysis_ready",
  "draft_ready",
  "report_approved",
  "delivery_handoff_blocked",
  "time_confirmed",
  "export_ready",
] as const;

export type CompanionStage = typeof companionStages[number];
export const companionActions = ["import_matter", "process_qme", "create_verbatim_draft", "approve_report", "queue_email", "confirm_time", "create_export"] as const;
export type CompanionAction = typeof companionActions[number];

const transitions: Record<CompanionStage, { action?: CompanionAction; next?: CompanionStage }> = {
  not_started: { action: "import_matter", next: "matter_imported" },
  matter_imported: { action: "process_qme", next: "analysis_ready" },
  analysis_ready: { action: "create_verbatim_draft", next: "draft_ready" },
  draft_ready: { action: "approve_report", next: "report_approved" },
  report_approved: { action: "queue_email", next: "delivery_handoff_blocked" },
  delivery_handoff_blocked: { action: "confirm_time", next: "time_confirmed" },
  time_confirmed: { action: "create_export", next: "export_ready" },
  export_ready: {},
};

export const companionCommand = z.object({
  tenantId: z.string().min(1).max(120),
  matterId: z.string().min(1).max(120),
  runId: z.string().min(1).max(120),
  currentStage: z.enum(companionStages),
  action: z.enum(companionActions),
  idempotencyKey: z.string().min(8).max(200),
});

const actionRoles: Record<CompanionAction, string[]> = {
  import_matter: ["attorney", "partner", "paralegal"],
  process_qme: ["attorney", "partner", "paralegal"],
  create_verbatim_draft: ["attorney", "partner", "paralegal"],
  approve_report: ["attorney", "partner"],
  queue_email: ["attorney", "partner"],
  confirm_time: ["attorney", "partner"],
  create_export: ["attorney", "partner", "firm_administrator"],
};

export function transitionCompanionRun(context: TenantContext, raw: unknown) {
  const command = companionCommand.parse(raw);
  authorizeMatter(context, command.tenantId, command.matterId);
  requireRole(context, actionRoles[command.action]);

  const expected = transitions[command.currentStage];
  if (expected.action !== command.action || !expected.next) {
    throw new Error(`Action ${command.action} is not valid from ${command.currentStage}`);
  }
  const nextStage = expected.next as Exclude<CompanionStage, "not_started">;

  const humanAuthorized = ["approve_report", "queue_email", "confirm_time", "create_export"].includes(command.action);
  const providerMode = providerModeFor(command.action);
  return {
    command,
    nextStage,
    event: createEvent({
      eventType: eventTypeFor(command.action),
      tenantId: command.tenantId,
      aggregateType: "companion_workflow",
      aggregateId: command.runId,
      matterId: command.matterId,
      actorId: context.userId,
      correlationId: command.runId,
      causationId: command.idempotencyKey,
      idempotencyKey: command.idempotencyKey,
      source: "athena.companion-pilot",
      visibility: "internal",
      retentionPolicy: "matter-lifecycle-plus-firm-retention",
      payload: { action: command.action, fromStage: command.currentStage, toStage: nextStage, humanAuthorized, providerMode },
    }),
  };
}

export function nextCompanionAction(stage: CompanionStage) {
  return transitions[stage].action ?? null;
}

function providerModeFor(action: CompanionAction) {
  if (["import_matter", "process_qme", "create_verbatim_draft"].includes(action)) return "deterministic_sandbox";
  if (action === "queue_email") return "disabled_external_provider";
  return "athena_native";
}

function eventTypeFor(action: CompanionAction) {
  return ({
    import_matter: "matter.imported",
    process_qme: "medical.analysis_ready",
    create_verbatim_draft: "work_product.draft_created",
    approve_report: "report.approved",
    queue_email: "email.handoff_blocked",
    confirm_time: "time.confirmed",
    create_export: "export.ready",
  } as const)[action];
}
