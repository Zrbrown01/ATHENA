import { describe, expect, it } from "vitest";
import { rateLimitWindow } from "./rate-limit-policy";

describe("rate limit windows", () => {
  it("produces a deterministic fixed window and retry delay", () => {
    expect(rateLimitWindow(new Date("2026-08-20T12:00:45.250Z"), { limit: 30, windowMs: 60_000 })).toEqual({ startedAt: new Date("2026-08-20T12:00:00.000Z"), expiresAt: new Date("2026-08-20T12:01:00.000Z"), retryAfterSeconds: 15 });
  });
  it("rejects unsafe policy values", () => {
    expect(() => rateLimitWindow(new Date(), { limit: 0, windowMs: 60_000 })).toThrow(/positive/);
    expect(() => rateLimitWindow(new Date(), { limit: 1, windowMs: 999 })).toThrow(/one second/);
  });
});
