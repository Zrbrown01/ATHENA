import { describe, expect, it } from "vitest";
import { OptimisticConcurrencyError, rethrowOptimisticClaimConflict } from "./optimistic-concurrency";

describe("optimistic concurrency conflict mapping", () => {
  it("maps only the revision-claim uniqueness failure to a retryable domain conflict", () => {
    expect(() => rethrowOptimisticClaimConflict(new Error("UNIQUE constraint failed: optimistic_write_claims.tenant_id, optimistic_write_claims.aggregate_type, optimistic_write_claims.aggregate_id, optimistic_write_claims.expected_revision"))).toThrow(OptimisticConcurrencyError);
    const idempotencyConflict = new Error("UNIQUE constraint failed: optimistic_write_claims.tenant_id, optimistic_write_claims.idempotency_key");
    expect(() => rethrowOptimisticClaimConflict(idempotencyConflict)).toThrow(idempotencyConflict);
    const other = new Error("database unavailable");
    expect(() => rethrowOptimisticClaimConflict(other)).toThrow(other);
  });
});
