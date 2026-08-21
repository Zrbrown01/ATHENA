import { expect, test, type APIRequestContext } from "@playwright/test";

const principal = (userId: string) => ({
  "oai-authenticated-user-id": userId,
  "oai-authenticated-user-email": `${userId}@example.test`,
  "oai-authenticated-user-full-name": encodeURIComponent(userId),
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
});

const owner = principal("user-maya-chen");
const outsider = principal("outsider-e2e");
const support = principal("support-e2e");

async function expectDenied(request: APIRequestContext, path: string, headers: Record<string, string>) {
  const response = await request.get(path, { headers });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: "Access denied" });
}

test("owner-only and matter-scoped reads deny outsider and standing support access", async ({ request }) => {
  const protectedReads = [
    "/api/admin/costs",
    "/api/documents/evidence",
    "/api/admin/tenant-exports",
    "/api/search?q=Rivera",
    "/api/matters/golden/graph",
  ];

  for (const path of protectedReads) {
    const allowed = await request.get(path, { headers: owner });
    expect(allowed.status(), path).toBe(200);
    await expectDenied(request, path, outsider);
    await expectDenied(request, path, support);
  }
});

test("configured support still requires a current matter-scoped grant", async ({ request }) => {
  const response = await request.get(
    "/api/support/access?matterId=matter-golden-001",
    { headers: support },
  );
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({
    error: "Active matter-scoped support approval is required",
  });
});

test("cross-tenant finance command is denied without any golden-tenant mutation", async ({ request }) => {
  const beforeResponse = await request.get("/api/admin/costs", { headers: owner });
  expect(beforeResponse.status()).toBe(200);
  const before = await beforeResponse.json() as {
    rateCards: unknown[];
    decisions: unknown[];
  };

  const response = await request.post("/api/admin/costs", {
    headers: {
      ...owner,
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    data: {
      action: "create_rate_card",
      tenantId: "tenant-foreign-e2e",
      rateCardId: "foreign-rate-card-e2e",
      idempotencyKey: "foreign-rate-card-e2e-create",
      name: "Foreign tenant rate card",
      currency: "USD",
      sourceType: "synthetic_estimate",
      sourceRef: "Cross-tenant isolation test evidence only.",
      effectiveAt: "2026-08-20T12:00:00.000Z",
      rates: [{ category: "ai", unit: "token_1k", unitRateMicros: 100 }],
      syntheticAcknowledged: true,
    },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: "Access denied" });

  const afterResponse = await request.get("/api/admin/costs", { headers: owner });
  expect(afterResponse.status()).toBe(200);
  const after = await afterResponse.json() as {
    rateCards: unknown[];
    decisions: unknown[];
  };
  expect(after.rateCards).toHaveLength(before.rateCards.length);
  expect(after.decisions).toHaveLength(before.decisions.length);
});

