import { expect, test, type APIRequestContext } from "@playwright/test";

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

type Projection = {
  candidate: {
    status: string;
    revision: number;
    missingFields: string[];
  } | null;
  unresolvedMatchCount: number;
  openConflictCount: number;
  openingObligations: Array<{
    id: string;
    ruleCode: string;
    ruleVersion: number;
    triggerSourceType: string;
    triggerSourceId: string;
    dueAt: string;
  }>;
  persistence?: { replayed: boolean };
};

async function read(request: APIRequestContext) {
  const response = await request.get("/api/intake/candidates/golden", {
    headers: owner,
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as Projection;
}

async function write(
  request: APIRequestContext,
  data: Record<string, unknown>,
) {
  return request.post("/api/intake/candidates/golden", {
    headers: writeHeaders,
    data,
  });
}

test("matter opening atomically creates the complete governed deadline bundle", async ({
  request,
}) => {
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  let projection = await read(request);
  if (!projection.candidate) {
    const response = await write(request, {
      action: "create_candidate",
      idempotencyKey: `intake-opening-create-${suffix}`,
    });
    expect(response.status()).toBe(200);
    projection = (await response.json()) as Projection;
  }

  while (projection.candidate?.status !== "opened") {
    const revision = projection.candidate!.revision;
    let data: Record<string, unknown>;
    if (projection.unresolvedMatchCount) {
      data = {
        action: "resolve_match",
        expectedRevision: revision,
        disposition: "ruled_out",
        reason:
          "Exact claim and ADJ review proves the synthetic referral is not a duplicate.",
      };
    } else if (projection.openConflictCount) {
      data = {
        action: "clear_conflict",
        expectedRevision: revision,
        reason:
          "Partner verified that the synthetic prior representation is unrelated.",
      };
    } else if (projection.candidate!.missingFields.length) {
      data = {
        action: "supply_information",
        expectedRevision: revision,
        fields: ["claims_professional_email"],
        reason:
          "Claims professional email was verified from the preserved synthetic source.",
      };
    } else {
      const approve = (attempt: string) => ({
        action: "approve_open",
        expectedRevision: revision,
        openingTriggerDate: "2026-08-20",
        syntheticDataAcknowledged: true,
        reason:
          "Attorney approved matter opening and the complete synthetic opening-rule bundle.",
        idempotencyKey: `intake-opening-approve-${attempt}-${suffix}`,
      });
      const raced = await Promise.all([
        write(request, approve("a")),
        write(request, approve("b")),
      ]);
      expect(raced.map((response) => response.status()).sort()).toEqual([
        200, 409,
      ]);
      projection = (await raced
        .find((response) => response.status() === 200)!
        .json()) as Projection;
      break;
    }
    data.idempotencyKey = `intake-opening-${data.action}-${suffix}`;
    const response = await write(request, data);
    expect(response.status()).toBe(200);
    projection = (await response.json()) as Projection;
  }

  if (projection.openingObligations.length === 0) {
    const migrate = (attempt: string) => ({
      action: "materialize_initial_obligations",
      expectedRevision: projection.candidate!.revision,
      openingTriggerDate: "2026-08-20",
      syntheticDataAcknowledged: true,
      reason:
        "Attorney migrated the already-open pilot matter to the complete synthetic opening-rule bundle.",
      idempotencyKey: `intake-opening-migrate-${attempt}-${suffix}`,
    });
    const raced = await Promise.all([
      write(request, migrate("a")),
      write(request, migrate("b")),
    ]);
    expect(raced.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);
    projection = (await raced
      .find((response) => response.status() === 200)!
      .json()) as Projection;
  }

  expect(projection.openingObligations).toHaveLength(2);
  expect(
    projection.openingObligations.map((item) => [
      item.ruleCode,
      item.ruleVersion,
      item.dueAt.slice(0, 10),
    ]),
  ).toEqual([
    ["synthetic-opening-assignment-acknowledgment", 1, "2026-08-21"],
    ["synthetic-opening-initial-report", 1, "2026-09-04"],
  ]);
  expect(
    projection.openingObligations.every(
      (item) =>
        item.triggerSourceType === "intake_candidate" &&
        item.triggerSourceId === "intake-golden-001",
    ),
  ).toBe(true);
});
