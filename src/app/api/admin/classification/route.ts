import {
  classificationCommand,
  decideClassification,
  type ClassificationState,
  type OverrideState,
} from "@/domain/classification/policy";
import {
  classificationProjection,
  persistClassification,
  readClassification,
  readClassificationEvent,
  readClassificationOverride,
} from "@/platform/classification-persistence";
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
  "This release proves a versioned policy and immutable decisions against one explicitly synthetic document fixture. Search, AI, sharing, download, printing, retention, export, and logging decisions are modeled; production-wide resource labeling and enforcement adapters remain incomplete.";

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
      ...(await classificationProjection(PILOT_TENANT_ID)),
      limitation,
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: "Classification controls could not be read" },
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
      action: "classification.command",
      policy: { limit: 40, windowMs: 60_000 },
    });
    const context = pilotContext(actor);
    const command = classificationCommand.parse(await request.json());
    const prior = await readClassificationEvent(
      command.tenantId,
      command.idempotencyKey,
    );
    if (prior)
      return Response.json({
        persistence: { replayed: true, eventId: prior.eventId },
        ...(await classificationProjection(command.tenantId)),
        limitation,
      });
    const row = await readClassification(
      command.tenantId,
      command.resourceType,
      command.resourceId,
    );
    const override =
      command.action === "evaluate_plane"
        ? await readClassificationOverride(
            command.tenantId,
            command.resourceType,
            command.resourceId,
            command.plane,
          )
        : null;
    const classification = row
      ? ({
          labels: row.labels,
          policyVersion: row.policyVersion,
        } as ClassificationState)
      : null;
    const decision = decideClassification({
      context,
      raw: command,
      classification,
      override: override
        ? ({
            id: override.id,
            plane: override.plane,
            status: override.status,
            expiresAt: override.expiresAt,
          } as OverrideState)
        : null,
      targetExists: Boolean(row),
    });
    const persistence = await persistClassification({
      ...decision,
      actor,
      classification,
      override: override as OverrideState | null,
    });
    return Response.json({
      event: decision.event,
      persistence,
      ...(await classificationProjection(command.tenantId)),
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
          error instanceof Error
            ? error.message
            : "Classification command failed",
      },
      { status: 400 },
    );
  }
}
