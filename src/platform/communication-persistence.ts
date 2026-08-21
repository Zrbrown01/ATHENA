import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  communicationAttachments, communicationDecisions, communicationMessages, communicationThreads,
  mailboxConnections, matterAssociationCandidates, previewEvents, previewOutbox,
} from "../../db/schema";
import type { CommunicationCommand } from "@/domain/communications/lifecycle";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export async function readCommunicationThread(tenantId: string, threadId: string) {
  const [row] = await getPreviewDb().select().from(communicationThreads).where(and(eq(communicationThreads.tenantId, tenantId), eq(communicationThreads.id, threadId))).limit(1);
  return row ?? null;
}

export async function readAssociationCandidate(tenantId: string, candidateId: string) {
  const [row] = await getPreviewDb().select().from(matterAssociationCandidates).where(and(eq(matterAssociationCandidates.tenantId, tenantId), eq(matterAssociationCandidates.id, candidateId))).limit(1);
  return row ?? null;
}

export async function readCommunicationMessage(tenantId: string, messageId: string) {
  const [row] = await getPreviewDb().select().from(communicationMessages).where(and(eq(communicationMessages.tenantId, tenantId), eq(communicationMessages.id, messageId))).limit(1);
  return row ?? null;
}

export async function readCommunicationEvent(tenantId: string, idempotencyKey: string) {
  const [row] = await getPreviewDb().select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, tenantId), eq(previewEvents.idempotencyKey, idempotencyKey))).limit(1);
  return row ?? null;
}

export async function communicationProjection(tenantId: string, matterId: string) {
  const db = getPreviewDb();
  const [mailboxes, threads, messages, attachments, candidates, decisions] = await Promise.all([
    db.select().from(mailboxConnections).where(eq(mailboxConnections.tenantId, tenantId)).orderBy(asc(mailboxConnections.createdAt)),
    db.select().from(communicationThreads).where(eq(communicationThreads.tenantId, tenantId)).orderBy(asc(communicationThreads.createdAt)),
    db.select().from(communicationMessages).where(eq(communicationMessages.tenantId, tenantId)).orderBy(asc(communicationMessages.receivedOrDraftedAt)),
    db.select().from(communicationAttachments).where(eq(communicationAttachments.tenantId, tenantId)).orderBy(asc(communicationAttachments.createdAt)),
    db.select().from(matterAssociationCandidates).where(and(eq(matterAssociationCandidates.tenantId, tenantId), eq(matterAssociationCandidates.suggestedMatterId, matterId))).orderBy(asc(matterAssociationCandidates.createdAt)),
    db.select().from(communicationDecisions).where(and(eq(communicationDecisions.tenantId, tenantId), eq(communicationDecisions.matterId, matterId))).orderBy(asc(communicationDecisions.createdAt)),
  ]);
  const relevantThreadIds = new Set([
    ...threads.filter((thread) => thread.matterId === matterId).map((thread) => thread.id),
    ...candidates.map((candidate) => candidate.threadId),
  ]);
  const scopedThreads = threads.filter((thread) => relevantThreadIds.has(thread.id));
  const relevantMailboxIds = new Set(scopedThreads.map((thread) => thread.mailboxConnectionId));
  return {
    mailboxes: mailboxes.filter((mailbox) => relevantMailboxIds.has(mailbox.id)),
    threads: scopedThreads,
    messages: messages.filter((message) => relevantThreadIds.has(message.threadId)),
    attachments: attachments.filter((attachment) => relevantThreadIds.has(attachment.threadId)),
    candidates,
    decisions,
  };
}

export async function persistCommunication(input: {
  command: CommunicationCommand;
  aggregateType: string;
  aggregateId: string;
  fromStatus: string;
  toStatus: string;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
}) {
  const db = getPreviewDb();
  const c = input.command;
  const now = new Date(input.event.occurredAt);
  const eventWrite = db.insert(previewEvents).values(eventValues(input.event, input.actor));
  const outboxWrite = db.insert(previewOutbox).values({ id: createId(), tenantId: c.tenantId, eventId: input.event.eventId, topic: "athena.communications", payload: input.event, attempts: 0, availableAt: now });
  const decisionWrite = db.insert(communicationDecisions).values({
    id: createId(), tenantId: c.tenantId, matterId: c.matterId, aggregateType: input.aggregateType, aggregateId: input.aggregateId,
    action: c.action, fromStatus: input.fromStatus, toStatus: input.toStatus, reason: commandReason(c), actorId: input.actor.userId,
    eventId: input.event.eventId, idempotencyKey: c.idempotencyKey, createdAt: now,
  });

  if (c.action === "materialize_fixture_inbound") {
    const receivedAt = new Date(c.receivedAt);
    await db.batch([
      db.insert(mailboxConnections).values({
        id: c.mailboxConnectionId, tenantId: c.tenantId, provider: "microsoft_365", mailboxAddress: c.mailboxAddress,
        status: "not_connected", providerMode: "not_connected", grantedScopes: [], deltaCursor: null, lastSuccessfulSyncAt: null,
        healthDetail: "Microsoft app registration, least-privileged consent, mailbox authorization, notifications, delta sync, revocation, and reconciliation are not connected.",
        createdBy: input.actor.userId, createdAt: now, updatedAt: now,
      }).onConflictDoUpdate({ target: [mailboxConnections.tenantId, mailboxConnections.mailboxAddress], set: { status: "not_connected", providerMode: "not_connected", grantedScopes: [], deltaCursor: null, lastSuccessfulSyncAt: null, updatedAt: now } }),
      db.insert(communicationThreads).values({
        id: c.threadId, tenantId: c.tenantId, mailboxConnectionId: c.mailboxConnectionId, providerThreadId: null,
        subject: c.subject, participants: [c.fromAddress, ...c.toAddresses], matterId: null, associationStatus: "suggested",
        autoFilingExcluded: false, messageCount: 1, lastMessageAt: receivedAt, revision: 1, createdAt: now, updatedAt: now,
      }),
      db.insert(communicationMessages).values({
        id: c.messageId, tenantId: c.tenantId, threadId: c.threadId, matterId: null, providerMessageId: null,
        internetMessageId: `<${c.messageId}@synthetic.athena.invalid>`, direction: "inbound", fromAddress: c.fromAddress,
        toAddresses: c.toAddresses, ccAddresses: [], subject: c.subject, bodyText: c.bodyText, bodySha256: await sha256(c.bodyText),
        receivedOrDraftedAt: receivedAt, status: "preserved", providerMode: "deterministic_sandbox", deliveryAttempted: false,
        revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now,
      }),
      db.insert(communicationAttachments).values({
        id: c.attachmentId, tenantId: c.tenantId, threadId: c.threadId, messageId: c.messageId, matterId: null,
        fileName: c.attachmentFileName, mimeType: c.attachmentMimeType, byteSize: c.attachmentByteSize, sha256: c.attachmentSha256,
        providerAttachmentId: null, sourceObjectKey: null, extractionStatus: "blocked_not_connected", documentEvidenceId: null, createdAt: now,
      }),
      db.insert(matterAssociationCandidates).values({
        id: c.candidateId, tenantId: c.tenantId, threadId: c.threadId, messageId: c.messageId, suggestedMatterId: c.matterId,
        targetMatterId: null, signals: ["claim:SCS-CA-884103", "adj:ADJ18420931", "applicant:Elena Rivera", "employer:Northstar Logistics"],
        confidenceBasis: "Exact synthetic claim and ADJ identifiers with consistent parties; human review remains required in this pilot.",
        status: "pending", revision: 1, createdAt: now, updatedAt: now,
      }),
      decisionWrite, eventWrite, outboxWrite,
    ]);
  } else if (c.action === "resolve_association") {
    const candidate = await readAssociationCandidate(c.tenantId, c.candidateId);
    if (!candidate) throw new Error("Association candidate does not exist");
    const filed = c.decision === "file_to_matter" || c.decision === "file_to_another";
    const targetMatterId = filed ? (c.decision === "file_to_another" ? c.targetMatterId! : c.matterId) : null;
    const candidateStatus = filed ? "filed" : c.decision === "exclude_thread" ? "excluded" : "do_not_file";
    const threadStatus = filed ? "filed" : c.decision === "exclude_thread" ? "excluded" : "unreviewed";
    await db.batch([
      db.update(matterAssociationCandidates).set({ targetMatterId, status: candidateStatus, resolutionReason: c.reason, resolvedBy: input.actor.userId, resolvedAt: now, revision: candidate.revision + 1, updatedAt: now }).where(and(eq(matterAssociationCandidates.tenantId, c.tenantId), eq(matterAssociationCandidates.id, c.candidateId), eq(matterAssociationCandidates.revision, c.expectedRevision))),
      db.update(communicationThreads).set({ matterId: targetMatterId, associationStatus: threadStatus, autoFilingExcluded: c.decision === "exclude_thread", revision: candidate.revision + 1, updatedAt: now }).where(and(eq(communicationThreads.tenantId, c.tenantId), eq(communicationThreads.id, candidate.threadId))),
      db.update(communicationMessages).set({ matterId: targetMatterId, updatedAt: now }).where(and(eq(communicationMessages.tenantId, c.tenantId), eq(communicationMessages.threadId, candidate.threadId))),
      db.update(communicationAttachments).set({ matterId: targetMatterId }).where(and(eq(communicationAttachments.tenantId, c.tenantId), eq(communicationAttachments.threadId, candidate.threadId))),
      decisionWrite, eventWrite, outboxWrite,
    ]);
  } else if (c.action === "undo_association") {
    const candidate = await readAssociationCandidate(c.tenantId, c.candidateId);
    if (!candidate) throw new Error("Association candidate does not exist");
    await db.batch([
      db.update(matterAssociationCandidates).set({ targetMatterId: null, status: "undone", resolutionReason: c.reason, resolvedBy: input.actor.userId, resolvedAt: now, revision: candidate.revision + 1, updatedAt: now }).where(and(eq(matterAssociationCandidates.tenantId, c.tenantId), eq(matterAssociationCandidates.id, c.candidateId), eq(matterAssociationCandidates.revision, c.expectedRevision))),
      db.update(communicationThreads).set({ matterId: null, associationStatus: "suggested", autoFilingExcluded: false, revision: candidate.revision + 1, updatedAt: now }).where(and(eq(communicationThreads.tenantId, c.tenantId), eq(communicationThreads.id, candidate.threadId))),
      db.update(communicationMessages).set({ matterId: null, updatedAt: now }).where(and(eq(communicationMessages.tenantId, c.tenantId), eq(communicationMessages.threadId, candidate.threadId))),
      db.update(communicationAttachments).set({ matterId: null }).where(and(eq(communicationAttachments.tenantId, c.tenantId), eq(communicationAttachments.threadId, candidate.threadId))),
      decisionWrite, eventWrite, outboxWrite,
    ]);
  } else if (c.action === "create_outbound_draft") {
    const thread = await readCommunicationThread(c.tenantId, c.threadId);
    if (!thread) throw new Error("Communication thread does not exist");
    await db.batch([
      db.insert(communicationMessages).values({
        id: c.messageId, tenantId: c.tenantId, threadId: c.threadId, matterId: c.matterId, providerMessageId: null, internetMessageId: null,
        direction: "outbound", fromAddress: input.actor.email, toAddresses: c.toAddresses, ccAddresses: c.ccAddresses,
        subject: c.subject, bodyText: c.bodyText, bodySha256: await sha256(c.bodyText), receivedOrDraftedAt: now,
        status: "draft", providerMode: "human_authored", deliveryAttempted: false, revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now,
      }),
      db.update(communicationThreads).set({ messageCount: thread.messageCount + 1, lastMessageAt: now, revision: thread.revision + 1, updatedAt: now }).where(and(eq(communicationThreads.tenantId, c.tenantId), eq(communicationThreads.id, c.threadId))),
      decisionWrite, eventWrite, outboxWrite,
    ]);
  } else {
    const message = await readCommunicationMessage(c.tenantId, c.messageId);
    if (!message) throw new Error("Communication message does not exist");
    const approved = c.action === "approve_outbound_draft";
    await db.batch([
      db.update(communicationMessages).set({
        status: approved ? "approved" : "blocked_not_connected", providerMode: approved ? "human_authored" : "not_connected",
        deliveryAttempted: false, approvedBy: approved ? input.actor.userId : message.approvedBy, approvedAt: approved ? now : message.approvedAt,
        revision: message.revision + 1, updatedAt: now,
      }).where(and(eq(communicationMessages.tenantId, c.tenantId), eq(communicationMessages.id, c.messageId), eq(communicationMessages.revision, c.expectedRevision))),
      decisionWrite, eventWrite, outboxWrite,
    ]);
  }
  return { replayed: false, eventId: input.event.eventId };
}

function commandReason(command: CommunicationCommand) {
  return "reason" in command ? command.reason : command.action === "materialize_fixture_inbound" ? "Acknowledged deterministic synthetic inbound communication fixture." : command.action === "create_outbound_draft" ? "Human-authored draft preserved locally; no external provider operation." : null;
}

function eventValues(event: EventEnvelope<Record<string, unknown>>, actor: RequestActor) {
  return { eventId: event.eventId, eventType: event.eventType, eventVersion: event.eventVersion, tenantId: event.tenantId, aggregateType: event.aggregateType, aggregateId: event.aggregateId, matterId: event.matterId, actorId: actor.userId, occurredAt: new Date(event.occurredAt), correlationId: event.correlationId, causationId: event.causationId, idempotencyKey: event.idempotencyKey, source: event.source, visibility: event.visibility, retentionPolicy: event.retentionPolicy, payload: event.payload };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hash = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
