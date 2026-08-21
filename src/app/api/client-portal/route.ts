import { clientPortalCommand, decideClientPortal, type ClientPortalState } from "@/domain/client-portal/lifecycle";
import { clientPortalProjection, persistClientPortal, readClientPortalAccess, readClientPortalEvent } from "@/platform/client-portal-persistence";
import { GOLDEN_MATTER_ID, PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/platform/rate-limit-persistence";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { AuthorizationError } from "@/platform/tenant-context";
const limitation = "Athena persists a synthetic client contact request, human identity evidence, attorney approval, expiration, per-resource sharing-policy outcomes, an honest external-login activation block, and revocation. External client login, invitation delivery, MFA/session enforcement, field-level projection, notifications, downloads, and identity/access reconciliation remain disabled; no invitation is sent.";
export async function GET(request: Request) {
  try { const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 }); const context = pilotContext(actor); if (!context.matterAccess.has(GOLDEN_MATTER_ID)) throw new AuthorizationError(); return Response.json({ ...(await clientPortalProjection(PILOT_TENANT_ID, GOLDEN_MATTER_ID)), limitation }); }
  catch (error) { if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 }); return Response.json({ error: "Client portal controls could not be read" }, { status: 500 }); }
}
export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request); const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    await enforceRateLimit({ tenantId: PILOT_TENANT_ID, actorId: actor.userId, action: "client_portal.command", policy: { limit: 30, windowMs: 60000 } });
    const context = pilotContext(actor), command = clientPortalCommand.parse(await request.json()), prior = await readClientPortalEvent(command.tenantId, command.idempotencyKey);
    if (prior) return Response.json({ persistence: { replayed: true, eventId: prior.eventId }, ...(await clientPortalProjection(command.tenantId, command.matterId)), limitation });
    const current = await readClientPortalAccess(command.tenantId, command.matterId, command.accessRequestId);
    const decision = decideClientPortal({ context, raw: command, current: current as ClientPortalState | null });
    const persistence = await persistClientPortal({ ...decision, actor });
    return Response.json({ event: decision.event, persistence, ...(await clientPortalProjection(command.tenantId, command.matterId)), limitation });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 });
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Client portal command failed" }, { status: 400 });
  }
}
