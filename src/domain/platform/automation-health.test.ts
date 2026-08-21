import { describe, expect, it } from "vitest";
import { assessAutomationHealth, type AutomationHeartbeat } from "./automation-health";

const now = new Date("2026-08-20T12:10:00.000Z");
const heartbeat = (overrides: Partial<AutomationHeartbeat> = {}): AutomationHeartbeat => ({
  trigger: "cron:*/5 * * * *",
  scheduledFor: new Date("2026-08-20T12:05:00.000Z"),
  finishedAt: new Date("2026-08-20T12:05:02.000Z"),
  outcome: "succeeded",
  detail: "Internal delivery and reconciliation completed with zero exceptions.",
  ...overrides,
});

describe("automation health", () => {
  it("does not infer connectivity without a cron heartbeat", () => {
    expect(assessAutomationHealth(null, now).status).toBe("not_connected");
  });

  it("distinguishes healthy, stale, and failed scheduler evidence", () => {
    expect(assessAutomationHealth(heartbeat(), now).status).toBe("healthy");
    expect(assessAutomationHealth(heartbeat({ scheduledFor: new Date("2026-08-20T11:55:00.000Z") }), now).status).toBe("stale");
    expect(assessAutomationHealth(heartbeat({ outcome: "failed", detail: "Error" }), now)).toMatchObject({ status: "failed", detail: "Error" });
  });
});
