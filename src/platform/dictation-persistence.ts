import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  candidateTimeEntries,
  dictationArtifacts,
  dictationDecisions,
  dictationSessions,
  integrationHandoffs,
  previewEvents,
  previewOutbox,
  workProductDrafts,
} from "../../db/schema";
import type { DictationCommand, DictationStatus } from "@/domain/dictation/lifecycle";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export async function readDictation(t: string, m: string, id: string) {
  const [row] = await getPreviewDb().select().from(dictationSessions).where(and(eq(dictationSessions.tenantId, t), eq(dictationSessions.matterId, m), eq(dictationSessions.id, id))).limit(1);
  return row ?? null;
}

export async function readDictationEvent(t: string, key: string) {
  const [row] = await getPreviewDb().select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, t), eq(previewEvents.idempotencyKey, key))).limit(1);
  return row ?? null;
}

export async function dictationProjection(t: string, m: string) {
  const db = getPreviewDb();
  const [items, artifacts, decisions, times] = await Promise.all([
    db.select().from(dictationSessions).where(and(eq(dictationSessions.tenantId, t), eq(dictationSessions.matterId, m))),
    db.select().from(dictationArtifacts).where(and(eq(dictationArtifacts.tenantId, t), eq(dictationArtifacts.matterId, m))).orderBy(asc(dictationArtifacts.createdAt)),
    db.select().from(dictationDecisions).where(and(eq(dictationDecisions.tenantId, t), eq(dictationDecisions.matterId, m))).orderBy(asc(dictationDecisions.createdAt)),
    db.select({ id: candidateTimeEntries.id, runId: candidateTimeEntries.runId, minutes: candidateTimeEntries.minutes, narrative: candidateTimeEntries.narrative, status: candidateTimeEntries.status, confirmedBy: candidateTimeEntries.confirmedBy }).from(candidateTimeEntries).where(and(eq(candidateTimeEntries.tenantId, t), eq(candidateTimeEntries.matterId, m))),
  ]);
  return { items, artifacts, decisions, times };
}

export async function persistDictation(input: {
  command: DictationCommand;
  fromStatus: string;
  toStatus: DictationStatus;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
}) {
  const db = getPreviewDb();
  const c = input.command;
  const now = new Date(input.event.occurredAt);
  const eventWrite = db.insert(previewEvents).values({
    eventId: input.event.eventId, eventType: input.event.eventType, eventVersion: input.event.eventVersion,
    tenantId: c.tenantId, aggregateType: input.event.aggregateType, aggregateId: c.sessionId, matterId: c.matterId,
    actorId: input.actor.userId, occurredAt: now, correlationId: input.event.correlationId, causationId: input.event.causationId,
    idempotencyKey: input.event.idempotencyKey, source: input.event.source, visibility: input.event.visibility,
    retentionPolicy: input.event.retentionPolicy, payload: input.event.payload,
  });
  const outboxWrite = db.insert(previewOutbox).values({ id: createId(), tenantId: c.tenantId, eventId: input.event.eventId, topic: "athena.dictation", payload: input.event, attempts: 0, availableAt: now });
  const decisionWrite = db.insert(dictationDecisions).values({
    id: createId(), tenantId: c.tenantId, matterId: c.matterId, sessionId: c.sessionId, action: c.action,
    fromStatus: input.fromStatus, toStatus: input.toStatus, reason: decisionReason(c), actorId: input.actor.userId,
    eventId: input.event.eventId, idempotencyKey: c.idempotencyKey, createdAt: now,
  });
  const writes: unknown[] = [];
  if (c.action === "capture_session") {
    writes.push(
      db.insert(dictationSessions).values({
        id: c.sessionId, tenantId: c.tenantId, matterId: c.matterId, title: c.title, workProductType: c.workProductType,
        durationSeconds: c.durationSeconds, audioSha256: c.audioSha256, consentEvidence: c.consentEvidence,
        templateId: null, templateVersion: null, status: "captured", provider: "verbatim", providerMode: "deterministic_sandbox",
        workProductId: null, candidateTimeId: null, revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now,
      }),
      db.insert(dictationArtifacts).values({
        id: c.audioArtifactId, tenantId: c.tenantId, matterId: c.matterId, sessionId: c.sessionId,
        artifactType: "audio_metadata", title: `${c.title} — synthetic audio metadata`, content: null, sha256: c.audioSha256,
        sourceArtifactId: null, providerMode: "deterministic_sandbox", status: "preserved", approvedBy: null, approvedAt: null, createdAt: now,
      }),
    );
  } else {
    const current = await readDictation(c.tenantId, c.matterId, c.sessionId);
    if (!current || current.revision !== c.expectedRevision) throw new Error("Dictation session changed; refresh before retrying");
    const patch: Record<string, unknown> = { status: input.toStatus, revision: current.revision + 1, updatedAt: now };
    if (c.action === "attempt_transcription") {
      Object.assign(patch, { providerMode: "not_connected" });
      writes.push(db.insert(integrationHandoffs).values({
        id: createId(), tenantId: c.tenantId, matterId: c.matterId, runId: c.sessionId, provider: "verbatim",
        operation: "transcribe_dictation", status: "blocked_not_connected", providerMode: "not_connected", retryable: true,
        activationRequirement: "Approved service agreement, audio consent/retention policy, credentials, vocabulary/template controls, delivery contract, and reconciliation evidence are required.", createdAt: now,
      }));
    }
    if (c.action === "materialize_synthetic_transcript") {
      writes.push(db.insert(dictationArtifacts).values({
        id: c.transcriptArtifactId, tenantId: c.tenantId, matterId: c.matterId, sessionId: c.sessionId,
        artifactType: "synthetic_transcript", title: `${current.title} — synthetic transcript`, content: c.content,
        sha256: await digest(c.content), sourceArtifactId: null, providerMode: "deterministic_sandbox", status: "ready",
        approvedBy: null, approvedAt: null, createdAt: now,
      }));
    }
    if (c.action === "apply_template") {
      Object.assign(patch, { templateId: c.templateId, templateVersion: c.templateVersion });
      writes.push(db.insert(dictationArtifacts).values({
        id: c.draftArtifactId, tenantId: c.tenantId, matterId: c.matterId, sessionId: c.sessionId,
        artifactType: "templated_draft", title: current.title, content: c.body, sha256: await digest(c.body),
        sourceArtifactId: c.transcriptArtifactId, providerMode: "deterministic_sandbox", status: "ready",
        approvedBy: null, approvedAt: null, createdAt: now,
      }));
    }
    if (c.action === "approve_work_product") {
      writes.push(db.update(dictationArtifacts).set({ status: "approved", approvedBy: input.actor.userId, approvedAt: now }).where(and(eq(dictationArtifacts.tenantId, c.tenantId), eq(dictationArtifacts.sessionId, c.sessionId), eq(dictationArtifacts.artifactType, "templated_draft"))));
    }
    if (c.action === "confirm_time") {
      Object.assign(patch, { candidateTimeId: c.candidateTimeId });
      writes.push(db.insert(candidateTimeEntries).values({
        id: c.candidateTimeId, tenantId: c.tenantId, matterId: c.matterId, runId: c.sessionId,
        minutes: c.minutes, narrative: c.narrative, taskCode: c.taskCode, activityCode: c.activityCode,
        status: "confirmed", confirmedBy: input.actor.userId, confirmedAt: now,
      }));
    }
    if (c.action === "file_to_matter") {
      const [draft] = await db.select().from(dictationArtifacts).where(and(eq(dictationArtifacts.tenantId, c.tenantId), eq(dictationArtifacts.sessionId, c.sessionId), eq(dictationArtifacts.artifactType, "templated_draft"), eq(dictationArtifacts.status, "approved"))).limit(1);
      if (!draft?.content) throw new Error("Approved templated draft is required before filing");
      Object.assign(patch, { workProductId: c.workProductId });
      writes.push(db.insert(workProductDrafts).values({
        id: c.workProductId, tenantId: c.tenantId, matterId: c.matterId, runId: c.sessionId,
        workProductType: current.workProductType, title: current.title, body: draft.content,
        sourceDocumentId: draft.sourceArtifactId ?? draft.id, sourceFactIds: [], status: "approved",
        providerMode: "deterministic_sandbox", approvedBy: input.actor.userId, approvedAt: now, createdAt: now,
      }));
    }
    writes.push(db.update(dictationSessions).set(patch).where(and(eq(dictationSessions.tenantId, c.tenantId), eq(dictationSessions.id, c.sessionId), eq(dictationSessions.revision, c.expectedRevision))));
  }
  await db.batch([...(writes as never[]), decisionWrite, eventWrite, outboxWrite] as never);
  return { replayed: false, eventId: input.event.eventId };
}

function decisionReason(c: DictationCommand) {
  if ("reason" in c) return c.reason;
  if (c.action === "capture_session") return c.consentEvidence;
  if (c.action === "materialize_synthetic_transcript") return "Explicitly synthetic transcript materialized with immutable checksum evidence.";
  return `Applied template ${c.templateId} version ${c.templateVersion} to the source-linked synthetic transcript.`;
}
async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
