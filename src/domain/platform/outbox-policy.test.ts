import { describe, expect, it } from "vitest";
import { canLease, leaseMessage, recordDeliveryFailure, recordDeliverySuccess, replayDeadLetter, retryDelayMs, type OutboxState } from "./outbox-policy";

const now = new Date("2026-08-20T17:00:00.000Z");
const pending = (): OutboxState => ({ status: "pending", attempts: 0, availableAt: now, leaseOwner: null, leaseExpiresAt: null, lastError: null, processedAt: null, failedAt: null });

describe("outbox policy", () => {
  it("leases an eligible message and requires the same live worker lease to complete it", () => {
    const leased = leaseMessage(pending(), "worker-a", now);
    expect(canLease(leased, now)).toBe(false);
    expect(() => recordDeliverySuccess(leased, "worker-b", now)).toThrow(/matching lease/);
    expect(recordDeliverySuccess(leased, "worker-a", now)).toMatchObject({ status: "processed", attempts: 1, leaseOwner: null });
  });

  it("releases expired leases for recovery", () => {
    const expired = { ...leaseMessage(pending(), "worker-a", now), leaseExpiresAt: new Date(now.getTime() - 1) };
    expect(canLease(expired, now)).toBe(true);
    expect(leaseMessage(expired, "worker-b", now).leaseOwner).toBe("worker-b");
  });

  it("backs off failures and dead-letters at the attempt ceiling", () => {
    const first = recordDeliveryFailure(leaseMessage(pending(), "worker-a", now), "worker-a", now, "temporary");
    expect(first).toMatchObject({ status: "pending", attempts: 1, lastError: "temporary" });
    expect(first.availableAt.getTime() - now.getTime()).toBe(retryDelayMs(1));
    const finalLease = leaseMessage({ ...pending(), attempts: 4 }, "worker-a", now);
    const final = recordDeliveryFailure(finalLease, "worker-a", now, "permanent");
    expect(final).toMatchObject({ status: "dead_letter", attempts: 5, failedAt: now });
    expect(replayDeadLetter(final, now)).toMatchObject({ status: "pending", attempts: 0, failedAt: null });
  });
});
