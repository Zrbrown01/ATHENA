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

test("dependent deadline, exception, and escalation controls persist atomically", async ({
  request,
}) => {
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const predecessorId = `obligation-parent-${suffix}`;
  const dependentId = `obligation-dependent-${suffix}`;
  const dependencyId = `obligation-dependency-${suffix}`;
  const exceptionId = `obligation-exception-${suffix}`;
  const escalationId = `obligation-escalation-${suffix}`;

  const created = await request.post("/api/obligations", {
    headers: writeHeaders,
    data: {
      action: "create",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      ruleCode: "firm-pilot-qme-review",
      title: "Synthetic governed QME review",
      requirement:
        "Verify source-linked QME findings before synthetic client reporting.",
      triggerDate: "2026-08-20",
      triggerSourceType: "document",
      triggerSourceId: `document-${suffix}`,
      ownerId: "user-maya-chen",
      sandboxAcknowledged: true,
      idempotencyKey: predecessorId,
    },
  });
  expect(created.status()).toBe(200);

  const dependent = await request.post("/api/obligations/governance", {
    headers: writeHeaders,
    data: {
      action: "create_dependent",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      predecessorObligationId: predecessorId,
      expectedPredecessorRevision: 1,
      dependentObligationId: dependentId,
      dependencyId,
      relationType: "preparation_before",
      offsetBusinessDays: 2,
      title: "Prepare synthetic QME source packet",
      requirement:
        "Assemble source pages and issue checklist before the synthetic review.",
      ownerId: "user-sara-kim",
      reason:
        "Synthetic preparation dependency demonstrates controlled ordering only.",
      idempotencyKey: `dependency-create-${suffix}`,
    },
  });
  expect(dependent.status()).toBe(200);
  const dependentBody = (await dependent.json()) as {
    items: Array<{ id: string; dueAt: string; revision: number }>;
    dependencies: Array<{
      id: string;
      blocksPredecessorCompletion: boolean;
    }>;
  };
  expect(
    dependentBody.items.find((item) => item.id === dependentId),
  ).toMatchObject({ revision: 1 });
  expect(
    dependentBody.items
      .find((item) => item.id === dependentId)
      ?.dueAt.slice(0, 10),
  ).toBe("2026-08-26");
  expect(
    dependentBody.dependencies.find((item) => item.id === dependencyId),
  ).toMatchObject({ blocksPredecessorCompletion: true });

  const blockedCompletion = await request.post("/api/obligations", {
    headers: writeHeaders,
    data: {
      action: "complete",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      obligationId: predecessorId,
      expectedRevision: 2,
      evidence: "Attempted completion before the dependent source packet.",
      idempotencyKey: `parent-complete-blocked-${suffix}`,
    },
  });
  expect(blockedCompletion.status()).toBe(400);
  expect(await blockedCompletion.json()).toEqual({
    error: "Complete every blocking dependent obligation first",
  });

  const requested = await request.post("/api/obligations/governance", {
    headers: writeHeaders,
    data: {
      action: "request_exception",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      obligationId: dependentId,
      expectedRevision: 1,
      exceptionId,
      exceptionType: "due_date_exception",
      proposedDueDate: "2026-08-27",
      reason:
        "Synthetic packet review requires one additional controlled business day.",
      authorityBasis:
        "Matter-specific firm workflow only; no court or statutory extension is claimed.",
      idempotencyKey: `exception-request-${suffix}`,
    },
  });
  expect(requested.status()).toBe(200);

  const prematureEscalation = await request.post(
    "/api/obligations/governance",
    {
      headers: writeHeaders,
      data: {
        action: "evaluate_escalation",
        tenantId: "tenant-golden",
        matterId: "matter-golden-001",
        obligationId: dependentId,
        expectedRevision: 2,
        escalationId: `premature-${escalationId}`,
        asOfDate: "2026-08-27",
        idempotencyKey: `escalation-premature-${suffix}`,
      },
    },
  );
  expect(prematureEscalation.status()).toBe(400);
  expect((await prematureEscalation.json()).error).toMatch(/pending exception/);

  const decide = (attempt: string) =>
    request.post("/api/obligations/governance", {
      headers: writeHeaders,
      data: {
        action: "decide_exception",
        tenantId: "tenant-golden",
        matterId: "matter-golden-001",
        obligationId: dependentId,
        expectedRevision: 2,
        exceptionId,
        expectedExceptionRevision: 1,
        outcome: "approved",
        decisionReason:
          "Partner approved a synthetic firm-workflow adjustment with original evidence preserved.",
        idempotencyKey: `exception-decision-${attempt}-${suffix}`,
      },
    });
  const decisions = await Promise.all([decide("a"), decide("b")]);
  expect(decisions.map((response) => response.status()).sort()).toEqual([
    200, 409,
  ]);

  const escalated = await request.post("/api/obligations/governance", {
    headers: writeHeaders,
    data: {
      action: "evaluate_escalation",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      obligationId: dependentId,
      expectedRevision: 3,
      escalationId,
      asOfDate: "2026-08-31",
      idempotencyKey: `escalation-evaluate-${suffix}`,
    },
  });
  expect(escalated.status()).toBe(200);

  const acknowledge = (attempt: string) =>
    request.post("/api/obligations/governance", {
      headers: writeHeaders,
      data: {
        action: "acknowledge_escalation",
        tenantId: "tenant-golden",
        matterId: "matter-golden-001",
        obligationId: dependentId,
        escalationId,
        expectedEscalationRevision: 1,
        response:
          "Partner acknowledged the synthetic breach, confirmed ownership, and preserved follow-up evidence.",
        idempotencyKey: `escalation-ack-${attempt}-${suffix}`,
      },
    });
  const acknowledgments = await Promise.all([
    acknowledge("a"),
    acknowledge("b"),
  ]);
  expect(
    acknowledgments.map((response) => response.status()).sort(),
  ).toEqual([200, 409]);

  const projection = await request.get("/api/obligations/governance", {
    headers: owner,
  });
  expect(projection.status()).toBe(200);
  const projectionBody = (await projection.json()) as {
    items: Array<{ id: string; dueAt: string; revision: number }>;
    exceptions: Array<{
      id: string;
      status: string;
      revision: number;
    }>;
    escalations: Array<{
      id: string;
      level: string;
      status: string;
      revision: number;
    }>;
  };
  expect(
    projectionBody.items.find((item) => item.id === dependentId),
  ).toMatchObject({ revision: 4 });
  expect(
    projectionBody.items
      .find((item) => item.id === dependentId)
      ?.dueAt.slice(0, 10),
  ).toBe("2026-08-27");
  expect(
    projectionBody.exceptions.find((item) => item.id === exceptionId),
  ).toMatchObject({ status: "approved", revision: 2 });
  expect(
    projectionBody.escalations.find((item) => item.id === escalationId),
  ).toMatchObject({ level: "breached", status: "acknowledged", revision: 2 });
});
