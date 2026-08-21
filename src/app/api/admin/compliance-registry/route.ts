import {
  decideComplianceRegistry,
  complianceRegistryCommand,
  type SubprocessorState,
} from "@/domain/compliance/registry";
import {
  buildActivationInputs,
  complianceProjection,
  persistComplianceRegistry,
  readComplianceEvent,
  readSubprocessor,
} from "@/platform/compliance-registry-persistence";
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
  "This registry contains synthetic vendor-review and draft-agreement evidence only. No BAA/DPA is represented as executed, no credential activation is allowed, and no provider is connected.";
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
      ...(await complianceProjection(PILOT_TENANT_ID)),
      limitation,
    });
  } catch (e) {
    if (e instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: "Compliance registry could not be read" },
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
      action: "compliance.registry",
      policy: { limit: 30, windowMs: 60_000 },
    });
    const context = pilotContext(actor),
      command = complianceRegistryCommand.parse(await request.json()),
      prior = await readComplianceEvent(
        command.tenantId,
        command.idempotencyKey,
      );
    if (prior)
      return Response.json({
        persistence: { replayed: true, eventId: prior.eventId },
        ...(await complianceProjection(command.tenantId)),
        limitation,
      });
    const vendor = await readSubprocessor(
        command.tenantId,
        command.subprocessorId,
      ),
      activationInputs =
        command.action === "assess_activation"
          ? await buildActivationInputs(
              command.tenantId,
              command.subprocessorId,
            )
          : undefined,
      decision = decideComplianceRegistry({
        context,
        raw: command,
        vendor: vendor as SubprocessorState | null,
        targetExists: Boolean(vendor),
        activationInputs,
      }),
      persistence = await persistComplianceRegistry({ ...decision, actor });
    return Response.json({
      event: decision.event,
      persistence,
      ...(await complianceProjection(command.tenantId)),
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
      { error: e instanceof Error ? e.message : "Compliance command failed" },
      { status: 400 },
    );
  }
}
