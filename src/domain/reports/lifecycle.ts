import { z } from "zod";
import { createEvent } from "@/platform/events";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";

const id = z.string().min(3).max(160);
const base = { tenantId: z.string().min(1), matterId: z.string().min(1), reportInstanceId: id, idempotencyKey: z.string().min(8).max(200) };
const reason = z.string().trim().min(12).max(1500);
const section = z.object({ id, sectionCode: z.enum(["matter_identity", "current_posture", "medical_status", "authority", "upcoming_events", "legal_spend"]), title: z.string().min(4).max(160), body: z.string().min(20).max(10_000), sourceRecordIds: z.array(id).min(1).max(20) });

export const reportCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("materialize_fixture_report"), ...base, definitionId: id, definitionCode: z.literal("SUMMIT-90-DAY"), title: z.string().min(5).max(240), dueAt: z.iso.datetime(), recipientAddresses: z.array(z.email()).min(1).max(10), sections: z.array(section).length(6), sandboxAcknowledged: z.literal(true) }),
  z.object({ action: z.literal("validate_report"), ...base, expectedRevision: z.number().int().positive() }),
  z.object({ action: z.literal("approve_report"), ...base, expectedRevision: z.number().int().positive(), reason }),
  z.object({ action: z.literal("record_delivery_block"), ...base, expectedRevision: z.number().int().positive(), deliveryId: id, reason }),
]);

export type ReportCommand = z.infer<typeof reportCommand>;
export type ReportState = { id: string; status: "draft" | "validated" | "approved" | "delivery_blocked" | "delivered"; revision: number; recipientAddresses: string[]; unresolvedConflictCount: number; sections: Array<{ sectionCode: string; position: number; sourceRecordIds: string[] }> };
export type ReportDefinitionState = { id: string; code: string; version: number; requiredSections: string[]; contentStatus: "synthetic_sandbox" | "pending_attorney_review" | "attorney_approved" };

export function validateReport(definition: ReportDefinitionState, report: ReportState) {
  const present = new Set(report.sections.map((item) => item.sectionCode));
  const sourceCoverageCount = report.sections.reduce((count, item) => count + item.sourceRecordIds.length, 0);
  const positions = [...report.sections].sort((a, b) => a.position - b.position).map((item) => item.position);
  const checks = [
    { code: "required_sections", status: definition.requiredSections.every((code) => present.has(code)) && present.size === definition.requiredSections.length ? "pass" : "fail", explanation: "Every versioned required section must be present exactly once." },
    { code: "ordered_sections", status: positions.length > 0 && positions.every((position, index) => position === index + 1) ? "pass" : "fail", explanation: "Section positions must be contiguous from one." },
    { code: "source_coverage", status: report.sections.every((item) => item.sourceRecordIds.length > 0) ? "pass" : "fail", explanation: "Every section must cite at least one scoped source record." },
    { code: "conflicts", status: report.unresolvedConflictCount === 0 ? "pass" : "fail", explanation: "Unresolved report conflicts block approval." },
    { code: "recipients", status: report.recipientAddresses.length > 0 ? "pass" : "fail", explanation: "At least one delivery recipient is required." },
  ];
  return { outcome: checks.some((check) => check.status === "fail") ? "fail" as const : "pass" as const, checks, sourceCoverageCount };
}

export function decideReport(input: { context: TenantContext; raw: unknown; report?: ReportState | null; definition?: ReportDefinitionState | null; validation?: ReturnType<typeof validateReport>; targetExists?: boolean }) {
  const command = reportCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId);
  requireRole(input.context, ["attorney", "partner", "paralegal"]);
  let fromStatus = "not_created";
  let toStatus = "draft";
  if (command.action === "materialize_fixture_report") {
    if (input.targetExists) throw new Error("Report instance identity already exists");
  } else {
    const report = input.report;
    if (!report || report.revision !== command.expectedRevision) throw new Error("Report changed; refresh before retrying");
    fromStatus = report.status;
    if (command.action === "validate_report") {
      if (report.status !== "draft" || !input.definition || input.definition.contentStatus === "pending_attorney_review" || input.validation?.outcome !== "pass") throw new Error("Report failed governed validation");
      toStatus = "validated";
    } else if (command.action === "approve_report") {
      requireRole(input.context, ["attorney", "partner"]);
      if (report.status !== "validated") throw new Error("Only a validated report can be approved");
      toStatus = "approved";
    } else {
      if (report.status !== "approved") throw new Error("Only an approved report can enter delivery handoff");
      toStatus = "delivery_blocked";
    }
  }
  return { command, fromStatus, toStatus, event: createEvent({
    eventType: `reporting.${({ materialize_fixture_report: "fixture_report_materialized", validate_report: "validated", approve_report: "approved", record_delivery_block: "delivery_blocked" } as const)[command.action]}`,
    tenantId: command.tenantId, aggregateType: "report_instance", aggregateId: command.reportInstanceId, matterId: command.matterId,
    actorId: input.context.userId, correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "restricted", retentionPolicy: "matter-lifecycle-plus-firm-retention",
    payload: { action: command.action, fromStatus, toStatus, humanAuthorized: true, sourceLinked: true, aiConnected: false, microsoftConnected: false, providerDeliveryAttempted: false },
  }) };
}
