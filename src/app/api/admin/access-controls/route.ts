import { accessReviewCommand, decideAccessReview, decideSupportAccess, supportAccessCommand } from "@/domain/platform/support-access";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import { GOLDEN_MATTER_ID, PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/platform/rate-limit-persistence";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { listAccessReviews, listSupportGrants, persistAccessReview, persistSupportAccess, readSupportGrant } from "@/platform/support-access-persistence";
import { AuthorizationError, requireRole } from "@/platform/tenant-context";

export async function GET(request: Request) {
  try { const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 }); const context = pilotContext(actor); requireRole(context, ["partner", "firm_admin"]); await authorizePersistedMatter(context, PILOT_TENANT_ID, GOLDEN_MATTER_ID); return Response.json({ grants: await listSupportGrants(PILOT_TENANT_ID), reviews: await listAccessReviews(PILOT_TENANT_ID), limitation: "The synthetic support grant authorizes only the scope-check endpoint; it does not bypass owner-only Sites access or expose matter content." }); }
  catch(error) { if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 }); return Response.json({ error: "Access controls could not be read" }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request); const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    await enforceRateLimit({ tenantId: PILOT_TENANT_ID, actorId: actor.userId, action: "access_controls.command", policy: { limit: 10, windowMs: 60_000 } });
    const raw = await request.json() as { action?: string }; const context = pilotContext(actor); requireRole(context, ["partner", "firm_admin"]);
    if (raw.action === "attest_review") { const decision = decideAccessReview(context, accessReviewCommand.parse(raw)); const persistence = await persistAccessReview({ ...decision, actor }); return Response.json({ event: decision.event, persistence, grants: await listSupportGrants(PILOT_TENANT_ID), reviews: await listAccessReviews(PILOT_TENANT_ID) }); }
    const command = supportAccessCommand.parse(raw); await authorizePersistedMatter(context, command.tenantId, command.matterId); const current = await readSupportGrant(command.tenantId, command.matterId, command.supportUserId); const decision = decideSupportAccess(context, command, current); const persistence = await persistSupportAccess({ ...decision, actor });
    return Response.json({ event: decision.event, persistence, grants: await listSupportGrants(PILOT_TENANT_ID), reviews: await listAccessReviews(PILOT_TENANT_ID) });
  } catch(error) { if (error instanceof RateLimitError) return rateLimitResponse(error); if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 }); if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 }); return Response.json({ error: error instanceof Error ? error.message : "Access-control command failed" }, { status: 400 }); }
}
