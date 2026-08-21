import { decideDictation, dictationCommand, type DictationState } from "@/domain/dictation/lifecycle";
import { dictationProjection, persistDictation, readDictation, readDictationEvent } from "@/platform/dictation-persistence";
import { GOLDEN_MATTER_ID, PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/platform/rate-limit-persistence";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { AuthorizationError } from "@/platform/tenant-context";

const limitation = "Athena persists synthetic audio metadata, consent evidence, an honest Verbatim connection block, checksum-pinned synthetic transcript and templated draft, review, attorney approval, confirmed time, and matter work-product filing. No audio bytes leave Athena and no provider call is attempted. Real capture/transcription/reviewer delivery, vocabulary sync, attachments, deletion, and reconciliation remain unavailable.";

export async function GET(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    const context = pilotContext(actor);
    if (!context.matterAccess.has(GOLDEN_MATTER_ID)) throw new AuthorizationError();
    return Response.json({ ...(await dictationProjection(PILOT_TENANT_ID, GOLDEN_MATTER_ID)), limitation });
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: "Dictation sessions could not be read" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request);
    const actor = requestActor(request);
    if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    await enforceRateLimit({ tenantId: PILOT_TENANT_ID, actorId: actor.userId, action: "dictation.command", policy: { limit: 30, windowMs: 60000 } });
    const context = pilotContext(actor);
    const command = dictationCommand.parse(await request.json());
    const prior = await readDictationEvent(command.tenantId, command.idempotencyKey);
    if (prior) return Response.json({ persistence: { replayed: true, eventId: prior.eventId }, ...(await dictationProjection(command.tenantId, command.matterId)), limitation });
    const current = await readDictation(command.tenantId, command.matterId, command.sessionId);
    const decision = decideDictation({ context, raw: command, current: current as DictationState | null });
    const persistence = await persistDictation({ ...decision, actor });
    return Response.json({ event: decision.event, persistence, ...(await dictationProjection(command.tenantId, command.matterId)), limitation });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 });
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Dictation command failed" }, { status: 400 });
  }
}
