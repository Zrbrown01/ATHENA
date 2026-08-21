import { decideWorkflow } from "@/domain/workflows/decision";
import { persistWorkflowDecision } from "@/platform/preview-persistence";
import { requestActor } from "@/platform/request-actor";
import { pilotContext } from "@/platform/pilot-context";
import { AuthorizationError } from "@/platform/tenant-context";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/platform/rate-limit-persistence";
import { PILOT_TENANT_ID } from "@/platform/pilot-context";

export async function POST(request: Request) {
  try { assertTrustedWriteOrigin(request); }
  catch (error) { if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 }); throw error; }
  const actor = requestActor(request);
  if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    await enforceRateLimit({ tenantId: PILOT_TENANT_ID, actorId: actor.userId, action: "workflow.decide" });
    const { command, event } = decideWorkflow(pilotContext(actor), await request.json());
    if (event.matterId) await authorizePersistedMatter(pilotContext(actor), event.tenantId, event.matterId);
    await persistWorkflowDecision({ workflowType: command.workflowType, aggregateId: command.aggregateId, action: command.action, reason: command.reason, actor, event });
    return Response.json({ event }, { status: 200 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Decision failed" }, { status: 400 });
  }
}
