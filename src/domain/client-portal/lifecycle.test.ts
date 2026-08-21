import { describe, expect, it } from "vitest";
import { decideClientPortal, type ClientPortalState } from "./lifecycle";
import { AuthorizationError, type TenantContext } from "@/platform/tenant-context";
const context: TenantContext = { tenantId: "t", userId: "attorney-1", roles: ["attorney"], matterAccess: new Set(["matter-1"]) };
const base = { tenantId: "t", matterId: "matter-1", accessRequestId: "portal-1", idempotencyKey: "portal-test-001" };
const now = new Date("2026-08-20T12:00:00.000Z");
const current = (status: ClientPortalState["status"], revision = 1): ClientPortalState => ({ id: "portal-1", status, revision, requestedExpiresAt: new Date("2026-09-20T12:00:00.000Z") });
describe("client portal lifecycle", () => {
  it("requires identity verification before attorney approval", () => expect(() => decideClientPortal({ context, current: current("requested"), now, raw: { action: "approve_access", ...base, expectedRevision: 1, reason: "Attorney cannot bypass the identity verification checkpoint." } })).toThrow(/not allowed/));
  it("allows an internal summary but blocks sensitive external sharing", () => {
    const allowed = decideClientPortal({ context, current: current("approved"), now, raw: { action: "evaluate_share_item", ...base, expectedRevision: 1, shareItemId: "share-1", resourceType: "report_summary", resourceId: "summary-1", title: "Approved client status summary", labels: ["internal"], reason: "Attorney selected an approved internal summary for client sharing." } });
    const denied = decideClientPortal({ context, current: current("approved"), now, raw: { action: "evaluate_share_item", ...base, expectedRevision: 1, shareItemId: "share-2", resourceType: "document", resourceId: "medical-1", title: "Privileged medical analysis", labels: ["privileged", "medical_sensitive"], reason: "Attorney evaluated a sensitive item to prove the external sharing hard stop." } });
    expect(allowed.shareDecision?.outcome).toBe("allow");
    expect(denied.shareDecision?.outcome).toBe("deny");
  });
  it("records activation as blocked with no invitation", () => {
    const x = decideClientPortal({ context, current: current("approved"), now, raw: { action: "attempt_activation", ...base, expectedRevision: 1, reason: "External identity and secure portal sessions are not connected." } });
    expect(x.toStatus).toBe("activation_blocked");
    expect(x.event.payload).toMatchObject({ externalLoginEnabled: false, identityProviderConnected: false, invitationSent: false });
  });
  it("enforces tenant, matter, role, and expiry", () => {
    expect(() => decideClientPortal({ context, current: current("approved"), now, raw: { action: "attempt_activation", ...base, tenantId: "other", expectedRevision: 1, reason: "Foreign tenant access must be rejected before any portal operation." } })).toThrow(AuthorizationError);
    expect(() => decideClientPortal({ context, current: current("approved"), now, raw: { action: "attempt_activation", ...base, matterId: "other", expectedRevision: 1, reason: "Foreign matter access must be rejected before any portal operation." } })).toThrow(AuthorizationError);
    expect(() => decideClientPortal({ context: { ...context, roles: ["paralegal"] }, current: current("identity_verified"), now, raw: { action: "approve_access", ...base, expectedRevision: 1, reason: "A paralegal cannot approve external client portal access." } })).toThrow(AuthorizationError);
    expect(() => decideClientPortal({ context, current: { ...current("approved"), requestedExpiresAt: new Date("2026-08-19T12:00:00.000Z") }, now, raw: { action: "attempt_activation", ...base, expectedRevision: 1, reason: "Expired access must be blocked before an activation handoff." } })).toThrow(/expired/);
  });
});
