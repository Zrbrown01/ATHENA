import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  type TenantContext,
} from "@/platform/tenant-context";
import { decideDirectory } from "./directory";
const context: TenantContext = {
    tenantId: "tenant-golden",
    userId: "admin-1",
    roles: ["partner"],
    matterAccess: new Set(),
  },
  identity = { id: "user-fixture", status: "active" as const, revision: 3 },
  run = {
    id: "offboard-1",
    status: "assignments_revoked" as const,
    revision: 2,
  };
describe("enterprise directory decisions", () => {
  it("requires matter scope consistency", () =>
    expect(() =>
      decideDirectory({
        context,
        identity: { ...identity, revision: 2 },
        raw: {
          action: "assign_role",
          tenantId: "tenant-golden",
          identityId: identity.id,
          expectedRevision: 2,
          assignmentId: "assign-1",
          roleCode: "attorney",
          scopeType: "matter",
          matterId: null,
          grantReason: "Attorney role is limited to the assigned matter.",
          idempotencyKey: "identity-test-001",
        },
      }),
    ).toThrow(/matter identity/));
  it("suspends before any offboarding provider action", () =>
    expect(
      decideDirectory({
        context,
        identity,
        raw: {
          action: "start_offboarding",
          tenantId: "tenant-golden",
          identityId: identity.id,
          expectedRevision: 3,
          offboardingRunId: "offboard-1",
          reason: "Synthetic departure requires immediate access suspension.",
          idempotencyKey: "identity-test-002",
        },
      }).toStatus,
    ).toBe("suspended"));
  it("blocks self-offboarding", () =>
    expect(() =>
      decideDirectory({
        context,
        identity: { ...identity, id: "admin-1" },
        raw: {
          action: "start_offboarding",
          tenantId: "tenant-golden",
          identityId: "admin-1",
          expectedRevision: 3,
          offboardingRunId: "offboard-1",
          reason: "Attempt to remove the current administrative session.",
          idempotencyKey: "identity-test-003",
        },
      }),
    ).toThrow(/own active session/));
  it("records disconnected revocation without claiming completion", () =>
    expect(
      decideDirectory({
        context,
        identity: { ...identity, status: "suspended", revision: 5 },
        run,
        raw: {
          action: "record_session_revocation",
          tenantId: "tenant-golden",
          identityId: identity.id,
          expectedRevision: 5,
          offboardingRunId: run.id,
          expectedRunRevision: 2,
          mode: "not_connected",
          evidence:
            "Microsoft Entra is not connected; no session or token was revoked.",
          idempotencyKey: "identity-test-004",
        },
      }).toStatus,
    ).toBe("suspended"));
  it("blocks foreign tenants", () =>
    expect(() =>
      decideDirectory({
        context,
        raw: {
          action: "register_fixture_identity",
          tenantId: "other",
          identityId: "user-foreign",
          connectionId: "entra-1",
          email: "foreign@example.test",
          displayName: "Foreign User",
          fixtureAcknowledged: true,
          idempotencyKey: "identity-test-005",
        },
      }),
    ).toThrow(AuthorizationError));
});
