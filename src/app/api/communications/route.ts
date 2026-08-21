import { communicationCommand, decideCommunication, type AssociationCandidateState, type CommunicationMessageState, type CommunicationThreadState } from "@/domain/communications/lifecycle";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import { communicationProjection, persistCommunication, readAssociationCandidate, readCommunicationEvent, readCommunicationMessage, readCommunicationThread } from "@/platform/communication-persistence";
import { GOLDEN_MATTER_ID, PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/platform/rate-limit-persistence";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { AuthorizationError } from "@/platform/tenant-context";

const limitation = "Athena preserves synthetic message/thread identity, attachment metadata, human matter filing, drafts, approvals, and a retryable blocked delivery state. Microsoft Graph, OAuth, mailbox sync, notifications, delta recovery, attachment download, and sending remain disconnected.";

export async function GET(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    await authorizePersistedMatter(pilotContext(actor), PILOT_TENANT_ID, GOLDEN_MATTER_ID);
    return Response.json({ ...await communicationProjection(PILOT_TENANT_ID, GOLDEN_MATTER_ID), limitation });
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: "Communications could not be read" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request);
    const actor = requestActor(request);
    if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    await enforceRateLimit({ tenantId: PILOT_TENANT_ID, actorId: actor.userId, action: "communications.command", policy: { limit: 30, windowMs: 60_000 } });
    const context = pilotContext(actor);
    const command = communicationCommand.parse(await request.json());
    await authorizePersistedMatter(context, command.tenantId, command.matterId);
    if (command.action === "resolve_association" && command.decision === "file_to_another" && command.targetMatterId) await authorizePersistedMatter(context, command.tenantId, command.targetMatterId);
    const prior = await readCommunicationEvent(command.tenantId, command.idempotencyKey);
    if (prior) return Response.json({ event: null, persistence: { replayed: true, eventId: prior.eventId }, ...await communicationProjection(command.tenantId, command.matterId), limitation });
    const thread = "threadId" in command ? await readCommunicationThread(command.tenantId, command.threadId) : null;
    const candidate = "candidateId" in command ? await readAssociationCandidate(command.tenantId, command.candidateId) : null;
    const message = "messageId" in command ? await readCommunicationMessage(command.tenantId, command.messageId) : null;
    const targetExists = command.action === "materialize_fixture_inbound" ? Boolean(thread) : command.action === "create_outbound_draft" ? Boolean(message) : false;
    const decision = decideCommunication({ context, raw: command, thread: thread as CommunicationThreadState | null, candidate: candidate as AssociationCandidateState | null, message: message as CommunicationMessageState | null, targetExists });
    const persistence = await persistCommunication({ ...decision, actor });
    return Response.json({ event: decision.event, persistence, ...await communicationProjection(command.tenantId, command.matterId), limitation });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 });
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Communication command failed" }, { status: 400 });
  }
}
