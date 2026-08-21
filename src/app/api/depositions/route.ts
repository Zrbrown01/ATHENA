import {
  decideDeposition,
  depositionCommand,
  type DepositionState,
} from "@/domain/depositions/lifecycle";
import {
  depositionProjection,
  persistDeposition,
  readDeposition,
  readDepositionEvent,
} from "@/platform/deposition-persistence";
import {
  GOLDEN_MATTER_ID,
  PILOT_TENANT_ID,
  pilotContext,
} from "@/platform/pilot-context";
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
  "Athena persists the native deposition request, governance approval, honest Noted block, human-verified external scheduling, calendar identity, completion, and a checksum-only synthetic transcript fixture. Noted API booking/status/transcript/invoice delivery, service, real transcript bytes, expense, and candidate-time confirmation remain unavailable.";
export async function GET(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor)
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    const context = pilotContext(actor);
    if (!context.matterAccess.has(GOLDEN_MATTER_ID))
      throw new AuthorizationError();
    return Response.json({
      ...(await depositionProjection(PILOT_TENANT_ID, GOLDEN_MATTER_ID)),
      limitation,
    });
  } catch (e) {
    if (e instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: "Depositions could not be read" },
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
      action: "depositions.command",
      policy: { limit: 30, windowMs: 60000 },
    });
    const context = pilotContext(actor),
      command = depositionCommand.parse(await request.json()),
      prior = await readDepositionEvent(
        command.tenantId,
        command.idempotencyKey,
      );
    if (prior)
      return Response.json({
        persistence: { replayed: true, eventId: prior.eventId },
        ...(await depositionProjection(command.tenantId, command.matterId)),
        limitation,
      });
    const current = await readDeposition(
        command.tenantId,
        command.matterId,
        command.depositionId,
      ),
      decision = decideDeposition({
        context,
        raw: command,
        current: current as DepositionState | null,
      }),
      persistence = await persistDeposition({ ...decision, actor });
    return Response.json({
      event: decision.event,
      persistence,
      ...(await depositionProjection(command.tenantId, command.matterId)),
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
      { error: e instanceof Error ? e.message : "Deposition command failed" },
      { status: 400 },
    );
  }
}
