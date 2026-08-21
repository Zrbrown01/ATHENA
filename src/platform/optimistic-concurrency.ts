export class OptimisticConcurrencyError extends Error {
  constructor(message = "Record changed; refresh before retrying") {
    super(message);
    this.name = "OptimisticConcurrencyError";
  }
}

export function rethrowOptimisticClaimConflict(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("idx_optimistic_write_claim") ||
    (message.includes("UNIQUE constraint failed") &&
      message.includes("optimistic_write_claims.aggregate_id") &&
      message.includes("optimistic_write_claims.expected_revision"))
  ) {
    throw new OptimisticConcurrencyError();
  }
  throw error;
}
