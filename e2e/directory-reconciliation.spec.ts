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

test("directory drift is persisted and concurrent reviews commit once", async ({
  request,
}) => {
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const identityId = `identity-reconciliation-${suffix}`;
  const reconciliationId = `reconciliation-${suffix}`;

  const registered = await request.post("/api/admin/directory", {
    headers: writeHeaders,
    data: {
      action: "register_fixture_identity",
      tenantId: "tenant-golden",
      identityId,
      connectionId: "directory-entra-001",
      email: `reconciliation-${suffix}@example.test`,
      displayName: "Reconciliation Evidence User",
      fixtureAcknowledged: true,
      idempotencyKey: `directory-register-${suffix}`,
    },
  });
  expect(registered.status()).toBe(200);
  const registeredBody = (await registered.json()) as {
    connections: Array<{ id: string }>;
  };
  const connectionId = registeredBody.connections[0]?.id;
  expect(connectionId).toBeTruthy();

  const run = await request.post("/api/admin/directory/reconciliation", {
    headers: writeHeaders,
    data: {
      action: "run_sandbox_reconciliation",
      tenantId: "tenant-golden",
      reconciliationId,
      connectionId,
      snapshotAsOf: "2026-08-20T12:00:00.000Z",
      fixtureAcknowledged: true,
      idempotencyKey: `directory-reconcile-${suffix}`,
    },
  });
  expect(run.status()).toBe(200);
  const runBody = (await run.json()) as {
    reconciliations: Array<{
      id: string;
      providerMode: string;
      status: string;
      revision: number;
      snapshotSha256: string;
      blockingFindingCount: number;
    }>;
    reconciliationFindings: Array<{
      reconciliationId: string;
      identityId: string | null;
      code: string;
      status: string;
    }>;
  };
  const persistedRun = runBody.reconciliations.find(
    (item) => item.id === reconciliationId,
  );
  expect(persistedRun).toMatchObject({
    providerMode: "deterministic_sandbox",
    status: "findings_open",
    revision: 1,
  });
  expect(persistedRun?.snapshotSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(persistedRun?.blockingFindingCount).toBeGreaterThan(0);
  expect(
    runBody.reconciliationFindings.some(
      (finding) =>
        finding.reconciliationId === reconciliationId &&
        finding.identityId === identityId &&
        finding.code === "missing_provider_identity" &&
        finding.status === "open",
    ),
  ).toBe(true);

  const review = (attempt: string) =>
    request.post("/api/admin/directory/reconciliation", {
      headers: writeHeaders,
      data: {
        action: "review_reconciliation",
        tenantId: "tenant-golden",
        reconciliationId,
        expectedRevision: 1,
        outcome: "exceptions_noted",
        notes:
          "Security review preserves all deterministic drift as unresolved exceptions; no live provider state or remediation is claimed.",
        idempotencyKey: `directory-review-${attempt}-${suffix}`,
      },
    });
  const responses = await Promise.all([review("a"), review("b")]);
  expect(responses.map((response) => response.status()).sort()).toEqual([
    200, 409,
  ]);

  const projection = await request.get(
    "/api/admin/directory/reconciliation",
    { headers: owner },
  );
  expect(projection.status()).toBe(200);
  const projectionBody = (await projection.json()) as {
    reconciliations: Array<{ id: string; status: string; revision: number }>;
    reconciliationFindings: Array<{
      reconciliationId: string;
      status: string;
    }>;
    reconciliationReviews: Array<{
      reconciliationId: string;
      outcome: string;
    }>;
  };
  expect(
    projectionBody.reconciliations.find(
      (item) => item.id === reconciliationId,
    ),
  ).toMatchObject({ status: "reviewed", revision: 2 });
  expect(
    projectionBody.reconciliationReviews.filter(
      (item) => item.reconciliationId === reconciliationId,
    ),
  ).toEqual([
    expect.objectContaining({ outcome: "exceptions_noted" }),
  ]);
  expect(
    projectionBody.reconciliationFindings
      .filter((item) => item.reconciliationId === reconciliationId)
      .every((item) => item.status === "accepted_exception"),
  ).toBe(true);
});
