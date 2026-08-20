import { decideWorkflow } from "@/domain/workflows/decision";
import { persistWorkflowDecision } from "@/platform/preview-persistence";
import { requestActor } from "@/platform/request-actor";

export async function POST(request: Request) {
  const actor = requestActor(request);
  if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    const { command, event } = decideWorkflow(actor.userId, await request.json());
    await persistWorkflowDecision({ workflowType: command.workflowType, aggregateId: command.aggregateId, action: command.action, reason: command.reason, actor, event });
    return Response.json({ event }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Decision failed" }, { status: 400 });
  }
}
