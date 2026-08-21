import { costGovernanceCommand, decideCostGovernance } from "@/domain/platform/cost-governance";
import { costGovernanceProjection, persistCostGovernance, readCostEvent, readCostRateCard, readCostRateItems, readUsageCostEntry } from "@/platform/cost-governance-persistence";
import { PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/platform/rate-limit-persistence";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { OptimisticConcurrencyError } from "@/platform/optimistic-concurrency";
import { AuthorizationError, requireRole } from "@/platform/tenant-context";

const limitation = "Synthetic planning rates and Athena-measured fixture usage only. No provider invoice, client charge, accounting posting, or production cost claim is represented.";

export async function GET(request: Request) {
  try {
    const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    const context = pilotContext(actor); requireRole(context, ["partner", "firm_admin", "billing_specialist"]);
    return Response.json({ ...(await costGovernanceProjection(PILOT_TENANT_ID)), limitation });
  } catch (error) { if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 }); return Response.json({ error: "Cost governance could not be read" }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request); const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    await enforceRateLimit({ tenantId: PILOT_TENANT_ID, actorId: actor.userId, action: "cost.governance", policy: { limit: 30, windowMs: 60_000 } });
    const context = pilotContext(actor), command = costGovernanceCommand.parse(await request.json()), prior = await readCostEvent(command.tenantId, command.idempotencyKey);
    if (prior) return Response.json({ persistence: { replayed: true, eventId: prior.eventId }, ...(await costGovernanceProjection(command.tenantId)), limitation });
    const rateCard = await readCostRateCard(command.tenantId, command.rateCardId), rates = command.action === "record_usage" ? await readCostRateItems(command.tenantId, command.rateCardId) : undefined, usageExists = command.action === "record_usage" ? Boolean(await readUsageCostEntry(command.tenantId, command.usageEntryId)) : false;
    const decision = decideCostGovernance({ context, raw: command, rateCard, rates, usageExists }), persistence = await persistCostGovernance({ ...decision, actor });
    return Response.json({ event: decision.event, persistence, ...(await costGovernanceProjection(command.tenantId)), limitation });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 });
    if (error instanceof OptimisticConcurrencyError) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Cost governance command failed" }, { status: 400 });
  }
}
