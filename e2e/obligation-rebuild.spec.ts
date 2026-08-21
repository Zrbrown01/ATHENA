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

test("full-matter rebuild records immutable findings and single-winner review", async ({
  request,
}) => {
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const obligationId = `rebuild-obligation-${suffix}`;
  const obligationEventKey = `rebuild-create-${suffix}`;
  const created = await request.post("/api/obligations", {
    headers: writeHeaders,
    data: {
      action: "create",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      ruleCode: "firm-pilot-qme-review",
      title: "Synthetic obligation rebuild target",
      requirement:
        "Preserve exact rule history for deterministic full-matter rebuild evidence.",
      triggerDate: "2026-08-20",
      triggerSourceType: "document",
      triggerSourceId: obligationId,
      ownerId: "user-maya-chen",
      sandboxAcknowledged: true,
      idempotencyKey: obligationEventKey,
    },
  });
  expect(created.status()).toBe(200);

  const runId = `rebuild-run-${suffix}`;
  const run = await request.post("/api/admin/governance/rebuild", {
    headers: writeHeaders,
    data: {
      action: "run_rebuild",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      runId,
      asOfDate: "2026-08-21",
      syntheticDataAcknowledged: true,
      idempotencyKey: `rebuild-run-command-${suffix}`,
    },
  });
  expect(run.status()).toBe(200);
  const body = (await run.json()) as {
    runs: Array<{
      id: string;
      outcome: "matched" | "exceptions" | "blocked";
      status: string;
      revision: number;
    }>;
    findings: Array<{
      runId: string;
      obligationId: string;
      result: string;
      expectedDueAt: string | null;
    }>;
  };
  const recorded = body.runs.find((item) => item.id === runId)!;
  expect(recorded).toMatchObject({ status: "pending_review", revision: 1 });
  expect(
    body.findings.find(
      (item) =>
        item.runId === runId && item.obligationId === obligationEventKey,
    ),
  ).toMatchObject({ result: "matched" });

  const review = (attempt: string) =>
    request.post("/api/admin/governance/rebuild", {
      headers: writeHeaders,
      data: {
        action: "review_rebuild",
        tenantId: "tenant-golden",
        matterId: "matter-golden-001",
        runId,
        expectedRevision: 1,
        outcome:
          recorded.outcome === "matched" ? "certified" : "exceptions_noted",
        notes:
          "Partner reviewed immutable rebuild findings and preserved all governed follow-up evidence.",
        idempotencyKey: `rebuild-review-${attempt}-${suffix}`,
      },
    });
  const raced = await Promise.all([review("a"), review("b")]);
  expect(raced.map((response) => response.status()).sort()).toEqual([200, 409]);
  const projection = await request.get("/api/admin/governance/rebuild", {
    headers: owner,
  });
  expect(projection.status()).toBe(200);
  expect(
    (
      (await projection.json()) as {
        runs: Array<{ id: string; status: string; revision: number }>;
      }
    ).runs.find((item) => item.id === runId),
  ).toMatchObject({ status: "reviewed", revision: 2 });
});
