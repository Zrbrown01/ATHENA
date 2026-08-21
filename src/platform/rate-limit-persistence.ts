import { sql } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { rateLimitWindows } from "../../db/schema";
import { rateLimitWindow, type RateLimitPolicy } from "@/domain/platform/rate-limit-policy";

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) { super("Too many requests"); this.name = "RateLimitError"; }
}

const DEFAULT_POLICY: RateLimitPolicy = { limit: 30, windowMs: 60_000 };

export async function enforceRateLimit(input: { tenantId: string; actorId: string; action: string; now?: Date; policy?: RateLimitPolicy }) {
  const now = input.now ?? new Date();
  const policy = input.policy ?? DEFAULT_POLICY;
  const window = rateLimitWindow(now, policy);
  const id = `${input.tenantId}:${input.actorId}:${input.action}:${window.startedAt.getTime()}`;
  const [result] = await getPreviewDb().insert(rateLimitWindows).values({ id, tenantId: input.tenantId, actorId: input.actorId, action: input.action, windowStartedAt: window.startedAt, count: 1, limit: policy.limit, expiresAt: window.expiresAt, updatedAt: now })
    .onConflictDoUpdate({ target: rateLimitWindows.id, set: { count: sql`${rateLimitWindows.count} + 1`, updatedAt: now } }).returning({ count: rateLimitWindows.count });
  if (result.count > policy.limit) throw new RateLimitError(window.retryAfterSeconds);
  return { count: result.count, limit: policy.limit, remaining: Math.max(0, policy.limit - result.count), resetAt: window.expiresAt };
}

export function rateLimitResponse(error: RateLimitError) {
  return Response.json({ error: "Too many requests", retryAfterSeconds: error.retryAfterSeconds }, { status: 429, headers: { "retry-after": String(error.retryAfterSeconds), "cache-control": "no-store" } });
}
