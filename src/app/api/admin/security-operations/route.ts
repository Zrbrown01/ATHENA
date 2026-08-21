import {
  decideSecurityOperations,
  securityOperationsCommand,
  type ControlState,
  type IncidentState,
  type RiskState,
} from "@/domain/security/operations";
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
import {
  readSecurityControl,
  readSecurityIncident,
  readSecurityOperationEvent,
  readSecurityRisk,
  securityOperationsProjection,
  persistSecurityOperations,
} from "@/platform/security-operations-persistence";
import { AuthorizationError } from "@/platform/tenant-context";

const limitation =
  "Athena persists manual incident, breach-review, control-evidence, and risk-treatment records. Automatic alert ingestion, identity-provider session/token revocation, legal conclusions, and external notifications are not connected and must not be inferred.";

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
      ...(await securityOperationsProjection(PILOT_TENANT_ID)),
      limitation,
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: "Security operations could not be read" },
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
      action: "security.operations",
      policy: { limit: 40, windowMs: 60_000 },
    });
    const context = pilotContext(actor);
    const command = securityOperationsCommand.parse(await request.json());
    const prior = await readSecurityOperationEvent(
      command.tenantId,
      command.idempotencyKey,
    );
    if (prior)
      return Response.json({
        event: null,
        persistence: { replayed: true, eventId: prior.eventId },
        ...(await securityOperationsProjection(command.tenantId)),
        limitation,
      });
    const incident =
      "incidentId" in command
        ? await readSecurityIncident(command.tenantId, command.incidentId)
        : null;
    const control =
      "controlId" in command
        ? await readSecurityControl(command.tenantId, command.controlId)
        : null;
    const risk =
      "riskId" in command
        ? await readSecurityRisk(command.tenantId, command.riskId)
        : null;
    const targetExists =
      command.action === "create_incident"
        ? Boolean(incident)
        : command.action === "register_control"
          ? Boolean(control)
          : command.action === "register_risk"
            ? Boolean(risk)
            : false;
    const decision = decideSecurityOperations({
      context,
      raw: command,
      incident: incident as IncidentState | null,
      control: control as ControlState | null,
      risk: risk as RiskState | null,
      targetExists,
    });
    const persistence = await persistSecurityOperations({ ...decision, actor });
    return Response.json({
      event: decision.event,
      persistence,
      ...(await securityOperationsProjection(command.tenantId)),
      limitation,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
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
          error instanceof Error ? error.message : "Security operation failed",
      },
      { status: 400 },
    );
  }
}
