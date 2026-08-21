import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  type TenantContext,
} from "@/platform/tenant-context";
import { decideSecurityOperations } from "./operations";

const context: TenantContext = {
  tenantId: "tenant-golden",
  userId: "partner-1",
  roles: ["partner"],
  matterAccess: new Set(),
};
const base = {
  tenantId: "tenant-golden",
  incidentId: "incident-001",
  idempotencyKey: "security-test-001",
};

describe("security operations decisions", () => {
  it("enforces the incident response sequence", () => {
    const decision = decideSecurityOperations({
      context,
      raw: {
        action: "contain_incident",
        ...base,
        expectedRevision: 2,
        containmentSummary:
          "Disabled the affected internal consumer and isolated its credentials.",
        containmentEvidenceRef: "event-ledger:containment-001",
        sessionRevocationMode: "not_connected",
        sessionRevocationEvidence:
          "Identity provider revocation is not connected; manual action remains required.",
      },
      incident: { id: "incident-001", status: "scoped", revision: 2 },
    });
    expect(decision.toStatus).toBe("contained");
    expect(decision.event.payload.automaticRevocationConnected).toBe(false);
  });

  it("blocks out-of-order incident closure", () => {
    expect(() =>
      decideSecurityOperations({
        context,
        raw: {
          action: "close_incident",
          ...base,
          expectedRevision: 2,
          closureApproval:
            "Partner approves closure with permanent evidence retained.",
          effectivenessReview:
            "Follow-up control testing is scheduled and assigned.",
        },
        incident: { id: "incident-001", status: "contained", revision: 2 },
      }),
    ).toThrow(/not allowed/);
  });

  it("requires evidence dates to be ordered", () => {
    expect(() =>
      decideSecurityOperations({
        context,
        raw: {
          action: "attach_control_evidence",
          tenantId: "tenant-golden",
          controlId: "control-001",
          expectedRevision: 1,
          evidenceId: "evidence-001",
          idempotencyKey: "security-test-002",
          evidenceType: "test_result",
          title: "Tenant isolation negative test",
          evidenceRef: "test:tenant-isolation",
          evidenceSha256: "a".repeat(64),
          outcome: "pass",
          validFrom: "2026-08-21T00:00:00.000Z",
          validUntil: "2026-08-20T00:00:00.000Z",
        },
        control: { id: "control-001", status: "designed", revision: 1 },
      }),
    ).toThrow(/validity/);
  });

  it("does not allow residual risk to exceed inherent risk", () => {
    expect(() =>
      decideSecurityOperations({
        context,
        raw: {
          action: "plan_risk_treatment",
          tenantId: "tenant-golden",
          riskId: "risk-001",
          expectedRevision: 1,
          treatmentId: "treatment-001",
          idempotencyKey: "security-test-003",
          strategy: "mitigate",
          actionPlan:
            "Deploy and verify tenant-bound policy enforcement at the persistence layer.",
          controlIds: ["control-001"],
          ownerId: "partner-1",
          dueAt: "2026-10-01T00:00:00.000Z",
          residualScore: 20,
          approvalEvidence:
            "Partner-approved treatment recorded in the security review.",
        },
        risk: {
          id: "risk-001",
          status: "open",
          revision: 1,
          inherentScore: 15,
        },
      }),
    ).toThrow(/Residual risk/);
  });

  it("blocks foreign tenants and unauthorized roles", () => {
    const command = {
      action: "register_control",
      tenantId: "other",
      idempotencyKey: "security-test-004",
      controlId: "control-001",
      code: "AC-01",
      title: "Tenant isolation control",
      controlFamily: "Access control",
      ownerId: "partner-1",
      description:
        "All persistence and object operations must remain tenant scoped.",
      reviewCadenceDays: 90,
    };
    expect(() => decideSecurityOperations({ context, raw: command })).toThrow(
      AuthorizationError,
    );
    expect(() =>
      decideSecurityOperations({
        context: { ...context, roles: ["attorney"] },
        raw: { ...command, tenantId: "tenant-golden" },
      }),
    ).toThrow(AuthorizationError);
  });
});
