import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, lte, or, sql } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { outboxDeliveries, previewOutbox } from "../../db/schema";

export interface OutboxHealth {
  pending: number;
  leased: number;
  processed: number;
  deadLetter: number;
  oldestReadyAt: string | null;
  lastError: string | null;
}

export async function readOutboxHealth(tenantId: string): Promise<OutboxHealth> {
  const db = getPreviewDb();
  const rows = await db.select({ status: previewOutbox.status, availableAt: previewOutbox.availableAt, lastError: previewOutbox.lastError })
    .from(previewOutbox).where(eq(previewOutbox.tenantId, tenantId)).orderBy(asc(previewOutbox.availableAt));
  return {
    pending: rows.filter((row) => row.status === "pending").length,
    leased: rows.filter((row) => row.status === "leased").length,
    processed: rows.filter((row) => row.status === "processed").length,
    deadLetter: rows.filter((row) => row.status === "dead_letter").length,
    oldestReadyAt: rows.find((row) => row.status === "pending")?.availableAt.toISOString() ?? null,
    lastError: [...rows].reverse().find((row) => row.lastError)?.lastError ?? null,
  };
}

export async function publishReadyInternalEvents(tenantId: string, workerId: string, now = new Date(), limit = 25) {
  const db = getPreviewDb();
  const eligible = await db.select().from(previewOutbox).where(and(
    eq(previewOutbox.tenantId, tenantId),
    lte(previewOutbox.availableAt, now),
    or(
      eq(previewOutbox.status, "pending"),
      and(eq(previewOutbox.status, "leased"), lte(previewOutbox.leaseExpiresAt, now)),
    ),
  )).orderBy(asc(previewOutbox.availableAt)).limit(Math.min(100, Math.max(1, limit)));

  let delivered = 0;
  for (const message of eligible) {
    const leaseExpiresAt = new Date(now.getTime() + 30_000);
    const leased = await db.update(previewOutbox).set({ status: "leased", leaseOwner: workerId, leaseExpiresAt })
      .where(and(eq(previewOutbox.id, message.id), eq(previewOutbox.tenantId, tenantId), or(
        eq(previewOutbox.status, "pending"),
        and(eq(previewOutbox.status, "leased"), lte(previewOutbox.leaseExpiresAt, now)),
      ))).returning({ id: previewOutbox.id });
    if (leased.length !== 1) continue;
    const attempt = message.attempts + 1;
    await db.batch([
      db.insert(outboxDeliveries).values({
        id: createId(), tenantId, outboxId: message.id, eventId: message.eventId,
        destination: "athena_internal_event_bus", outcome: "delivered", attempt,
        detail: "Accepted by the Athena-native internal projection sink; no external provider delivery is implied.", createdAt: now,
      }).onConflictDoNothing(),
      db.update(previewOutbox).set({
        status: "processed", attempts: sql`${previewOutbox.attempts} + 1`, processedAt: now,
        leaseOwner: null, leaseExpiresAt: null, lastError: null,
      }).where(and(eq(previewOutbox.id, message.id), eq(previewOutbox.tenantId, tenantId), eq(previewOutbox.leaseOwner, workerId))),
    ]);
    delivered += 1;
  }
  return { delivered, inspected: eligible.length };
}

export async function replayDeadLetters(tenantId: string, now = new Date()) {
  const db = getPreviewDb();
  const replayed = await db.update(previewOutbox).set({ status: "pending", attempts: 0, availableAt: now, leaseOwner: null, leaseExpiresAt: null, lastError: null, failedAt: null })
    .where(and(eq(previewOutbox.tenantId, tenantId), eq(previewOutbox.status, "dead_letter"))).returning({ id: previewOutbox.id });
  return { replayed: replayed.length };
}
