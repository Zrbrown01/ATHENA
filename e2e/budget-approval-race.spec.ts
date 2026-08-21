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

test("concurrent stale budget approvals produce exactly one decision", async ({
  request,
}) => {
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const budgetId = `budget-race-${suffix}`;

  const created = await request.post("/api/billing/planning", {
    headers: writeHeaders,
    data: {
      action: "materialize_fixture_budget",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      budgetId,
      idempotencyKey: `budget-race-create-${suffix}`,
      title: "Concurrent approval evidence budget",
      totalBudgetCents: 100_000,
      effectiveDate: "2026-08-20",
      phases: [
        {
          id: `phase-discovery-${suffix}`,
          phaseCode: "DISCOVERY",
          title: "Discovery",
          budgetCents: 60_000,
        },
        {
          id: `phase-hearing-${suffix}`,
          phaseCode: "HEARING",
          title: "Hearing",
          budgetCents: 40_000,
        },
      ],
      sandboxAcknowledged: true,
    },
  });
  expect(created.status()).toBe(200);

  const approval = (attempt: string) =>
    request.post("/api/billing/planning", {
      headers: writeHeaders,
      data: {
        action: "approve_budget",
        tenantId: "tenant-golden",
        matterId: "matter-golden-001",
        budgetId,
        expectedRevision: 1,
        reason: `Partner approval race evidence attempt ${attempt}.`,
        idempotencyKey: `budget-race-approve-${attempt}-${suffix}`,
      },
    });

  const responses = await Promise.all([approval("a"), approval("b")]);
  expect(responses.map((response) => response.status()).sort()).toEqual([
    200, 409,
  ]);
  const conflict = responses.find((response) => response.status() === 409);
  expect(await conflict?.json()).toEqual({
    error: "Record changed; refresh before retrying",
  });

  const projectionResponse = await request.get("/api/billing/planning", {
    headers: owner,
  });
  expect(projectionResponse.status()).toBe(200);
  const projection = (await projectionResponse.json()) as {
    budgets: Array<{ id: string; revision: number; status: string }>;
    decisions: Array<{ budgetId: string; action: string }>;
  };
  expect(projection.budgets.find((budget) => budget.id === budgetId)).toMatchObject(
    { revision: 2, status: "approved" },
  );
  expect(
    projection.decisions.filter(
      (decision) =>
        decision.budgetId === budgetId && decision.action === "approve_budget",
    ),
  ).toHaveLength(1);
});
