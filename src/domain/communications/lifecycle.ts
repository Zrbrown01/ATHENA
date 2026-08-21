import { z } from "zod";
import { createEvent } from "@/platform/events";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";

const id = z.string().min(3).max(160);
const base = {
  tenantId: z.string().min(1),
  matterId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(200),
};
const reason = z.string().trim().min(12).max(1500);

export const communicationCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("materialize_fixture_inbound"), ...base,
    mailboxConnectionId: id, threadId: id, messageId: id, attachmentId: id, candidateId: id,
    mailboxAddress: z.email(), fromAddress: z.email(), toAddresses: z.array(z.email()).min(1).max(20),
    subject: z.string().trim().min(5).max(300), bodyText: z.string().trim().min(20).max(20_000),
    receivedAt: z.iso.datetime(), attachmentFileName: z.string().trim().min(3).max(240),
    attachmentMimeType: z.string().min(3).max(100), attachmentByteSize: z.number().int().positive().max(25_000_000),
    attachmentSha256: z.string().regex(/^[a-f0-9]{64}$/), sandboxAcknowledged: z.literal(true),
  }),
  z.object({
    action: z.literal("resolve_association"), ...base, candidateId: id,
    expectedRevision: z.number().int().positive(),
    decision: z.enum(["file_to_matter", "file_to_another", "do_not_file", "exclude_thread"]),
    targetMatterId: id.optional(), reason,
  }).superRefine((value, context) => {
    if (value.decision === "file_to_another" && !value.targetMatterId) context.addIssue({ code: "custom", path: ["targetMatterId"], message: "Another matter identity is required" });
    if (value.decision === "file_to_matter" && value.targetMatterId && value.targetMatterId !== value.matterId) context.addIssue({ code: "custom", path: ["targetMatterId"], message: "Use file_to_another for a different matter" });
  }),
  z.object({ action: z.literal("undo_association"), ...base, candidateId: id, expectedRevision: z.number().int().positive(), reason }),
  z.object({
    action: z.literal("create_outbound_draft"), ...base, threadId: id, messageId: id,
    toAddresses: z.array(z.email()).min(1).max(20), ccAddresses: z.array(z.email()).max(20).default([]),
    subject: z.string().trim().min(5).max(300), bodyText: z.string().trim().min(20).max(20_000),
  }),
  z.object({ action: z.literal("approve_outbound_draft"), ...base, threadId: id, messageId: id, expectedRevision: z.number().int().positive(), reason }),
  z.object({ action: z.literal("record_delivery_block"), ...base, threadId: id, messageId: id, expectedRevision: z.number().int().positive(), reason }),
]);

export type CommunicationCommand = z.infer<typeof communicationCommand>;
export type CommunicationThreadState = { id: string; matterId?: string | null; associationStatus: "unreviewed" | "suggested" | "filed" | "excluded"; revision: number };
export type AssociationCandidateState = { id: string; threadId: string; messageId: string; suggestedMatterId: string; targetMatterId?: string | null; status: "pending" | "filed" | "do_not_file" | "excluded" | "undone"; revision: number };
export type CommunicationMessageState = { id: string; threadId: string; matterId?: string | null; direction: "inbound" | "outbound"; status: "preserved" | "draft" | "approved" | "blocked_not_connected" | "sent" | "failed"; revision: number };

export function decideCommunication(input: {
  context: TenantContext;
  raw: unknown;
  thread?: CommunicationThreadState | null;
  candidate?: AssociationCandidateState | null;
  message?: CommunicationMessageState | null;
  targetExists?: boolean;
}) {
  const command = communicationCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId);
  if (command.action === "resolve_association" && command.decision === "file_to_another" && command.targetMatterId) authorizeMatter(input.context, command.tenantId, command.targetMatterId);
  requireRole(input.context, ["attorney", "partner", "paralegal", "legal_assistant"]);
  let aggregateType = "communication_thread";
  let aggregateId = "threadId" in command ? command.threadId : command.candidateId;
  let fromStatus = "not_created";
  let toStatus = "recorded";

  if (command.action === "materialize_fixture_inbound") {
    if (input.targetExists) throw new Error("Communication thread identity already exists");
    toStatus = "suggested";
  } else if (command.action === "resolve_association") {
    aggregateType = "matter_association_candidate";
    aggregateId = command.candidateId;
    const current = input.candidate;
    if (!current || current.revision !== command.expectedRevision) throw new Error("Association candidate changed; refresh before retrying");
    if (!(["pending", "undone"] as const).includes(current.status as "pending" | "undone")) throw new Error("Only a pending or undone association can be resolved");
    fromStatus = current.status;
    toStatus = command.decision === "file_to_matter" || command.decision === "file_to_another" ? "filed" : command.decision === "exclude_thread" ? "excluded" : "do_not_file";
  } else if (command.action === "undo_association") {
    aggregateType = "matter_association_candidate";
    aggregateId = command.candidateId;
    const current = input.candidate;
    if (!current || current.revision !== command.expectedRevision) throw new Error("Association candidate changed; refresh before retrying");
    if (!(["filed", "do_not_file", "excluded"] as const).includes(current.status as "filed" | "do_not_file" | "excluded")) throw new Error("Only a resolved association can be undone");
    fromStatus = current.status;
    toStatus = "undone";
  } else if (command.action === "create_outbound_draft") {
    if (!input.thread || input.thread.associationStatus !== "filed" || input.thread.matterId !== command.matterId) throw new Error("Outbound drafts require a thread filed to this matter");
    if (input.targetExists) throw new Error("Communication message identity already exists");
    aggregateType = "communication_message";
    aggregateId = command.messageId;
    toStatus = "draft";
  } else {
    aggregateType = "communication_message";
    aggregateId = command.messageId;
    const message = input.message;
    if (!message || message.threadId !== command.threadId || message.matterId !== command.matterId) throw new Error("Outbound message does not exist in this matter thread");
    if (message.revision !== command.expectedRevision) throw new Error("Outbound message changed; refresh before retrying");
    if (message.direction !== "outbound") throw new Error("Only outbound messages use the delivery lifecycle");
    fromStatus = message.status;
    if (command.action === "approve_outbound_draft") {
      requireRole(input.context, ["attorney", "partner"]);
      if (message.status !== "draft") throw new Error("Only a draft outbound message can be approved");
      toStatus = "approved";
    } else {
      if (message.status !== "approved") throw new Error("Only an approved outbound message can enter delivery handoff");
      toStatus = "blocked_not_connected";
    }
  }

  const event = createEvent({
    eventType: `communication.${({ materialize_fixture_inbound: "fixture_inbound_preserved", resolve_association: "association_resolved", undo_association: "association_undone", create_outbound_draft: "draft_created", approve_outbound_draft: "draft_approved", record_delivery_block: "delivery_blocked" } as const)[command.action]}`,
    tenantId: command.tenantId, aggregateType, aggregateId, matterId: command.matterId,
    actorId: input.context.userId, correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey,
    source: "athena.web", visibility: "restricted", retentionPolicy: "matter-lifecycle-plus-firm-retention",
    payload: { action: command.action, fromStatus, toStatus, humanAuthorized: command.action !== "materialize_fixture_inbound", microsoftConnected: false, providerDeliveryAttempted: false, bodyContentIncluded: false },
  });
  return { command, aggregateType, aggregateId, fromStatus, toStatus, event };
}
