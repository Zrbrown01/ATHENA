import { describe, expect, it } from "vitest";
import { decideMatterGraph, goldenMatterGraph } from "./matter-graph";

const context = { tenantId: "tenant-golden", userId: "user-a", roles: ["attorney" as const], matterAccess: new Set(["matter-golden-001"]) };
const command = { action: "materialize_graph" as const, tenantId: "tenant-golden", matterId: "matter-golden-001", idempotencyKey: "matter-graph-test-001", graph: goldenMatterGraph };

describe("matter graph", () => {
  it("keeps Matter, Claim, Injury, and ADJ identities separate and emits counts only", () => {
    const result = decideMatterGraph({ context, raw: command });
    expect(new Set([result.command.graph.matter.id, result.command.graph.claims[0].id, result.command.graph.injuries[0].id, result.command.graph.adjudicationCases[0].id]).size).toBe(4);
    expect(result.event.payload).toMatchObject({ flattened: false, providerMode: "deterministic_sandbox", entityCounts: { matters: 1, claims: 1, injuries: 1, adjudicationCases: 1 } });
    expect(JSON.stringify(result.event.payload)).not.toContain("Rivera");
  });

  it("rejects cross-tenant access before persistence", () => {
    expect(() => decideMatterGraph({ context, raw: { ...command, tenantId: "tenant-other" } })).toThrow("Access denied");
  });

  it("rejects orphan relationships and unprovenanced edges", () => {
    const graph = { ...goldenMatterGraph, relationships: [{ ...goldenMatterGraph.relationships[0], toEntityId: "missing", sourceLinkId: "missing" }] };
    expect(() => decideMatterGraph({ context, raw: { ...command, graph } })).toThrow();
  });

  it("rejects an injury linked to a claim outside the graph", () => {
    const graph = { ...goldenMatterGraph, injuries: [{ ...goldenMatterGraph.injuries[0], claimId: "claim-other" }] };
    expect(() => decideMatterGraph({ context, raw: { ...command, graph } })).toThrow();
  });
});
