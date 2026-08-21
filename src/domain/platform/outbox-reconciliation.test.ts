import { describe, expect, it } from "vitest";
import { assessOutboxReconciliation } from "./outbox-reconciliation";

describe("outbox reconciliation", () => {
  it("matches equal processed/checkpoint/receipt counts", () => expect(assessOutboxReconciliation({ processedMessages: 12, checkpoints: 12, deliveryReceipts: 12 })).toMatchObject({ outcome: "matched", exceptions: 0 }));
  it("makes both mismatch legs explicit", () => expect(assessOutboxReconciliation({ processedMessages: 10, checkpoints: 8, deliveryReceipts: 7 })).toMatchObject({ outcome: "exceptions", exceptions: 3 }));
  it("rejects invalid counts", () => expect(() => assessOutboxReconciliation({ processedMessages: -1, checkpoints: 0, deliveryReceipts: 0 })).toThrow(/non-negative/));
});
