import { describe, expect, it } from "vitest";
import { decideWorkflow } from "./decision";
import { AuthorizationError, type TenantContext } from "@/platform/tenant-context";

const context: TenantContext = { tenantId: "tenant-golden", userId: "user-1", roles: ["attorney"], matterAccess: new Set(["matter-1"]) };

describe("decideWorkflow", () => {
  it("creates a human-authorized, idempotent intake event", () => {
    const result = decideWorkflow(context, { tenantId: "tenant-golden", workflowType: "intake", aggregateId: "candidate-1", action: "approve_open", idempotencyKey: "intake-candidate-1-user-1" });
    expect(result.event.eventType).toBe("intake.approve_open");
    expect(result.event.payload.humanAuthorized).toBe(true);
  });

  it("rejects actions that do not belong to the workflow", () => {
    expect(() => decideWorkflow(context, { tenantId: "tenant-golden", workflowType: "authority", aggregateId: "authority-1", action: "approve_open", idempotencyKey: "authority-invalid-1" })).toThrow(/not valid/);
  });

  it("rejects cross-tenant decisions", () => {
    expect(() => decideWorkflow(context, { tenantId: "tenant-other", workflowType: "intake", aggregateId: "candidate-1", action: "approve_open", idempotencyKey: "intake-cross-tenant-1" })).toThrow(AuthorizationError);
  });

  it("rejects authority decisions without matter access", () => {
    expect(() => decideWorkflow(context, { tenantId: "tenant-golden", matterId: "matter-2", workflowType: "authority", aggregateId: "authority-1", action: "confirm", idempotencyKey: "authority-no-access-1" })).toThrow(AuthorizationError);
  });
});
