import {
  decideDisposition,
  dispositionCommand,
  type DispositionState,
} from "@/domain/disposition/lifecycle";
import {
  countDispositionHolds,
  dispositionProjection,
  persistDisposition,
  readDispositionApprovals,
  readDispositionEvent,
  readDispositionRequest,
  readDispositionTarget,
} from "@/platform/disposition-persistence";
import { PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitResponse,
} from "@/platform/rate-limit-persistence";
import { requestActor } from "@/platform/request-actor";
import {
  assertTrustedWriteOrigin,
  RequestSecurityError,
} from "@/platform/request-security";
import { AuthorizationError } from "@/platform/tenant-context";
const limitation =
  "Execution is implemented only for an explicitly synthetic disposable sandbox record. Real matter/document deletion, object-store erasure, provider erasure, and tenant offboarding require expanded inventory and independent approval evidence.";
export async function GET(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor)
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    const context = pilotContext(actor);
    if (!context.roles.some((x) => ["partner", "security_admin"].includes(x)))
      throw new AuthorizationError();
    return Response.json({
      ...(await dispositionProjection(PILOT_TENANT_ID)),
      limitation,
    });
  } catch (e) {
    if (e instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: "Disposition operations could not be read" },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request);
    const actor = requestActor(request);
    if (!actor)
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    await enforceRateLimit({
      tenantId: PILOT_TENANT_ID,
      actorId: actor.userId,
      action: "disposition.command",
      policy: { limit: 30, windowMs: 60_000 },
    });
    const context = pilotContext(actor),
      command = dispositionCommand.parse(await request.json()),
      prior = await readDispositionEvent(
        command.tenantId,
        command.idempotencyKey,
      );
    if (prior)
      return Response.json({
        persistence: { replayed: true, eventId: prior.eventId },
        ...(await dispositionProjection(command.tenantId)),
        limitation,
      });
    const requestRow = await readDispositionRequest(
        command.tenantId,
        command.requestId,
      ),
      targetId =
        command.action === "materialize_sandbox_candidate"
          ? command.targetId
          : (requestRow?.targetId ?? "missing"),
      target = await readDispositionTarget(command.tenantId, targetId),
      approvals = await readDispositionApprovals(
        command.tenantId,
        command.requestId,
      ),
      legalHoldCount = await countDispositionHolds(
        command.tenantId,
        command.matterId,
      ),
      decision = decideDisposition({
        context,
        raw: command,
        request: requestRow as DispositionState | null,
        targetExists: Boolean(target),
        targetSyntheticDisposable: Boolean(target?.syntheticDisposable),
        legalHoldCount,
        approvals: approvals.map((x) => ({
          approverId: x.approverId,
          outcome: x.outcome,
        })),
      }),
      persistence = await persistDisposition({
        ...decision,
        actor,
        target,
        legalHoldCount,
        approvalCount: approvals.length,
      });
    return Response.json({
      event: decision.event,
      persistence,
      ...(await dispositionProjection(command.tenantId)),
      limitation,
    });
  } catch (e) {
    if (e instanceof RateLimitError) return rateLimitResponse(e);
    if (e instanceof RequestSecurityError)
      return Response.json(
        { error: "Untrusted request origin" },
        { status: 403 },
      );
    if (e instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: e instanceof Error ? e.message : "Disposition command failed" },
      { status: 400 },
    );
  }
}
