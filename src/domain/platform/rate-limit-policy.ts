export interface RateLimitPolicy { limit: number; windowMs: number }

export function rateLimitWindow(now: Date, policy: RateLimitPolicy) {
  if (!Number.isInteger(policy.limit) || policy.limit < 1) throw new Error("Rate limit must be a positive integer");
  if (!Number.isInteger(policy.windowMs) || policy.windowMs < 1_000) throw new Error("Rate-limit window must be at least one second");
  const startedMs = Math.floor(now.getTime() / policy.windowMs) * policy.windowMs;
  return { startedAt: new Date(startedMs), expiresAt: new Date(startedMs + policy.windowMs), retryAfterSeconds: Math.max(1, Math.ceil((startedMs + policy.windowMs - now.getTime()) / 1_000)) };
}
