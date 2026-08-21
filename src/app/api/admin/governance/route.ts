import {
  decidePolicySimulation,
  policySimulationCommand,
  resolveGovernancePolicy,
  type GovernancePolicyLayerState,
} from "@/domain/governance/policy-simulation";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import { OptimisticConcurrencyError } from "@/platform/optimistic-concurrency";
import {
  persistPolicySimulation,
  policySimulationProjection,
  readActiveGovernanceScopeLayer,
  readApplicableGovernancePolicyLayers,
  readGovernancePolicyLayer,
  readPolicySimulationEvent,
} from "@/platform/policy-simulation-persistence";
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

const syntheticClosures = new Set(["2026-08-24"]);
const limitation =
  "Policy precedence, overrides, version diffs, and simulations are Athena-native control evidence. All seeded deadline content is synthetic or pending attorney review; no California legal rule or external client instruction is activated.";

export async function GET(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor)
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    await authorizePersistedMatter(
      pilotContext(actor),
      PILOT_TENANT_ID,
      GOLDEN_MATTER_ID,
    );
    return Response.json({
      ...(await policySimulationProjection(PILOT_TENANT_ID, GOLDEN_MATTER_ID)),
      limitation,
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: "Governance policies could not be read" },
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
      action: "governance.policy.command",
      policy: { limit: 40, windowMs: 60_000 },
    });
    const command = policySimulationCommand.parse(await request.json());
    const context = pilotContext(actor);
    await authorizePersistedMatter(context, command.tenantId, command.matterId);
    const prior = await readPolicySimulationEvent(
      command.tenantId,
      command.idempotencyKey,
    );
    if (prior)
      return Response.json({
        persistence: { replayed: true, eventId: prior.eventId },
        ...(await policySimulationProjection(
          command.tenantId,
          command.matterId,
        )),
        limitation,
      });

    let currentScopeLayer = null;
    let supersededLayer = null;
    let resolution = null;
    if (command.action === "create_layer") {
      currentScopeLayer = await readActiveGovernanceScopeLayer({
        tenantId: command.tenantId,
        code: command.code,
        scopeType: command.scopeType,
        scopeId: command.scopeId,
      });
      supersededLayer = command.supersedesLayerId
        ? await readGovernancePolicyLayer(
            command.tenantId,
            command.supersedesLayerId,
          )
        : null;
    } else {
      resolution = resolveGovernancePolicy({
        layers: (await readApplicableGovernancePolicyLayers(
          command.tenantId,
          command.code,
        )) as GovernancePolicyLayerState[],
        code: command.code,
        subject: {
          tenantId: command.tenantId,
          clientId: command.clientId,
          matterType: command.matterType,
          matterId: command.matterId,
        },
        triggerDate: command.triggerDate,
        asOfDate: command.asOfDate,
        holidays: syntheticClosures,
        sandboxAcknowledged: command.sandboxAcknowledged,
      });
    }
    const decision = decidePolicySimulation({
      context,
      raw: command,
      currentScopeLayer: currentScopeLayer as GovernancePolicyLayerState | null,
      supersededLayer: supersededLayer as GovernancePolicyLayerState | null,
      resolution,
    });
    const persistence = await persistPolicySimulation({
      ...decision,
      actor,
      resolution,
    });
    return Response.json({
      event: decision.event,
      persistence,
      ...(await policySimulationProjection(command.tenantId, command.matterId)),
      limitation,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (
      error instanceof OptimisticConcurrencyError ||
      (error instanceof Error &&
        error.message.startsWith("Active policy layer changed;"))
    )
      return Response.json(
        { error: "Policy layer changed; refresh before retrying" },
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
            : "Governance policy command failed",
      },
      { status: 400 },
    );
  }
}
