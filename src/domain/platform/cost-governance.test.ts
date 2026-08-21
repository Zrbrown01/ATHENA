import { describe, expect, it } from "vitest";
import { AuthorizationError, type TenantContext } from "@/platform/tenant-context";
import { calculateCostMicros, decideCostGovernance } from "./cost-governance";

const context: TenantContext = { tenantId: "tenant-a", userId: "partner-1", roles: ["partner"], matterAccess: new Set(["matter-1"]) };
const card = { id: "rate-card-1", status: "approved" as const, revision: 2, sourceType: "synthetic_estimate" as const };
const rates = [{ category: "ocr", unit: "page", unitRateMicros: 1500 }];

describe("cost governance", () => {
  it("uses exact integer micro-dollar arithmetic", () => {
    expect(calculateCostMicros(42, 1500)).toBe(63_000);
    expect(() => calculateCostMicros(Number.MAX_SAFE_INTEGER, 2)).toThrow(/safe integer/);
  });

  it("rejects duplicate rate pairs and non-partner approval", () => {
    const create = { action: "create_rate_card", tenantId: "tenant-a", rateCardId: "rate-card-1", name: "Synthetic pilot rates", currency: "USD", sourceType: "synthetic_estimate", sourceRef: "Synthetic planning assumptions with no provider invoice.", effectiveAt: "2026-08-20T00:00:00.000Z", rates: [{ category: "ocr", unit: "page", unitRateMicros: 1 }, { category: "ocr", unit: "page", unitRateMicros: 2 }], syntheticAcknowledged: true, idempotencyKey: "cost-create-001" };
    expect(() => decideCostGovernance({ context, raw: create })).toThrow(/unique/);
    expect(() => decideCostGovernance({ context: { ...context, roles: ["billing_specialist"] }, rateCard: { ...card, status: "draft", revision: 1 }, raw: { action: "approve_rate_card", tenantId: "tenant-a", rateCardId: "rate-card-1", expectedRevision: 1, reason: "A billing specialist cannot approve the governing rate card.", idempotencyKey: "cost-approve-001" } })).toThrow(AuthorizationError);
  });

  it("records estimated matter usage against an approved matching rate", () => {
    const result = decideCostGovernance({ context, rateCard: card, rates, raw: { action: "record_usage", tenantId: "tenant-a", rateCardId: "rate-card-1", usageEntryId: "usage-ocr-1", matterId: "matter-1", workflowId: "document-intake-1", category: "ocr", unit: "page", quantity: 42, pricingState: "estimated", providerName: "Synthetic OCR planning model", sourceType: "athena_measured", sourceId: "document-1", evidence: "Athena counted forty-two pages in the checksum-pinned synthetic document.", occurredAt: "2026-08-20T00:00:00.000Z", idempotencyKey: "cost-usage-001" } });
    expect(result).toMatchObject({ unitRateMicros: 1500, costMicros: 63_000, toStatus: "estimated" });
    expect(result.event.payload).toMatchObject({ providerVerified: false, costMicros: 63_000 });
  });

  it("denies tenant, matter, missing-rate, and false provider verification paths", () => {
    const raw = { action: "record_usage", tenantId: "tenant-a", rateCardId: "rate-card-1", usageEntryId: "usage-ocr-1", matterId: "matter-1", workflowId: "document-intake-1", category: "ocr", unit: "page", quantity: 1, pricingState: "provider_verified", providerName: "Athena", sourceType: "athena_measured", sourceId: "document-1", evidence: "No external invoice exists for this synthetic cost entry.", occurredAt: "2026-08-20T00:00:00.000Z", idempotencyKey: "cost-usage-002" };
    expect(() => decideCostGovernance({ context, rateCard: card, rates, raw: { ...raw, tenantId: "tenant-b" } })).toThrow(AuthorizationError);
    expect(() => decideCostGovernance({ context, rateCard: card, rates, raw: { ...raw, matterId: "matter-2" } })).toThrow(AuthorizationError);
    expect(() => decideCostGovernance({ context, rateCard: card, rates: [], raw: { ...raw, pricingState: "estimated" } })).toThrow(/does not contain/);
    expect(() => decideCostGovernance({ context, rateCard: card, rates, raw })).toThrow(/Provider-verified/);
  });
});

