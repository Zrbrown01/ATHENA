import {
  decideDirectory,
  directoryCommand,
  type DirectoryIdentityState,
  type OffboardingState,
} from "@/domain/identity/directory";
import {
  countActiveAssignments,
  directoryProjection,
  persistDirectory,
  readDirectoryIdentity,
  readIdentityEvent,
  readOffboardingRun,
} from "@/platform/directory-persistence";
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
  "The role catalog, local fixture identity, scoped assignment, deterministic reconciliation, suspension, and offboarding evidence are Athena-native. Microsoft Entra SSO/SCIM, live MFA claims, delta synchronization, and automatic session/token revocation are not connected.";
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
      ...(await directoryProjection(PILOT_TENANT_ID)),
      limitation,
    });
  } catch (e) {
    if (e instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: "Directory administration could not be read" },
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
      action: "directory.command",
      policy: { limit: 30, windowMs: 60_000 },
    });
    const context = pilotContext(actor),
      command = directoryCommand.parse(await request.json()),
      prior = await readIdentityEvent(command.tenantId, command.idempotencyKey);
    if (prior)
      return Response.json({
        persistence: { replayed: true, eventId: prior.eventId },
        ...(await directoryProjection(command.tenantId)),
        limitation,
      });
    const identity = await readDirectoryIdentity(
        command.tenantId,
        command.identityId,
      ),
      run =
        "offboardingRunId" in command
          ? await readOffboardingRun(command.tenantId, command.offboardingRunId)
          : null,
      activeAssignmentCount = await countActiveAssignments(
        command.tenantId,
        command.identityId,
      ),
      decision = decideDirectory({
        context,
        raw: command,
        identity: identity as DirectoryIdentityState | null,
        run: run as OffboardingState | null,
        targetExists: Boolean(identity),
        activeAssignmentCount,
      }),
      persistence = await persistDirectory({
        ...decision,
        actor,
        activeAssignmentCount,
      });
    return Response.json({
      event: decision.event,
      persistence,
      ...(await directoryProjection(command.tenantId)),
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
      { error: e instanceof Error ? e.message : "Directory command failed" },
      { status: 400 },
    );
  }
}
