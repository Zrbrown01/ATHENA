import { z } from "zod";
import { createEvent } from "@/platform/events";
import { AuthorizationError, authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";
const id = z.string().min(3).max(160), detail = z.string().trim().min(12).max(1500), revision = z.number().int().positive();
const base = { tenantId: z.string().min(1), matterId: id, contactId: id, idempotencyKey: z.string().min(8).max(200) };
export const telephonyCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("configure_contact"), ...base, contactName: z.string().min(3).max(200), contactNumber: z.string().regex(/^\+[1-9]\d{7,14}$/), tenantNumber: z.string().regex(/^\+[1-9]\d{7,14}$/), sandboxAcknowledged: z.literal(true) }),
  z.object({ action: z.literal("record_consents"), ...base, expectedRevision: revision, evidence: detail, smsOptIn: z.literal(true), voiceConsent: z.literal(true), recordingAllowed: z.literal(false) }),
  z.object({ action: z.literal("draft_sms"), ...base, expectedRevision: revision, interactionId: id, body: detail }),
  z.object({ action: z.literal("approve_sms"), ...base, expectedRevision: revision, interactionId: id, reason: detail }),
  z.object({ action: z.literal("attempt_sms_delivery"), ...base, expectedRevision: revision, interactionId: id, reason: detail }),
  z.object({ action: z.literal("record_help"), ...base, expectedRevision: revision, helpInteractionId: id, receivedAt: z.string().datetime(), evidence: detail }),
  z.object({ action: z.literal("record_stop"), ...base, expectedRevision: revision, stopInteractionId: id, receivedAt: z.string().datetime(), evidence: detail }),
  z.object({ action: z.literal("record_call_metadata"), ...base, expectedRevision: revision, callInteractionId: id, occurredAt: z.string().datetime(), durationSeconds: z.number().int().min(1).max(14400), evidence: detail, recordingCreated: z.literal(false) }),
  z.object({ action: z.literal("associate_call"), ...base, expectedRevision: revision, callInteractionId: id, reason: detail }),
  z.object({ action: z.literal("confirm_time"), ...base, expectedRevision: revision, candidateTimeId: id, minutes: z.number().int().min(1).max(1440), narrative: z.string().min(12).max(500), taskCode: z.string().min(2).max(30), activityCode: z.string().min(2).max(30), reason: detail }),
  z.object({ action: z.literal("close"), ...base, expectedRevision: revision, reason: detail }),
]);
export type TelephonyCommand = z.infer<typeof telephonyCommand>;
export type TelephonyStatus = "configured" | "consented" | "sms_draft" | "sms_approved" | "delivery_blocked" | "opted_out" | "call_logged" | "matter_associated" | "time_confirmed" | "closed";
export type TelephonyState = { id: string; status: TelephonyStatus; revision: number; smsConsentStatus: "unknown" | "opted_in" | "opted_out"; voiceConsentStatus: "unknown" | "consented"; recordingAllowed: boolean };
const transitions: Record<Exclude<TelephonyCommand["action"], "configure_contact">, { from: TelephonyStatus; to: TelephonyStatus }> = {
  record_consents: { from: "configured", to: "consented" }, draft_sms: { from: "consented", to: "sms_draft" }, approve_sms: { from: "sms_draft", to: "sms_approved" },
  attempt_sms_delivery: { from: "sms_approved", to: "delivery_blocked" }, record_help: { from: "delivery_blocked", to: "delivery_blocked" }, record_stop: { from: "delivery_blocked", to: "opted_out" }, record_call_metadata: { from: "opted_out", to: "call_logged" },
  associate_call: { from: "call_logged", to: "matter_associated" }, confirm_time: { from: "matter_associated", to: "time_confirmed" }, close: { from: "time_confirmed", to: "closed" },
};
export function decideTelephony(input: { context: TenantContext; raw: unknown; current?: TelephonyState | null }) {
  const command = telephonyCommand.parse(input.raw);
  if (command.tenantId !== input.context.tenantId) throw new AuthorizationError();
  authorizeMatter(input.context, command.tenantId, command.matterId);
  let fromStatus = "not_created", toStatus: TelephonyStatus = "configured";
  if (command.action === "configure_contact") { if (input.current) throw new Error("Telephony contact identity already exists"); }
  else {
    const current = input.current; if (!current || current.revision !== command.expectedRevision) throw new Error("Telephony contact changed; refresh before retrying");
    const transition = transitions[command.action]; if (current.status !== transition.from) throw new Error(`${command.action} is not allowed from ${current.status}`);
    if (command.action === "draft_sms" && current.smsConsentStatus !== "opted_in") throw new Error("Current SMS opt-in is required");
    if (command.action === "record_call_metadata" && (current.voiceConsentStatus !== "consented" || current.recordingAllowed)) throw new Error("Voice consent with recording disabled is required");
    fromStatus = current.status; toStatus = transition.to;
  }
  if (["approve_sms", "associate_call", "confirm_time", "close"].includes(command.action)) requireRole(input.context, ["attorney", "partner"]);
  return { command, fromStatus, toStatus, event: createEvent({
    eventType: `telephony.${command.action}`, tenantId: command.tenantId, aggregateType: "telephony_contact", aggregateId: command.contactId,
    matterId: command.matterId, actorId: input.context.userId, correlationId: command.contactId, causationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey,
    source: "athena.web", visibility: "restricted", retentionPolicy: "matter-lifecycle-plus-firm-retention",
    payload: { action: command.action, fromStatus, toStatus, providerConnected: false, deliveryAttempted: false, recordingCreated: false, smsSuppressed: command.action === "record_stop", humanAuthorized: ["approve_sms", "associate_call", "confirm_time", "close"].includes(command.action) },
  }) };
}
