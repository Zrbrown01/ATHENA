import { expect, test, type APIRequestContext } from "@playwright/test";

const owner = { "oai-authenticated-user-id": "user-maya-chen", "oai-authenticated-user-email": "user-maya-chen@example.test", "oai-authenticated-user-full-name": encodeURIComponent("user-maya-chen"), "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8" };
const writeHeaders = { ...owner, "content-type": "application/json", origin: "http://localhost:3000" };
async function write(request: APIRequestContext, data: Record<string, unknown>) { return request.post("/api/tasks/recurrence", { headers: writeHeaders, data }); }

test("recurring tasks preserve approval, exception, bounded occurrence, idempotency, and single-winner evidence", async ({ request }) => {
  const suffix = `${Date.now()}-${test.info().workerIndex}`, seriesId = `task-series-e2e-${suffix}`, base = { tenantId: "tenant-golden", matterId: "matter-golden-001", seriesId };
  let response = await write(request, { action: "create_series", ...base, idempotencyKey: `task-series-create-${suffix}`, title: "Prepare recurring litigation status report", taskType: "client_reporting", priority: "high", ownerId: "user-maya-chen", cadence: "monthly", interval: 1, dayOfMonth: 31, startsOn: "2026-01-31", endsOn: "2026-04-30", occurrenceLimit: 4, timezone: "America/Los_Angeles" });
  expect(response.status()).toBe(200);
  response = await write(request, { action: "activate_series", ...base, expectedRevision: 1, approval: "Attorney approved the bounded recurring reporting schedule.", idempotencyKey: `task-series-activate-${suffix}` });
  expect(response.status()).toBe(200);
  response = await write(request, { action: "set_exception", ...base, expectedRevision: 2, nominalDueOn: "2026-02-28", exceptionAction: "move", movedDueOn: "2026-03-02", reason: "Move this occurrence to incorporate the scheduled medical update.", idempotencyKey: `task-series-exception-${suffix}` });
  expect(response.status()).toBe(200);
  const materialize = (attempt: string) => write(request, { action: "materialize_window", ...base, expectedRevision: 3, throughDate: "2026-04-30", idempotencyKey: `task-series-materialize-${attempt}-${suffix}` });
  const raced = await Promise.all([materialize("a"), materialize("b")]);
  expect(raced.map(item => item.status()).sort()).toEqual([200, 409]);
  expect(await raced.find(item => item.status() === 409)!.json()).toEqual({ error: "Record changed; refresh before retrying" });
  const winner = raced[0].status() === 200 ? "a" : "b";
  const replay = await materialize(winner);
  expect(replay.status()).toBe(200);
  expect((await replay.json() as { persistence: { replayed: boolean } }).persistence.replayed).toBe(true);
  const projectionResponse = await request.get("/api/tasks/recurrence", { headers: owner });
  expect(projectionResponse.status()).toBe(200);
  const projection = await projectionResponse.json() as { series: Array<{ id: string; status: string; revision: number; materializedCount: number }>; occurrences: Array<{ seriesId: string; nominalDueOn: string; effectiveDueOn: string | null; exceptionAction: string }> };
  expect(projection.series.find(item => item.id === seriesId)).toMatchObject({ status: "active", revision: 4, materializedCount: 4 });
  const occurrences = projection.occurrences.filter(item => item.seriesId === seriesId);
  expect(occurrences.map(item => [item.nominalDueOn.slice(0, 10), item.effectiveDueOn?.slice(0, 10), item.exceptionAction])).toEqual([["2026-01-31", "2026-01-31", "none"], ["2026-02-28", "2026-03-02", "move"], ["2026-03-31", "2026-03-31", "none"], ["2026-04-30", "2026-04-30", "none"]]);
  response = await write(request, { action: "cancel_series", ...base, expectedRevision: 4, reason: "Attorney ended future recurrence while preserving existing work.", idempotencyKey: `task-series-cancel-${suffix}` });
  expect(response.status()).toBe(200);
  const tasksResponse = await request.get("/api/tasks", { headers: owner });
  const tasks = (await tasksResponse.json() as { items: Array<{ recurrenceSeriesId: string | null; status: string }> }).items.filter(item => item.recurrenceSeriesId === seriesId);
  expect(tasks).toHaveLength(4);
  expect(tasks.every(item => item.status === "open")).toBe(true);
});
