import {
  decideDirectoryReconciliation,
  directoryReconciliationCommand,
  type DirectoryReconciliationState,
} from "@/domain/identity/directory-reconciliation";
import {
  directoryReconciliationProjection,
  persistDirectoryReconciliation,
  readDirectoryReconciliation,
} from "@/platform/directory-reconciliation-persistence";
import { readIdentityEvent } from "@/platform/directory-persistence";
import { OptimisticConcurrencyError } from "@/platform/optimistic-concurrency";
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
  "The deterministic snapshot exercises identity, status, MFA-claim, and role drift controls only. Microsoft Entra tenant consent, credentials, live users/groups, delta sync, session revocation, and provider reconciliation remain disconnected.";

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
      !context.roles.some((role) =>
        ["partner", "security_admin"].includes(role),
      )
    )
      throw new AuthorizationError();
    return Response.json({
      ...(await directoryReconciliationProjection(PILOT_TENANT_ID)),
      limitation,
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: "Directory reconciliation could not be read" },
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
      action: "directory.reconciliation.command",
      policy: { limit: 20, windowMs: 60_000 },
    });
    const command = directoryReconciliationCommand.parse(await request.json());
    const context = pilotContext(actor);
    const prior = await readIdentityEvent(
      command.tenantId,
      command.idempotencyKey,
    );
    if (prior)
      return Response.json({
        persistence: { replayed: true, eventId: prior.eventId },
        ...(await directoryReconciliationProjection(command.tenantId)),
        limitation,
      });
    const current = await readDirectoryReconciliation(
      command.tenantId,
      command.reconciliationId,
    );
    const decision = decideDirectoryReconciliation({
      context,
      raw: command,
      current: current as DirectoryReconciliationState | null,
    });
    const persistence = await persistDirectoryReconciliation({
      ...decision,
      actor,
    });
    return Response.json({
      event: decision.event,
      persistence,
      ...(await directoryReconciliationProjection(command.tenantId)),
      limitation,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (
      error instanceof OptimisticConcurrencyError ||
      (error instanceof Error &&
        error.message.startsWith("Directory reconciliation changed;"))
    )
      return Response.json(
        { error: "Record changed; refresh before retrying" },
        { status: 409 },
      );
    if (error instanceof RequestSecurityError)
      return Response.json(
        { error: "Untrusted request origin" },
        { status: 403 },
      );
    if (error instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Directory reconciliation command failed",
      },
      { status: 400 },
    );
  }
}
