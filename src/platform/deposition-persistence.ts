import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  calendarEvents,
  depositionArtifacts,
  depositionDecisions,
  depositions,
  integrationHandoffs,
  previewEvents,
  previewOutbox,
} from "../../db/schema";
import type {
  DepositionCommand,
  DepositionState,
} from "@/domain/depositions/lifecycle";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";
export async function readDeposition(t: string, m: string, id: string) {
  const [x] = await getPreviewDb()
    .select()
    .from(depositions)
    .where(
      and(
        eq(depositions.tenantId, t),
        eq(depositions.matterId, m),
        eq(depositions.id, id),
      ),
    )
    .limit(1);
  return x ?? null;
}
export async function readDepositionEvent(t: string, key: string) {
  const [x] = await getPreviewDb()
    .select({ eventId: previewEvents.eventId })
    .from(previewEvents)
    .where(
      and(eq(previewEvents.tenantId, t), eq(previewEvents.idempotencyKey, key)),
    )
    .limit(1);
  return x ?? null;
}
export async function depositionProjection(t: string, m: string) {
  const db = getPreviewDb(),
    [items, artifacts, decisions] = await Promise.all([
      db
        .select()
        .from(depositions)
        .where(and(eq(depositions.tenantId, t), eq(depositions.matterId, m))),
      db
        .select()
        .from(depositionArtifacts)
        .where(
          and(
            eq(depositionArtifacts.tenantId, t),
            eq(depositionArtifacts.matterId, m),
          ),
        )
        .orderBy(asc(depositionArtifacts.createdAt)),
      db
        .select()
        .from(depositionDecisions)
        .where(
          and(
            eq(depositionDecisions.tenantId, t),
            eq(depositionDecisions.matterId, m),
          ),
        )
        .orderBy(asc(depositionDecisions.createdAt)),
    ]);
  return { items, artifacts, decisions };
}
export async function persistDeposition(input: {
  command: DepositionCommand;
  fromStatus: string;
  toStatus: DepositionState["status"] | "requested";
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
}) {
  const db = getPreviewDb(),
    c = input.command,
    now = new Date(input.event.occurredAt),
    eventWrite = db
      .insert(previewEvents)
      .values({
        eventId: input.event.eventId,
        eventType: input.event.eventType,
        eventVersion: input.event.eventVersion,
        tenantId: c.tenantId,
        aggregateType: input.event.aggregateType,
        aggregateId: input.event.aggregateId,
        matterId: c.matterId,
        actorId: input.actor.userId,
        occurredAt: now,
        correlationId: input.event.correlationId,
        causationId: input.event.causationId,
        idempotencyKey: input.event.idempotencyKey,
        source: input.event.source,
        visibility: input.event.visibility,
        retentionPolicy: input.event.retentionPolicy,
        payload: input.event.payload,
      }),
    outboxWrite = db
      .insert(previewOutbox)
      .values({
        id: createId(),
        tenantId: c.tenantId,
        eventId: input.event.eventId,
        topic: "athena.depositions",
        payload: input.event,
        attempts: 0,
        availableAt: now,
      }),
    decisionWrite = db
      .insert(depositionDecisions)
      .values({
        id: createId(),
        tenantId: c.tenantId,
        matterId: c.matterId,
        depositionId: c.depositionId,
        action: c.action,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        reason: reason(c),
        actorId: input.actor.userId,
        eventId: input.event.eventId,
        idempotencyKey: c.idempotencyKey,
        createdAt: now,
      }),
    writes: unknown[] = [];
  if (c.action === "request_deposition")
    writes.push(
      db
        .insert(depositions)
        .values({
          id: c.depositionId,
          tenantId: c.tenantId,
          matterId: c.matterId,
          deponentName: c.deponentName,
          depositionType: c.depositionType,
          requestedStartsAt: new Date(c.requestedStartsAt),
          timezone: c.timezone,
          locationMode: c.locationMode,
          reporterRequired: c.reporterRequired,
          videoRequired: c.videoRequired,
          interpreterRequired: c.interpreterRequired,
          realtimeRequired: c.realtimeRequired,
          clientApprovalRequired: c.clientApprovalRequired,
          status: input.toStatus,
          provider: "noted",
          providerMode: "not_connected",
          externalBookingId: null,
          scheduledAt: null,
          revision: 1,
          createdBy: input.actor.userId,
          createdAt: now,
          updatedAt: now,
        }),
    );
  else {
    const current = await readDeposition(
      c.tenantId,
      c.matterId,
      c.depositionId,
    );
    if (!current || current.revision !== c.expectedRevision)
      throw new Error("Deposition changed; refresh before retrying");
    const patch: Record<string, unknown> = {
      status: input.toStatus,
      revision: current.revision + 1,
      updatedAt: now,
    };
    if (c.action === "record_human_scheduling") {
      Object.assign(patch, {
        providerMode: "human_verified_external",
        externalBookingId: c.externalBookingId,
        scheduledAt: new Date(c.scheduledAt),
      });
      writes.push(
        db
          .insert(calendarEvents)
          .values({
            id: `calendar-${c.depositionId}`,
            tenantId: c.tenantId,
            matterId: c.matterId,
            seriesId: null,
            parentEventId: null,
            eventKind: "deposition",
            title: `Deposition — ${current.deponentName}`,
            startsAt: new Date(c.scheduledAt),
            endsAt: new Date(
              new Date(c.scheduledAt).getTime() + 2 * 60 * 60 * 1000,
            ),
            allDay: false,
            timezone: current.timezone,
            location: `${current.locationMode} · human verified external`,
            ownerId: input.actor.userId,
            status: "scheduled",
            sourceType: "deposition_human_evidence",
            sourceId: c.depositionId,
            externalProviderId: c.externalBookingId,
            revision: 1,
            createdBy: input.actor.userId,
            createdAt: now,
            updatedAt: now,
          }),
      );
    }
    if (c.action === "attempt_noted_booking")
      writes.push(
        db
          .insert(integrationHandoffs)
          .values({
            id: createId(),
            tenantId: c.tenantId,
            matterId: c.matterId,
            runId: c.depositionId,
            provider: "noted",
            operation: "book_deposition",
            status: "blocked_not_connected",
            providerMode: "not_connected",
            retryable: true,
            activationRequirement:
              "Executed service agreement, approved data use, credentials, API contract, and reconciliation evidence.",
            createdAt: now,
          }),
      );
    if (c.action === "materialize_synthetic_transcript")
      writes.push(
        db
          .insert(depositionArtifacts)
          .values({
            id: c.artifactId,
            tenantId: c.tenantId,
            matterId: c.matterId,
            depositionId: c.depositionId,
            artifactType: "final_transcript",
            title: c.title,
            sha256: await digest(c.content),
            providerMode: "deterministic_sandbox",
            status: "verified",
            verifiedBy: input.actor.userId,
            createdAt: now,
          }),
      );
    writes.push(
      db
        .update(depositions)
        .set(patch)
        .where(
          and(
            eq(depositions.tenantId, c.tenantId),
            eq(depositions.id, c.depositionId),
            eq(depositions.revision, c.expectedRevision),
          ),
        ),
    );
  }
  await db.batch([
    ...(writes as never[]),
    decisionWrite,
    eventWrite,
    outboxWrite,
  ] as never);
  return { replayed: false, eventId: input.event.eventId };
}
function reason(c: DepositionCommand) {
  if ("reason" in c) return c.reason;
  if ("evidence" in c) return c.evidence;
  if ("completionEvidence" in c) return c.completionEvidence;
  if (c.action === "materialize_synthetic_transcript")
    return "Verified checksum for an explicitly synthetic transcript fixture.";
  return "Created a synthetic deposition request for governed lifecycle proof.";
}
async function digest(x: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x));
  return Array.from(new Uint8Array(d), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
