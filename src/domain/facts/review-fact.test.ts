import { describe, expect, it } from "vitest";
import { reviewFact } from "./review-fact";
import { AuthorizationError, type TenantContext } from "@/platform/tenant-context";

const allowedContext: TenantContext = {
  tenantId: "tenant-a",
  userId: "user-1",
  roles: ["attorney"],
  matterAccess: new Set(["matter-1"]),
};

const command = {
  tenantId: "tenant-a",
  matterId: "matter-1",
  factId: "fact-1",
  decision: "verified" as const,
  idempotencyKey: "review-fact-1-user-1",
};

describe("reviewFact", () => {
  it("emits an immutable human-authorized verification event", () => {
    const event = reviewFact(allowedContext, command);

    expect(event.eventType).toBe("fact.verified");
    expect(event.tenantId).toBe("tenant-a");
    expect(event.payload.humanAuthorized).toBe(true);
    expect(event.idempotencyKey).toBe(command.idempotencyKey);
  });

  it("rejects cross-tenant access", () => {
    expect(() => reviewFact(allowedContext, { ...command, tenantId: "tenant-b" })).toThrow(AuthorizationError);
  });

  it("rejects users without review permission", () => {
    const context = { ...allowedContext, roles: ["billing_specialist"] };
    expect(() => reviewFact(context, command)).toThrow(AuthorizationError);
  });

  it("rejects access to an unassigned matter", () => {
    const context = { ...allowedContext, matterAccess: new Set<string>() };
    expect(() => reviewFact(context, command)).toThrow(AuthorizationError);
  });
});
