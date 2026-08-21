import { decideTelephony, telephonyCommand, type TelephonyState } from "@/domain/telephony/lifecycle";
import { persistTelephony, readTelephonyContact, readTelephonyEvent, telephonyProjection } from "@/platform/telephony-persistence";
import { GOLDEN_MATTER_ID, PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/platform/rate-limit-persistence";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { AuthorizationError } from "@/platform/tenant-context";
const limitation = "Athena persists provider-neutral synthetic numbers, consent, an attorney-approved SMS draft, an honest delivery block, human-recorded HELP/STOP evidence and suppression, non-recorded call metadata, matter filing, and confirmed time. No live number, routing, message, call, recording, notification, delivery receipt, or provider reconciliation exists.";
export async function GET(request: Request) { try { const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 }); const context = pilotContext(actor); if (!context.matterAccess.has(GOLDEN_MATTER_ID)) throw new AuthorizationError(); return Response.json({ ...(await telephonyProjection(PILOT_TENANT_ID, GOLDEN_MATTER_ID)), limitation }); } catch (error) { if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 }); return Response.json({ error: "Telephony controls could not be read" }, { status: 500 }); } }
export async function POST(request: Request) { try {
  assertTrustedWriteOrigin(request); const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  await enforceRateLimit({ tenantId: PILOT_TENANT_ID, actorId: actor.userId, action: "telephony.command", policy: { limit: 40, windowMs: 60000 } });
  const context = pilotContext(actor), command = telephonyCommand.parse(await request.json()), prior = await readTelephonyEvent(command.tenantId, command.idempotencyKey);
  if (prior) return Response.json({ persistence: { replayed: true, eventId: prior.eventId }, ...(await telephonyProjection(command.tenantId, command.matterId)), limitation });
  const current = await readTelephonyContact(command.tenantId, command.matterId, command.contactId), decision = decideTelephony({ context, raw: command, current: current as TelephonyState | null }), persistence = await persistTelephony({ ...decision, actor });
  return Response.json({ event: decision.event, persistence, ...(await telephonyProjection(command.tenantId, command.matterId)), limitation });
} catch (error) { if (error instanceof RateLimitError) return rateLimitResponse(error); if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 }); if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 }); return Response.json({ error: error instanceof Error ? error.message : "Telephony command failed" }, { status: 400 }); } }
