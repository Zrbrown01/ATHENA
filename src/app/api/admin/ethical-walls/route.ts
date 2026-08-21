import { decideEthicalWall, ethicalWallCommand } from "@/domain/governance/ethical-wall";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import { listEthicalWalls, persistEthicalWall, readEthicalWall } from "@/platform/ethical-wall-persistence";
import { GOLDEN_MATTER_ID, PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { AuthorizationError, requireRole } from "@/platform/tenant-context";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/platform/rate-limit-persistence";

export async function GET(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    const context = pilotContext(actor);
    requireRole(context, ["partner", "firm_admin"]);
    await authorizePersistedMatter(context, PILOT_TENANT_ID, GOLDEN_MATTER_ID);
    return Response.json({ items: await listEthicalWalls(PILOT_TENANT_ID, GOLDEN_MATTER_ID), limitation: "Pilot administration targets synthetic internal identities. No support or break-glass access is granted by this control." });
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: "Ethical walls could not be read" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request);
    const actor = requestActor(request);
    if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    await enforceRateLimit({ tenantId: PILOT_TENANT_ID, actorId: actor.userId, action: "ethical_walls.command", policy: { limit: 10, windowMs: 60_000 } });
    const context = pilotContext(actor);
    const command = ethicalWallCommand.parse(await request.json());
    await authorizePersistedMatter(context, command.tenantId, command.matterId);
    const current = await readEthicalWall(command.tenantId, command.matterId, command.targetUserId);
    const decision = decideEthicalWall(context, command, current);
    const persistence = await persistEthicalWall({ ...decision, actor });
    return Response.json({ event: decision.event, persistence, items: await listEthicalWalls(command.tenantId, command.matterId) });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 });
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Ethical wall command failed" }, { status: 400 });
  }
}
