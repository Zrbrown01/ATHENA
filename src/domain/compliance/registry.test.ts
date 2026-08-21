import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  type TenantContext,
} from "@/platform/tenant-context";
import {
  decideComplianceRegistry,
  evaluateActivation,
  type SubprocessorState,
} from "./registry";
const context: TenantContext = {
    tenantId: "tenant-golden",
    userId: "partner-1",
    roles: ["partner"],
    matterAccess: new Set(),
  },
  vendor: SubprocessorState = {
    id: "vendor-1",
    status: "under_review",
    revision: 4,
    dataCategories: ["medical-sensitive", "privileged"],
    trainingUse: "prohibited",
  },
  good = {
    securityPass: true,
    securityValid: true,
    baaSatisfied: true,
    dpaSatisfied: true,
    dataUseApproved: true,
    authorizedCategories: ["medical-sensitive", "privileged"],
    trainingUseProhibited: true,
  };
describe("provider compliance registry", () => {
  it("separates contractual eligibility from technical activation", () =>
    expect(evaluateActivation(vendor, good)).toEqual({
      outcome: "contractually_eligible",
      missingRequirements: [],
      credentialActivationAllowed: false,
      providerConnected: false,
    }));
  it("lists every missing activation prerequisite", () =>
    expect(
      evaluateActivation(
        { ...vendor, trainingUse: "unknown" },
        {
          ...good,
          securityPass: false,
          baaSatisfied: false,
          authorizedCategories: ["medical-sensitive"],
          trainingUseProhibited: false,
        },
      ).missingRequirements,
    ).toEqual(
      expect.arrayContaining([
        "current_security_review",
        "executed_baa_or_approved_not_required_basis",
        "complete_data_category_scope",
        "training_use_prohibition",
      ]),
    ));
  it("rejects expired security review", () =>
    expect(() =>
      decideComplianceRegistry({
        context,
        vendor: { ...vendor, status: "candidate", revision: 1 },
        raw: {
          action: "record_security_review",
          tenantId: "tenant-golden",
          subprocessorId: "vendor-1",
          expectedRevision: 1,
          reviewId: "review-1",
          outcome: "pass",
          controlsReviewed: [
            "access control",
            "encryption",
            "incident response",
          ],
          evidenceRef: "Synthetic vendor security questionnaire fixture.",
          evidenceSha256: "a".repeat(64),
          validUntil: "2020-01-01T00:00:00.000Z",
          idempotencyKey: "compliance-test-001",
        },
      }),
    ).toThrow(/currently valid/));
  it("requires effective date for executed agreements", () =>
    expect(() =>
      decideComplianceRegistry({
        context,
        vendor,
        raw: {
          action: "record_agreement",
          tenantId: "tenant-golden",
          subprocessorId: "vendor-1",
          expectedRevision: 4,
          agreementId: "baa-1",
          agreementType: "baa",
          status: "executed",
          effectiveAt: null,
          expiresAt: null,
          artifactRef: "Controlled agreement reference and signature record.",
          artifactSha256: "a".repeat(64),
          idempotencyKey: "compliance-test-002",
        },
      }),
    ).toThrow(/effective date/));
  it("blocks foreign tenants", () =>
    expect(() =>
      decideComplianceRegistry({
        context,
        raw: {
          action: "register_candidate",
          tenantId: "other",
          subprocessorId: "vendor-2",
          name: "Foreign Vendor",
          service: "OCR",
          dataRegions: ["US"],
          dataCategories: ["medical-sensitive"],
          usesAi: false,
          trainingUse: "unknown",
          ownerId: "partner-1",
          syntheticAcknowledged: true,
          idempotencyKey: "compliance-test-003",
        },
      }),
    ).toThrow(AuthorizationError));
});
