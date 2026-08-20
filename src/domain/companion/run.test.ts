import { describe, expect, it } from "vitest";
import { transitionCompanionRun, type CompanionStage } from "./run";
import { AuthorizationError, type TenantContext } from "@/platform/tenant-context";

const context: TenantContext = { tenantId: "tenant-a", userId: "user-1", roles: ["attorney"], matterAccess: new Set(["matter-1"]) };
const command = { tenantId: "tenant-a", matterId: "matter-1", runId: "run-1", currentStage: "not_started" as const, action: "import_matter" as const, idempotencyKey: "companion-import-0001" };

describe("transitionCompanionRun", () => {
  it("moves only through the declared durable state machine", () => {
    const result = transitionCompanionRun(context, command);
    expect(result.nextStage).toBe("matter_imported");
    expect(result.event.eventType).toBe("matter.imported");
    expect(result.event.payload.providerMode).toBe("deterministic_sandbox");
  });

  it("rejects skipped stages", () => {
    expect(() => transitionCompanionRun(context, { ...command, action: "approve_report" })).toThrow(/not valid/);
  });

  it("rejects cross-tenant access", () => {
    expect(() => transitionCompanionRun(context, { ...command, tenantId: "tenant-b" })).toThrow(AuthorizationError);
  });

  it("requires an attorney or partner for report approval", () => {
    const paralegal = { ...context, roles: ["paralegal"] };
    expect(() => transitionCompanionRun(paralegal, { ...command, currentStage: "draft_ready", action: "approve_report" })).toThrow(AuthorizationError);
  });

  it("records Microsoft delivery as blocked instead of sent", () => {
    const result = transitionCompanionRun(context, { ...command, currentStage: "report_approved", action: "queue_email" });
    expect(result.nextStage).toBe("delivery_handoff_blocked");
    expect(result.event.eventType).toBe("email.handoff_blocked");
    expect(result.event.payload.providerMode).toBe("disabled_external_provider");
  });

  it("completes the ordered golden workflow without bypassing human gates", () => {
    const actions = ["import_matter", "process_qme", "create_verbatim_draft", "approve_report", "queue_email", "confirm_time", "create_export"] as const;
    let stage: CompanionStage = "not_started";
    const eventTypes: string[] = [];
    actions.forEach((action, index) => {
      const result = transitionCompanionRun(context, { ...command, currentStage: stage, action, idempotencyKey: `golden-${action}-${index}` });
      stage = result.nextStage;
      eventTypes.push(result.event.eventType);
    });
    expect(stage).toBe("export_ready");
    expect(eventTypes).toEqual(["matter.imported", "medical.analysis_ready", "work_product.draft_created", "report.approved", "email.handoff_blocked", "time.confirmed", "export.ready"]);
  });
});
