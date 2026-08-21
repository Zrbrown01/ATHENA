import {
  decideObligationRebuild,
  obligationRebuildCommand,
  rebuildMatterObligations,
  type RebuildDependency,
  type RebuildException,
  type RebuildObligation,
  type RebuildRule,
} from "@/domain/governance/obligation-rebuild";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import { OptimisticConcurrencyError } from "@/platform/optimistic-concurrency";
import {
  obligationRebuildProjection,
  persistObligationRebuild,
  readObligationRebuildEvent,
  readObligationRebuildEvidence,
  readObligationRebuildRun,
} from "@/platform/obligation-rebuild-persistence";
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
  "Rebuilds are immutable comparison evidence only. Athena never changes an obligation, deadline, exception, or waiver from a rebuild; blocked or drifted findings require partner review, and seeded legal content remains synthetic.";

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
      ...(await obligationRebuildProjection(PILOT_TENANT_ID, GOLDEN_MATTER_ID)),
      limitation,
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: "Obligation rebuild evidence could not be read" },
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
      action: "governance.rebuild.command",
      policy: { limit: 20, windowMs: 60_000 },
    });
    const command = obligationRebuildCommand.parse(await request.json());
    const context = pilotContext(actor);
    await authorizePersistedMatter(context, command.tenantId, command.matterId);
    const prior = await readObligationRebuildEvent(
      command.tenantId,
      command.idempotencyKey,
    );
    if (prior)
      return Response.json({
        persistence: { replayed: true, eventId: prior.eventId },
        ...(await obligationRebuildProjection(
          command.tenantId,
          command.matterId,
        )),
        limitation,
      });
    let result = null;
    let current = null;
    if (command.action === "run_rebuild") {
      const evidence = await readObligationRebuildEvidence(
        command.tenantId,
        command.matterId,
      );
      result = rebuildMatterObligations({
        obligations: evidence.obligations as RebuildObligation[],
        rules: evidence.rules as RebuildRule[],
        dependencies: evidence.dependencies as RebuildDependency[],
        exceptions: evidence.exceptions as RebuildException[],
        asOfDate: command.asOfDate,
        holidays: syntheticClosures,
      });
    } else
      current = await readObligationRebuildRun(
        command.tenantId,
        command.matterId,
        command.runId,
      );
    const decision = decideObligationRebuild({
      context,
      raw: command,
      current,
      result,
    });
    const persistence = await persistObligationRebuild({
      ...decision,
      actor,
      result,
    });
    return Response.json({
      event: decision.event,
      persistence,
      ...(await obligationRebuildProjection(
        command.tenantId,
        command.matterId,
      )),
      limitation,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (
      error instanceof OptimisticConcurrencyError ||
      (error instanceof Error &&
        error.message.startsWith("Rebuild review changed;"))
    )
      return Response.json(
        { error: "Rebuild review changed; refresh before retrying" },
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
            : "Obligation rebuild command failed",
      },
      { status: 400 },
    );
  }
}
