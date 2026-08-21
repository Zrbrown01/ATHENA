import {
  decideRecovery,
  recoveryCommand,
  type RecoveryExerciseState,
} from "@/domain/recovery/exercise";
import { PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitResponse,
} from "@/platform/rate-limit-persistence";
import {
  readRecoveryEvent,
  readRecoveryExercise,
  recoveryProjection,
  persistRecovery,
} from "@/platform/recovery-persistence";
import { requestActor } from "@/platform/request-actor";
import {
  assertTrustedWriteOrigin,
  RequestSecurityError,
} from "@/platform/request-security";
import { AuthorizationError } from "@/platform/tenant-context";
const limitation =
  "This proves a checksum-pinned local D1 export restored only into a disposable local environment. Sites/provider backup restore, production mutation, cross-region recovery, and independent validation are not represented.";
export async function GET(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor)
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    const context = pilotContext(actor);
    if (
      !context.roles.includes("partner") &&
      !context.roles.includes("security_admin")
    )
      throw new AuthorizationError();
    return Response.json({
      ...(await recoveryProjection(PILOT_TENANT_ID)),
      limitation,
    });
  } catch (e) {
    if (e instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: "Recovery evidence could not be read" },
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
      action: "recovery.exercise",
      policy: { limit: 20, windowMs: 60_000 },
    });
    const context = pilotContext(actor),
      command = recoveryCommand.parse(await request.json()),
      prior = await readRecoveryEvent(command.tenantId, command.idempotencyKey);
    if (prior)
      return Response.json({
        persistence: { replayed: true, eventId: prior.eventId },
        ...(await recoveryProjection(command.tenantId)),
        limitation,
      });
    const exercise = await readRecoveryExercise(
        command.tenantId,
        command.exerciseId,
      ),
      decision = decideRecovery({
        context,
        raw: command,
        exercise: exercise as RecoveryExerciseState | null,
        targetExists: Boolean(exercise),
      }),
      persistence = await persistRecovery({ ...decision, actor });
    return Response.json({
      event: decision.event,
      persistence,
      ...(await recoveryProjection(command.tenantId)),
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
      { error: e instanceof Error ? e.message : "Recovery command failed" },
      { status: 400 },
    );
  }
}
