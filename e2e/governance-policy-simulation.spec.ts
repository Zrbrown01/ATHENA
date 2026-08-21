import { expect, test } from "@playwright/test";

const owner = {
  "oai-authenticated-user-id": "user-maya-chen",
  "oai-authenticated-user-email": "user-maya-chen@example.test",
  "oai-authenticated-user-full-name": encodeURIComponent("user-maya-chen"),
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
};
const writeHeaders = {
  ...owner,
  "content-type": "application/json",
  origin: "http://localhost:3000",
};

test("policy precedence, simulation, version diff, and stale supersession are durable", async ({
  request,
}) => {
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const code = `synthetic-policy-${suffix}`;
  const definitions = [
    ["firm", "tenant-golden", 8],
    ["client", "client-summit", 6],
    ["matter_type", "california-wc-defense", 5],
    ["matter", "matter-golden-001", 3],
  ] as const;

  for (const [scopeType, scopeId, businessDays] of definitions) {
    const response = await request.post("/api/admin/governance", {
      headers: writeHeaders,
      data: {
        action: "create_layer",
        tenantId: "tenant-golden",
        matterId: "matter-golden-001",
        layerId: `${code}-${scopeType}-v1`,
        code,
        version: 1,
        scopeType,
        scopeId,
        businessDays,
        authorityCitation: `Synthetic ${scopeType} policy for deterministic precedence testing only.`,
        effectiveDate: "2026-01-01",
        reviewDate: "2026-12-31",
        contentStatus: "synthetic_sandbox",
        supersedesLayerId: null,
        expectedSupersededRevision: null,
        reason:
          "Partner created a synthetic policy layer with no activated legal content.",
        sandboxAcknowledged: true,
        idempotencyKey: `${code}-${scopeType}-create`,
      },
    });
    expect(response.status()).toBe(200);
  }

  const simulate = async (id: string) =>
    request.post("/api/admin/governance", {
      headers: writeHeaders,
      data: {
        action: "simulate",
        tenantId: "tenant-golden",
        matterId: "matter-golden-001",
        simulationId: `${code}-${id}`,
        code,
        triggerDate: "2026-08-20",
        asOfDate: "2026-08-21",
        clientId: "client-summit",
        matterType: "california-wc-defense",
        sandboxAcknowledged: true,
        idempotencyKey: `${code}-${id}-simulate`,
      },
    });
  const first = await simulate("simulation-v1");
  expect(first.status()).toBe(200);
  const firstBody = (await first.json()) as {
    simulations: Array<{
      id: string;
      selectedScopeType: string;
      selectedVersion: number;
      dueAt: string;
      applicableLayerIds: string[];
    }>;
  };
  const firstSimulation = firstBody.simulations.find(
    (simulation) => simulation.id === `${code}-simulation-v1`,
  );
  expect(firstSimulation).toMatchObject({
    selectedScopeType: "matter",
    selectedVersion: 1,
    applicableLayerIds: expect.arrayContaining(
      definitions.map(([scope]) => `${code}-${scope}-v1`),
    ),
  });
  expect(firstSimulation?.dueAt.slice(0, 10)).toBe("2026-08-26");

  const v1 = `${code}-matter-v1`;
  const supersede = (attempt: string) =>
    request.post("/api/admin/governance", {
      headers: writeHeaders,
      data: {
        action: "create_layer",
        tenantId: "tenant-golden",
        matterId: "matter-golden-001",
        layerId: `${code}-matter-v2-${attempt}`,
        code,
        version: 2,
        scopeType: "matter",
        scopeId: "matter-golden-001",
        businessDays: 4,
        authorityCitation:
          "Revised synthetic matter policy for deterministic version testing only.",
        effectiveDate: "2026-08-21",
        reviewDate: "2026-12-31",
        contentStatus: "synthetic_sandbox",
        supersedesLayerId: v1,
        expectedSupersededRevision: 1,
        reason:
          "Partner revised the synthetic matter layer while preserving prior evidence.",
        sandboxAcknowledged: true,
        idempotencyKey: `${code}-supersede-${attempt}`,
      },
    });
  const raced = await Promise.all([supersede("a"), supersede("b")]);
  expect(raced.map((response) => response.status()).sort()).toEqual([200, 409]);

  const second = await simulate("simulation-v2");
  expect(second.status()).toBe(200);
  const secondBody = (await second.json()) as {
    simulations: Array<{
      id: string;
      selectedVersion: number;
      dueAt: string;
    }>;
    diffs: Array<{
      priorLayerId: string;
      businessDaysDelta: number;
      authorityCitationChanged: boolean;
    }>;
    layers: Array<{ id: string; status: string; revision: number }>;
  };
  const secondSimulation = secondBody.simulations.find(
    (simulation) => simulation.id === `${code}-simulation-v2`,
  );
  expect(secondSimulation).toMatchObject({ selectedVersion: 2 });
  expect(secondSimulation?.dueAt.slice(0, 10)).toBe("2026-08-27");
  expect(
    secondBody.diffs.find((diff) => diff.priorLayerId === v1),
  ).toMatchObject({
    businessDaysDelta: 1,
    authorityCitationChanged: true,
  });
  expect(secondBody.layers.find((layer) => layer.id === v1)).toMatchObject({
    status: "superseded",
    revision: 2,
  });

  const falseApproval = await request.post("/api/admin/governance", {
    headers: writeHeaders,
    data: {
      action: "create_layer",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      layerId: `${code}-false-approved-v1`,
      code: `${code}-false-approved`,
      version: 1,
      scopeType: "matter",
      scopeId: "matter-golden-001",
      businessDays: 2,
      authorityCitation:
        "Unverified California legal content must not activate.",
      effectiveDate: "2026-01-01",
      reviewDate: "2026-12-31",
      contentStatus: "attorney_approved",
      supersedesLayerId: null,
      expectedSupersededRevision: null,
      reason:
        "Attempt to activate legal content without an external review record.",
      sandboxAcknowledged: false,
      idempotencyKey: `${code}-false-approved-create`,
    },
  });
  expect(falseApproval.status()).toBe(400);
  expect((await falseApproval.json()).error).toMatch(/legal-review activation/);
});
