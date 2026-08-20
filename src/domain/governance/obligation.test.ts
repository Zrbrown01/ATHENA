import { describe, expect, it } from "vitest";
import { AuthorizationError, type TenantContext } from "@/platform/tenant-context";
import { decideObligation } from "./obligation";

const context: TenantContext = { tenantId: "tenant-golden", userId: "attorney-1", roles: ["attorney"], matterAccess: new Set(["matter-1"]) };
const create = { action: "create", tenantId: "tenant-golden", matterId: "matter-1", ruleCode: "pilot", title: "Review QME findings", requirement: "Verify the source-linked QME findings", triggerDate: "2026-08-20", triggerSourceType: "document", triggerSourceId: "doc-1", ownerId: "attorney-1", sandboxAcknowledged: true, idempotencyKey: "obligation-create-0001" } as const;
const rule = { code: "pilot", version: 1, contentStatus: "synthetic_sandbox" as const };
const deadline = { dueDate: "2026-08-28", ruleCode: "pilot", ruleVersion: 1, authorityCitation: "Synthetic pilot policy", trace: ["Trigger 2026-08-20"] };

describe("obligation lifecycle policy", () => {
  it("creates an explicitly acknowledged synthetic obligation with provenance", () => {
    const result = decideObligation({ context, raw: create, rule, deadline });
    expect(result.event.eventType).toBe("obligation.created");
    expect(result.event.payload).toMatchObject({ triggerSourceId: "doc-1", humanAuthorized: true });
  });

  it("blocks content awaiting California attorney review", () => {
    expect(() => decideObligation({ context, raw: create, rule: { ...rule, contentStatus: "pending_attorney_review" }, deadline })).toThrow(/pending California attorney review/);
  });

  it("requires explicit acknowledgement for synthetic content", () => {
    expect(() => decideObligation({ context, raw: { ...create, sandboxAcknowledged: false }, rule, deadline })).toThrow(/acknowledged/);
  });

  it("requires completion evidence and current revision", () => {
    const raw = { action: "complete", tenantId: "tenant-golden", matterId: "matter-1", obligationId: "obl-1", expectedRevision: 2, evidence: "Reviewed source pages 27–31", idempotencyKey: "obligation-complete-0001" };
    expect(decideObligation({ context, raw, current: { status: "open", revision: 2, ownerId: "attorney-1" } }).event.eventType).toBe("obligation.completed");
    expect(() => decideObligation({ context, raw, current: { status: "open", revision: 3, ownerId: "attorney-1" } })).toThrow(/refresh/);
  });

  it("blocks cross-tenant access and terminal-state mutation", () => {
    expect(() => decideObligation({ context, raw: { ...create, tenantId: "other" }, rule, deadline })).toThrow(AuthorizationError);
    const raw = { action: "cancel", tenantId: "tenant-golden", matterId: "matter-1", obligationId: "obl-1", expectedRevision: 1, reason: "Trigger was entered in error", idempotencyKey: "obligation-cancel-0001" };
    expect(() => decideObligation({ context, raw, current: { status: "completed", revision: 1, ownerId: "attorney-1" } })).toThrow(/Only open/);
  });
});
