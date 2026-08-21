import { describe, expect, it } from "vitest";
import {
  decideDocumentEvidence,
  validateProductionSet,
  type EvidenceState,
  type ProductionSetState,
} from "./evidence-lifecycle";
const context = {
    tenantId: "t",
    userId: "u",
    roles: ["attorney"],
    matterAccess: new Set(["m"]),
  },
  original: EvidenceState = {
    id: "e-1",
    pageCount: 1,
    originalSha256: "a".repeat(64),
    originalObjectKey: "t/m/e-1/original.pdf",
  },
  set: ProductionSetState = {
    id: "s-1",
    status: "draft",
    revision: 1,
    items: [
      {
        evidenceId: "e-1",
        derivativeId: "d-1",
        position: 1,
        includedPageStart: 1,
        includedPageEnd: 1,
        privilegeReviewed: true,
        confidentialityReviewed: true,
        derivativeStatus: "approved",
      },
    ],
  };
describe("document evidence lifecycle", () => {
  it("creates derivatives without mutating original identity", () => {
    const d = decideDocumentEvidence({
      context,
      evidence: original,
      targetExists: false,
      raw: {
        action: "create_derivative",
        tenantId: "t",
        matterId: "m",
        evidenceId: "e-1",
        derivativeId: "d-2",
        derivativeKind: "redacted_copy",
        title: "Redacted synthetic source",
        sourcePageStart: 1,
        sourcePageEnd: 1,
        providerMode: "human_authored",
        idempotencyKey: "document-derivative",
      },
    });
    expect(d.event.payload).toMatchObject({
      originalMutated: false,
      ocrConnected: false,
      aiConnected: false,
    });
    expect(original.originalSha256).toBe("a".repeat(64));
  });
  it("blocks page ranges outside the original", () =>
    expect(() =>
      decideDocumentEvidence({
        context,
        evidence: original,
        targetExists: false,
        raw: {
          action: "create_derivative",
          tenantId: "t",
          matterId: "m",
          evidenceId: "e-1",
          derivativeId: "d-2",
          derivativeKind: "bates_copy",
          title: "Bates synthetic source",
          sourcePageStart: 1,
          sourcePageEnd: 2,
          providerMode: "deterministic_sandbox",
          idempotencyKey: "document-pages",
        },
      }),
    ).toThrow("exceeds"));
  it("records OCR and AI as blocked rather than fabricating derivative bytes", () =>
    expect(
      decideDocumentEvidence({
        context,
        evidence: original,
        targetExists: false,
        raw: {
          action: "record_provider_block",
          tenantId: "t",
          matterId: "m",
          evidenceId: "e-1",
          derivativeId: "ocr-1",
          derivativeKind: "ocr_text",
          reason:
            "OCR provider selection, security review, and credentials remain unavailable.",
          idempotencyKey: "document-ocr-block",
        },
      }).toStatus,
    ).toBe("blocked"));
  it("validates ordered approved privilege-reviewed production items", () =>
    expect(validateProductionSet(set)).toMatchObject({
      outcome: "pass",
      itemCount: 1,
      pageCount: 1,
    }));
  it("rejects unreviewed sets and cross-tenant commands", () => {
    expect(
      validateProductionSet({
        ...set,
        items: [{ ...set.items[0], privilegeReviewed: false }],
      }).outcome,
    ).toBe("fail");
    expect(() =>
      decideDocumentEvidence({
        context,
        raw: {
          action: "materialize_fixture_original",
          tenantId: "other",
          matterId: "m",
          evidenceId: "e-1",
          title: "Synthetic evidence source",
          privilege: "none",
          confidentiality: "confidential",
          sandboxAcknowledged: true,
          idempotencyKey: "document-tenant",
        },
      }),
    ).toThrow("Access denied");
  });
});
