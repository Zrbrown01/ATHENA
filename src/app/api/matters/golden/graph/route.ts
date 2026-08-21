import { decideMatterGraph, goldenMatterGraph, matterGraphCommand } from "@/domain/matter-graph";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import { readMatterGraph, persistMatterGraph } from "@/platform/matter-graph-persistence";
import { GOLDEN_MATTER_ID, PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/platform/rate-limit-persistence";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { AuthorizationError } from "@/platform/tenant-context";

export async function GET(request: Request) {
  try {
    const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    const context = pilotContext(actor); await authorizePersistedMatter(context, PILOT_TENANT_ID, GOLDEN_MATTER_ID);
    return Response.json({ graph: await readMatterGraph(PILOT_TENANT_ID, GOLDEN_MATTER_ID), limitation: "The graph is durable and non-flattened. Its current provenance is deterministic sandbox data; MerusCase and EAMS are not connected." });
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: "Matter graph could not be read" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request);
    const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    await enforceRateLimit({ tenantId: PILOT_TENANT_ID, actorId: actor.userId, action: "matter_graph.materialize", policy: { limit: 5, windowMs: 60_000 } });
    const context = pilotContext(actor), raw = await request.json() as Record<string, unknown>;
    const parsed = matterGraphCommand.parse({ ...raw, graph: goldenMatterGraph });
    await authorizePersistedMatter(context, parsed.tenantId, parsed.matterId);
    const decision = decideMatterGraph({ context, raw: parsed });
    const persistence = await persistMatterGraph({ ...decision, actor });
    return Response.json({ event: persistence.replayed ? null : decision.event, persistence, graph: await readMatterGraph(parsed.tenantId, parsed.matterId), limitation: "Durable deterministic sandbox graph only; no external system was contacted." });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 });
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Matter graph command failed" }, { status: 400 });
  }
}
