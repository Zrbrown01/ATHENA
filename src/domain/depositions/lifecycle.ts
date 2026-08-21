import { z } from "zod";
import { createEvent } from "@/platform/events";
import {
  AuthorizationError,
  authorizeMatter,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";

const id = z.string().min(3).max(160),
  detail = z.string().trim().min(12).max(1500),
  revision = z.number().int().positive();
const base = {
  tenantId: z.string().min(1),
  matterId: id,
  depositionId: id,
  idempotencyKey: z.string().min(8).max(200),
};
export const depositionCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request_deposition"),
    ...base,
    deponentName: z.string().trim().min(3).max(200),
    depositionType: z.enum([
      "applicant",
      "witness",
      "expert",
      "person_most_knowledgeable",
    ]),
    requestedStartsAt: z.string().datetime(),
    timezone: z.string().min(3),
    locationMode: z.enum(["remote", "in_person", "hybrid"]),
    reporterRequired: z.boolean(),
    videoRequired: z.boolean(),
    interpreterRequired: z.boolean(),
    realtimeRequired: z.boolean(),
    clientApprovalRequired: z.boolean(),
    syntheticDataAcknowledged: z.literal(true),
  }),
  z.object({
    action: z.literal("approve_deposition"),
    ...base,
    expectedRevision: revision,
    reason: detail,
  }),
  z.object({
    action: z.literal("attempt_noted_booking"),
    ...base,
    expectedRevision: revision,
    reason: detail,
  }),
  z.object({
    action: z.literal("record_human_scheduling"),
    ...base,
    expectedRevision: revision,
    externalBookingId: id,
    scheduledAt: z.string().datetime(),
    evidence: detail,
  }),
  z.object({
    action: z.literal("complete_deposition"),
    ...base,
    expectedRevision: revision,
    completionEvidence: detail,
  }),
  z.object({
    action: z.literal("materialize_synthetic_transcript"),
    ...base,
    expectedRevision: revision,
    artifactId: id,
    title: z.string().min(5).max(250),
    content: detail,
    syntheticDataAcknowledged: z.literal(true),
  }),
  z.object({
    action: z.literal("close_deposition"),
    ...base,
    expectedRevision: revision,
    reason: detail,
  }),
]);
export type DepositionCommand = z.infer<typeof depositionCommand>;
export type DepositionState = {
  id: string;
  status:
    | "requested"
    | "pending_approval"
    | "ready_for_handoff"
    | "handoff_blocked"
    | "scheduled"
    | "completed"
    | "transcript_received"
    | "closed";
  revision: number;
  clientApprovalRequired: boolean;
};
export function decideDeposition(input: {
  context: TenantContext;
  raw: unknown;
  current?: DepositionState | null;
}) {
  const c = depositionCommand.parse(input.raw);
  if (c.tenantId !== input.context.tenantId) throw new AuthorizationError();
  authorizeMatter(input.context, c.tenantId, c.matterId);
  let fromStatus = "not_created",
    toStatus: "requested" | DepositionState["status"] = "requested";
  if (c.action === "request_deposition") {
    if (input.current) throw new Error("Deposition identity already exists");
    toStatus = c.clientApprovalRequired
      ? "pending_approval"
      : "ready_for_handoff";
  } else {
    const current = input.current;
    if (!current || current.revision !== c.expectedRevision)
      throw new Error("Deposition changed; refresh before retrying");
    fromStatus = current.status;
    if (c.action === "approve_deposition") {
      requireRole(input.context, ["attorney", "partner"]);
      if (current.status !== "pending_approval")
        throw new Error(
          `approve_deposition is not allowed from ${current.status}`,
        );
      toStatus = "ready_for_handoff";
    } else if (c.action === "attempt_noted_booking") {
      if (current.status !== "ready_for_handoff")
        throw new Error(
          `attempt_noted_booking is not allowed from ${current.status}`,
        );
      toStatus = "handoff_blocked";
    } else if (c.action === "record_human_scheduling") {
      requireRole(input.context, ["attorney", "partner"]);
      if (!["ready_for_handoff", "handoff_blocked"].includes(current.status))
        throw new Error(
          `record_human_scheduling is not allowed from ${current.status}`,
        );
      toStatus = "scheduled";
    } else if (c.action === "complete_deposition") {
      if (current.status !== "scheduled")
        throw new Error(
          `complete_deposition is not allowed from ${current.status}`,
        );
      toStatus = "completed";
    } else if (c.action === "materialize_synthetic_transcript") {
      if (current.status !== "completed")
        throw new Error(
          `materialize_synthetic_transcript is not allowed from ${current.status}`,
        );
      toStatus = "transcript_received";
    } else {
      if (current.status !== "transcript_received")
        throw new Error(
          `close_deposition is not allowed from ${current.status}`,
        );
      toStatus = "closed";
    }
  }
  return {
    command: c,
    fromStatus,
    toStatus,
    event: createEvent({
      eventType: `deposition.${c.action}`,
      tenantId: c.tenantId,
      aggregateType: "deposition",
      aggregateId: c.depositionId,
      matterId: c.matterId,
      actorId: input.context.userId,
      correlationId: c.idempotencyKey,
      idempotencyKey: c.idempotencyKey,
      source: "athena.web",
      visibility: "restricted",
      retentionPolicy: "matter-lifecycle",
      payload: {
        action: c.action,
        fromStatus,
        toStatus,
        humanAuthorized:
          c.action !== "request_deposition" &&
          c.action !== "attempt_noted_booking",
        notedConnected: false,
        providerBookingAttempted: false,
        syntheticTranscript: c.action === "materialize_synthetic_transcript",
      },
    }),
  };
}
