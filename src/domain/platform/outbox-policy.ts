export const OUTBOX_MAX_ATTEMPTS = 5;
export const OUTBOX_LEASE_MS = 30_000;

export type OutboxStatus = "pending" | "leased" | "processed" | "dead_letter";

export interface OutboxState {
  status: OutboxStatus;
  attempts: number;
  availableAt: Date;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  lastError: string | null;
  processedAt: Date | null;
  failedAt: Date | null;
}

export function canLease(message: OutboxState, now: Date) {
  const leaseExpired = message.status === "leased" && message.leaseExpiresAt !== null && message.leaseExpiresAt <= now;
  return (message.status === "pending" || leaseExpired) && message.availableAt <= now;
}

export function leaseMessage(message: OutboxState, workerId: string, now: Date): OutboxState {
  if (!workerId.trim()) throw new Error("A worker identity is required");
  if (!canLease(message, now)) throw new Error("Outbox message is not leaseable");
  return { ...message, status: "leased", leaseOwner: workerId, leaseExpiresAt: new Date(now.getTime() + OUTBOX_LEASE_MS) };
}

export function recordDeliverySuccess(message: OutboxState, workerId: string, now: Date): OutboxState {
  assertLease(message, workerId, now);
  return { ...message, status: "processed", attempts: message.attempts + 1, processedAt: now, leaseOwner: null, leaseExpiresAt: null, lastError: null };
}

export function recordDeliveryFailure(message: OutboxState, workerId: string, now: Date, error: string, maxAttempts = OUTBOX_MAX_ATTEMPTS): OutboxState {
  assertLease(message, workerId, now);
  const attempts = message.attempts + 1;
  const deadLetter = attempts >= maxAttempts;
  return {
    ...message,
    status: deadLetter ? "dead_letter" : "pending",
    attempts,
    availableAt: deadLetter ? message.availableAt : new Date(now.getTime() + retryDelayMs(attempts)),
    leaseOwner: null,
    leaseExpiresAt: null,
    lastError: error.slice(0, 500),
    failedAt: deadLetter ? now : message.failedAt,
  };
}

export function replayDeadLetter(message: OutboxState, now: Date): OutboxState {
  if (message.status !== "dead_letter") throw new Error("Only dead-letter messages may be replayed");
  return { ...message, status: "pending", attempts: 0, availableAt: now, leaseOwner: null, leaseExpiresAt: null, lastError: null, failedAt: null };
}

export function retryDelayMs(attempt: number) {
  return Math.min(15 * 60_000, 1_000 * 2 ** Math.max(0, attempt - 1));
}

function assertLease(message: OutboxState, workerId: string, now: Date) {
  if (message.status !== "leased" || message.leaseOwner !== workerId || !message.leaseExpiresAt || message.leaseExpiresAt < now) {
    throw new Error("A current matching lease is required");
  }
}
