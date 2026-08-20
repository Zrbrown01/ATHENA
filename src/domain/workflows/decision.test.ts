import { describe, expect, it } from "vitest";
import { decideWorkflow } from "./decision";

describe("decideWorkflow", () => {
  it("creates a human-authorized, idempotent intake event", () => {
    const result = decideWorkflow("user-1", { tenantId: "tenant-golden", workflowType: "intake", aggregateId: "candidate-1", action: "approve_open", idempotencyKey: "intake-candidate-1-user-1" });
    expect(result.event.eventType).toBe("intake.approve_open");
    expect(result.event.payload.humanAuthorized).toBe(true);
  });

  it("rejects actions that do not belong to the workflow", () => {
    expect(() => decideWorkflow("user-1", { tenantId: "tenant-golden", workflowType: "authority", aggregateId: "authority-1", action: "approve_open", idempotencyKey: "authority-invalid-1" })).toThrow(/not valid/);
  });
});
