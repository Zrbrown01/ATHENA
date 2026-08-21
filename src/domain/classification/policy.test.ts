import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  type TenantContext,
} from "@/platform/tenant-context";
import {
  decideClassification,
  evaluateClassification,
  type Label,
  type Plane,
} from "./policy";
const context: TenantContext = {
    tenantId: "tenant-golden",
    userId: "attorney-1",
    roles: ["attorney"],
    matterAccess: new Set(["matter-1"]),
  },
  labels: Label[] = [
    "privileged",
    "medical_sensitive",
    "ai_restricted",
    "legal_hold",
  ];
describe("classification policy", () => {
  it.each<[Plane, string]>([
    ["access", "allow"],
    ["search", "allow"],
    ["ai", "deny"],
    ["sharing", "deny"],
    ["download", "allow"],
    ["printing", "deny"],
    ["retention", "retain"],
    ["export", "allow"],
    ["logging", "redact"],
  ])("applies %s plane as %s", (plane, outcome) =>
    expect(
      evaluateClassification({
        context,
        tenantId: "tenant-golden",
        matterId: "matter-1",
        plane,
        labels,
      }).outcome,
    ).toBe(outcome),
  );
  it("redacts authentication-sensitive search and denies download", () => {
    const x: [Plane, string][] = [
      ["search", "redact"],
      ["download", "deny"],
    ];
    for (const [plane, outcome] of x)
      expect(
        evaluateClassification({
          context,
          tenantId: "tenant-golden",
          matterId: "matter-1",
          plane,
          labels: ["authentication_sensitive"],
        }).outcome,
      ).toBe(outcome);
  });
  it("never overrides immutable restriction labels", () =>
    expect(() =>
      decideClassification({
        context: { ...context, roles: ["partner"] },
        classification: {
          labels: ["ethical_wall_restricted"],
          policyVersion: 1,
        },
        raw: {
          action: "approve_override",
          tenantId: "tenant-golden",
          matterId: "matter-1",
          resourceType: "document",
          resourceId: "doc-1",
          overrideId: "override-1",
          plane: "download",
          reason: "Partner reviewed a narrowly scoped operational exception.",
          expiresAt: "2030-01-01T00:00:00.000Z",
          idempotencyKey: "classification-test-001",
        },
      }),
    ).toThrow(/cannot be overridden/));
  it("allows an active override only for overridable denial", () =>
    expect(
      evaluateClassification({
        context,
        tenantId: "tenant-golden",
        matterId: "matter-1",
        plane: "printing",
        labels: ["privileged"],
        override: {
          id: "override-1",
          plane: "printing",
          status: "active",
          expiresAt: new Date("2030-01-01"),
        },
        now: new Date("2026-01-01"),
      }).outcome,
    ).toBe("allow"));
  it("blocks foreign tenants and matters", () => {
    expect(() =>
      evaluateClassification({
        context,
        tenantId: "other",
        matterId: "matter-1",
        plane: "access",
        labels: ["internal"],
      }),
    ).toThrow(AuthorizationError);
    expect(() =>
      evaluateClassification({
        context,
        tenantId: "tenant-golden",
        matterId: "other",
        plane: "access",
        labels: ["internal"],
      }),
    ).toThrow(AuthorizationError);
  });
});
