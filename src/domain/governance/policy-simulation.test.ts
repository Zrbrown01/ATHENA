import { describe, expect, it } from "vitest";
import {
  decidePolicySimulation,
  diffGovernanceLayers,
  resolveGovernancePolicy,
  type GovernancePolicyLayerState,
} from "./policy-simulation";

const context = {
  tenantId: "tenant-golden",
  userId: "partner-1",
  roles: ["partner" as const],
  matterAccess: new Set(["matter-golden-001"]),
};
const date = (value: string) => new Date(`${value}T12:00:00.000Z`);
const layer = (
  id: string,
  scopeType: GovernancePolicyLayerState["scopeType"],
  scopeId: string,
  businessDays: number,
  version = 1,
): GovernancePolicyLayerState => ({
  id,
  code: "synthetic-report-deadline",
  version,
  scopeType,
  scopeId,
  businessDays,
  authorityCitation: `Synthetic ${scopeType} policy pending legal activation`,
  effectiveAt: date("2026-01-01"),
  reviewBy: date("2026-12-31"),
  contentStatus: "synthetic_sandbox",
  status: "active",
  revision: 1,
  supersedesLayerId: null,
});

describe("governance policy simulation", () => {
  it("resolves firm, client, matter-type, and matter precedence explainably", () => {
    const resolution = resolveGovernancePolicy({
      layers: [
        layer("firm", "firm", "tenant-golden", 8),
        layer("client", "client", "client-summit", 6),
        layer("type", "matter_type", "wc-defense", 5),
        layer("matter", "matter", "matter-golden-001", 3),
      ],
      code: "synthetic-report-deadline",
      subject: {
        tenantId: "tenant-golden",
        clientId: "client-summit",
        matterType: "wc-defense",
        matterId: "matter-golden-001",
      },
      triggerDate: "2026-08-20",
      asOfDate: "2026-08-20",
      holidays: new Set(["2026-08-24"]),
      sandboxAcknowledged: true,
    });
    expect(resolution.selected.id).toBe("matter");
    expect(resolution.deadline.dueDate).toBe("2026-08-26");
    expect(resolution.trace).toContain(
      "Precedence selected matter:matter-golden-001",
    );
  });

  it("blocks pending, expired, and unacknowledged synthetic content", () => {
    const base = {
      code: "synthetic-report-deadline",
      subject: {
        tenantId: "tenant-golden",
        clientId: "client-summit",
        matterType: "wc-defense",
        matterId: "matter-golden-001",
      },
      triggerDate: "2026-08-20",
      asOfDate: "2026-08-20",
      holidays: new Set<string>(),
      sandboxAcknowledged: true,
    };
    expect(() =>
      resolveGovernancePolicy({
        ...base,
        layers: [
          {
            ...layer("pending", "matter", "matter-golden-001", 3),
            contentStatus: "pending_attorney_review",
          },
        ],
      }),
    ).toThrow(/pending attorney review/);
    expect(() =>
      resolveGovernancePolicy({
        ...base,
        asOfDate: "2027-01-01",
        layers: [layer("expired", "matter", "matter-golden-001", 3)],
      }),
    ).toThrow(/renewed review/);
    expect(() =>
      resolveGovernancePolicy({
        ...base,
        sandboxAcknowledged: false,
        layers: [layer("synthetic", "matter", "matter-golden-001", 3)],
      }),
    ).toThrow(/must be acknowledged/);
  });

  it("produces a field-level version diff", () => {
    expect(
      diffGovernanceLayers(layer("v1", "matter", "matter-golden-001", 3), {
        ...layer("v2", "matter", "matter-golden-001", 4, 2),
        authorityCitation: "Revised synthetic matter policy",
      }),
    ).toMatchObject({
      businessDaysDelta: 1,
      authorityCitationChanged: true,
      contentStatusChanged: false,
      scopeChanged: false,
    });
  });

  it("requires sequential supersession and rejects false legal approval", () => {
    const current = layer("layer-v1", "matter", "matter-golden-001", 3);
    const raw = {
      action: "create_layer",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      layerId: "layer-v2",
      code: current.code,
      version: 2,
      scopeType: "matter",
      scopeId: "matter-golden-001",
      businessDays: 4,
      authorityCitation: "Revised synthetic matter deadline policy",
      effectiveDate: "2026-08-21",
      reviewDate: "2026-12-31",
      contentStatus: "synthetic_sandbox",
      supersedesLayerId: "layer-v1",
      expectedSupersededRevision: 1,
      reason: "Partner revised the synthetic workflow for simulation testing.",
      sandboxAcknowledged: true,
      idempotencyKey: "policy-layer-v2",
    } as const;
    expect(
      decidePolicySimulation({
        context,
        raw,
        currentScopeLayer: current,
        supersededLayer: current,
      }).event.payload,
    ).toMatchObject({ legalContentActivated: false });
    expect(() =>
      decidePolicySimulation({
        context,
        raw: { ...raw, contentStatus: "attorney_approved" },
        currentScopeLayer: current,
        supersededLayer: current,
      }),
    ).toThrow(/external legal-review activation/);
    expect(() =>
      decidePolicySimulation({
        context,
        raw: { ...raw, version: 3 },
        currentScopeLayer: current,
        supersededLayer: current,
      }),
    ).toThrow(/changed/);
  });
});
