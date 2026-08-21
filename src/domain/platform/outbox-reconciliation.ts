export function assessOutboxReconciliation(input: { processedMessages: number; checkpoints: number; deliveryReceipts: number }) {
  for (const value of Object.values(input)) if (!Number.isInteger(value) || value < 0) throw new Error("Reconciliation counts must be non-negative integers");
  const exceptions = Math.abs(input.processedMessages - input.checkpoints) + Math.abs(input.checkpoints - input.deliveryReceipts);
  return { ...input, exceptions, outcome: exceptions === 0 ? "matched" as const : "exceptions" as const, detail: exceptions === 0 ? "Processed rows, consumer checkpoints, and internal delivery receipts reconcile." : "Count mismatch detected; inspect outbox, checkpoints, and receipts before replaying anything." };
}
