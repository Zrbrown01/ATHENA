import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  reconcile: vi.fn(),
  heartbeat: vi.fn(),
}));

vi.mock("./outbox-persistence", () => ({
  publishReadyInternalEvents: mocks.publish,
  reconcileInternalOutbox: mocks.reconcile,
}));
vi.mock("./automation-heartbeat-persistence", () => ({
  recordInternalAutomationHeartbeat: mocks.heartbeat,
}));

import { runScheduledInternalDelivery } from "./outbox-scheduler";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.publish.mockResolvedValue({ delivered: 3, deduplicated: 2, inspected: 5 });
  mocks.reconcile.mockResolvedValue({ id: "reconcile-1", outcome: "matched", exceptions: 0, detail: "Matched" });
  mocks.heartbeat.mockResolvedValue({ finishedAt: new Date("2026-08-20T12:00:01.000Z") });
});

describe("scheduled internal delivery", () => {
  it("records successful cron evidence after reconciliation", async () => {
    const scheduledAt = new Date("2026-08-20T12:00:00.000Z");
    await expect(runScheduledInternalDelivery({ trigger: "cron:*/5 * * * *", scheduledAt })).resolves.toMatchObject({ externalDelivery: false });
    expect(mocks.heartbeat).toHaveBeenCalledWith(expect.objectContaining({
      trigger: "cron:*/5 * * * *",
      scheduledFor: scheduledAt,
      outcome: "succeeded",
      detail: expect.stringContaining("0 reconciliation exceptions"),
    }));
  });

  it("preserves the originating failure even when heartbeat persistence also fails", async () => {
    const original = new TypeError("synthetic scheduler failure");
    mocks.publish.mockRejectedValue(original);
    mocks.heartbeat.mockRejectedValue(new Error("health ledger unavailable"));
    await expect(runScheduledInternalDelivery({ trigger: "cron:*/5 * * * *" })).rejects.toBe(original);
    expect(mocks.heartbeat).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "failed",
      detail: expect.stringContaining("TypeError"),
    }));
  });
});

