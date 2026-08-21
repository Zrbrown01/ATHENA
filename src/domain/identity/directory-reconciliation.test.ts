import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  type TenantContext,
} from "@/platform/tenant-context";
import {
  decideDirectoryReconciliation,
  evaluateDirectoryReconciliation,
} from "./directory-reconciliation";

const context: TenantContext = {
  tenantId: "tenant-a",
  userId: "partner-1",
  roles: ["partner"],
  matterAccess: new Set(),
};

describe("directory reconciliation", () => {
  it("detects missing, unmanaged, status, role, and MFA drift", () => {
    const result = evaluateDirectoryReconciliation({
      local: [
        {
          id: "identity-alex",
          normalizedEmail: "alex@example.test",
          status: "suspended",
          mfaState: "unknown",
          roleCodes: ["attorney"],
        },
        {
          id: "identity-local-only",
          normalizedEmail: "local@example.test",
          status: "active",
          mfaState: "enforced",
          roleCodes: ["paralegal"],
        },
      ],
      provider: [
        {
          externalObjectId: "entra-alex",
          normalizedEmail: "alex@example.test",
          displayName: "Alex",
          enabled: true,
          mfaState: "enforced",
          roleCodes: ["partner"],
        },
        {
          externalObjectId: "entra-provider-only",
          normalizedEmail: "provider@example.test",
          displayName: "Provider only",
          enabled: true,
          mfaState: "enforced",
          roleCodes: ["paralegal"],
        },
      ],
    });
    expect(result).toMatchObject({
      localIdentityCount: 2,
      providerIdentityCount: 2,
      matchedIdentityCount: 1,
      findingCount: 5,
      blockingFindingCount: 5,
    });
    expect(new Set(result.findings.map((finding) => finding.code))).toEqual(
      new Set([
        "missing_provider_identity",
        "unmanaged_provider_identity",
        "status_drift",
        "role_drift",
        "mfa_claim_unverified",
      ]),
    );
  });

  it("certifies a clean exact match", () => {
    const result = evaluateDirectoryReconciliation({
      local: [
        {
          id: "identity-alex",
          normalizedEmail: "alex@example.test",
          status: "active",
          mfaState: "enforced",
          roleCodes: ["attorney"],
        },
      ],
      provider: [
        {
          externalObjectId: "entra-alex",
          normalizedEmail: "alex@example.test",
          displayName: "Alex",
          enabled: true,
          mfaState: "enforced",
          roleCodes: ["attorney"],
        },
      ],
    });
    expect(result.findings).toEqual([]);
    expect(result.matchedIdentityCount).toBe(1);
  });

  it("requires blocking drift to be reviewed as exceptions", () => {
    expect(() =>
      decideDirectoryReconciliation({
        context,
        current: {
          id: "reconciliation-1",
          status: "findings_open",
          revision: 1,
          findingCount: 2,
          blockingFindingCount: 2,
        },
        raw: {
          action: "review_reconciliation",
          tenantId: "tenant-a",
          reconciliationId: "reconciliation-1",
          expectedRevision: 1,
          outcome: "certified",
          notes: "Attempted clean certification despite blocking drift.",
          idempotencyKey: "reconciliation-review-1",
        },
      }),
    ).toThrow(/cannot be certified/);
  });

  it("enforces tenant isolation", () => {
    expect(() =>
      decideDirectoryReconciliation({
        context,
        raw: {
          action: "run_sandbox_reconciliation",
          tenantId: "tenant-b",
          reconciliationId: "reconciliation-foreign",
          connectionId: "connection-1",
          snapshotAsOf: "2026-08-20T12:00:00.000Z",
          fixtureAcknowledged: true,
          idempotencyKey: "reconciliation-foreign-1",
        },
      }),
    ).toThrow(AuthorizationError);
  });
});
