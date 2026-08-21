import { z } from "zod";
import { createEvent } from "@/platform/events";
import {
  AuthorizationError,
  authorizeMatter,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";

const id = z.string().min(3).max(160);
const detail = z.string().trim().min(12).max(4000);
const revision = z.number().int().positive();
const base = {
  tenantId: z.string().min(1),
  matterId: id,
  sessionId: id,
  idempotencyKey: z.string().min(8).max(200),
};

export const dictationCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("capture_session"),
    ...base,
    title: z.string().trim().min(5).max(250),
    workProductType: z.enum(["client_report", "case_note", "letter", "hearing_report"]),
    durationSeconds: z.number().int().min(10).max(14400),
    audioArtifactId: id,
    audioSha256: z.string().regex(/^[a-f0-9]{64}$/),
    consentEvidence: detail,
    syntheticDataAcknowledged: z.literal(true),
  }),
  z.object({ action: z.literal("attempt_transcription"), ...base, expectedRevision: revision, reason: detail }),
  z.object({
    action: z.literal("materialize_synthetic_transcript"),
    ...base,
    expectedRevision: revision,
    transcriptArtifactId: id,
    content: detail,
    syntheticDataAcknowledged: z.literal(true),
  }),
  z.object({
    action: z.literal("apply_template"),
    ...base,
    expectedRevision: revision,
    draftArtifactId: id,
    transcriptArtifactId: id,
    templateId: id,
    templateVersion: z.string().min(1).max(40),
    body: detail,
  }),
  z.object({ action: z.literal("submit_review"), ...base, expectedRevision: revision, reason: detail }),
  z.object({ action: z.literal("approve_work_product"), ...base, expectedRevision: revision, reason: detail }),
  z.object({
    action: z.literal("confirm_time"),
    ...base,
    expectedRevision: revision,
    candidateTimeId: id,
    minutes: z.number().int().min(1).max(1440),
    narrative: z.string().trim().min(12).max(500),
    taskCode: z.string().min(2).max(30),
    activityCode: z.string().min(2).max(30),
    reason: detail,
  }),
  z.object({
    action: z.literal("file_to_matter"),
    ...base,
    expectedRevision: revision,
    workProductId: id,
    reason: detail,
  }),
]);

export type DictationCommand = z.infer<typeof dictationCommand>;
export type DictationStatus =
  | "captured"
  | "provider_blocked"
  | "transcript_ready"
  | "templated"
  | "in_review"
  | "approved"
  | "time_confirmed"
  | "filed";
export type DictationState = { id: string; status: DictationStatus; revision: number };

const transitions: Record<Exclude<DictationCommand["action"], "capture_session">, { from: DictationStatus; to: DictationStatus }> = {
  attempt_transcription: { from: "captured", to: "provider_blocked" },
  materialize_synthetic_transcript: { from: "provider_blocked", to: "transcript_ready" },
  apply_template: { from: "transcript_ready", to: "templated" },
  submit_review: { from: "templated", to: "in_review" },
  approve_work_product: { from: "in_review", to: "approved" },
  confirm_time: { from: "approved", to: "time_confirmed" },
  file_to_matter: { from: "time_confirmed", to: "filed" },
};

export function decideDictation(input: { context: TenantContext; raw: unknown; current?: DictationState | null }) {
  const command = dictationCommand.parse(input.raw);
  if (command.tenantId !== input.context.tenantId) throw new AuthorizationError();
  authorizeMatter(input.context, command.tenantId, command.matterId);
  let fromStatus = "not_created";
  let toStatus: DictationStatus = "captured";
  if (command.action === "capture_session") {
    if (input.current) throw new Error("Dictation session identity already exists");
  } else {
    if (!input.current || input.current.revision !== command.expectedRevision)
      throw new Error("Dictation session changed; refresh before retrying");
    const transition = transitions[command.action];
    if (input.current.status !== transition.from)
      throw new Error(`${command.action} is not allowed from ${input.current.status}`);
    fromStatus = input.current.status;
    toStatus = transition.to;
  }
  if (["approve_work_product", "confirm_time", "file_to_matter"].includes(command.action))
    requireRole(input.context, ["attorney", "partner"]);
  return {
    command,
    fromStatus,
    toStatus,
    event: createEvent({
      eventType: `dictation.${command.action}`,
      tenantId: command.tenantId,
      aggregateType: "dictation_session",
      aggregateId: command.sessionId,
      matterId: command.matterId,
      actorId: input.context.userId,
      correlationId: command.sessionId,
      causationId: command.idempotencyKey,
      idempotencyKey: command.idempotencyKey,
      source: "athena.web",
      visibility: "restricted",
      retentionPolicy: "matter-lifecycle-plus-firm-retention",
      payload: {
        action: command.action,
        fromStatus,
        toStatus,
        provider: "verbatim",
        providerConnected: false,
        providerCallAttempted: false,
        syntheticArtifact: ["capture_session", "materialize_synthetic_transcript"].includes(command.action),
        humanAuthorized: ["approve_work_product", "confirm_time", "file_to_matter"].includes(command.action),
      },
    }),
  };
}
