import {
  decideObligationGovernance,
  obligationGovernanceCommand,
  type GovernedObligationState,
  type ObligationEscalationState,
  type ObligationExceptionState,
} from "@/domain/governance/obligation-governance";
import {
  calculateDependentDeadline,
  evaluateDeadlineEscalation,
} from "@/domain/governance/deadline";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import {
  countPendingObligationExceptions,
  obligationGovernanceProjection,
  persistObligationGovernance,
  readObligationEscalation,
  readObligationException,
  readObligationGovernanceEvent,
} from "@/platform/obligation-governance-persistence";
import {
  listObligations,
  readObligation,
} from "@/platform/obligation-persistence";
import { OptimisticConcurrencyError } from "@/platform/optimistic-concurrency";
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
  "Dependency, exception/waiver, and escalation controls operate on synthetic firm-policy dates pending California attorney review. They are not statutory advice, court calculations, sourced holiday operations, or evidence of an external filing extension.";

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
      items: await listObligations(PILOT_TENANT_ID, GOLDEN_MATTER_ID),
      ...(await obligationGovernanceProjection(
        PILOT_TENANT_ID,
        GOLDEN_MATTER_ID,
      )),
      limitation,
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: "Obligation governance could not be read" },
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
      action: "obligations.governance.command",
      policy: { limit: 30, windowMs: 60_000 },
    });
    const command = obligationGovernanceCommand.parse(await request.json());
    const context = pilotContext(actor);
    await authorizePersistedMatter(context, command.tenantId, command.matterId);
    const prior = await readObligationGovernanceEvent(
      command.tenantId,
      command.idempotencyKey,
    );
    if (prior)
      return Response.json({
        persistence: { replayed: true, eventId: prior.eventId },
        items: await listObligations(command.tenantId, command.matterId),
        ...(await obligationGovernanceProjection(
          command.tenantId,
          command.matterId,
        )),
        limitation,
      });
    const obligationId =
      command.action === "create_dependent"
        ? command.predecessorObligationId
        : command.obligationId;
    const current =
      command.action === "acknowledge_escalation"
        ? null
        : await readObligation(
            command.tenantId,
            command.matterId,
            obligationId,
          );
    const exception =
      command.action === "decide_exception"
        ? await readObligationException(
            command.tenantId,
            command.matterId,
            command.exceptionId,
          )
        : null;
    const escalation =
      command.action === "acknowledge_escalation"
        ? await readObligationEscalation(
            command.tenantId,
            command.matterId,
            command.escalationId,
          )
        : null;
    const pendingExceptionCount = current
      ? await countPendingObligationExceptions(
          command.tenantId,
          command.matterId,
          current.id,
        )
      : 0;
    const dependency =
      command.action === "create_dependent" && current
        ? calculateDependentDeadline(
            current.dueAt.toISOString().slice(0, 10),
            command.offsetBusinessDays,
            command.relationType,
            syntheticClosures,
          )
        : null;
    const evaluation =
      command.action === "evaluate_escalation" && current
        ? evaluateDeadlineEscalation(
            current.dueAt.toISOString().slice(0, 10),
            command.asOfDate,
            syntheticClosures,
          )
        : null;
    const decision = decideObligationGovernance({
      context,
      raw: command,
      current: current as GovernedObligationState | null,
      exception: exception as ObligationExceptionState | null,
      escalation: escalation as ObligationEscalationState | null,
      pendingExceptionCount,
      evaluation,
    });
    const persistence = await persistObligationGovernance({
      ...decision,
      actor,
      dependency,
      evaluation,
    });
    return Response.json({
      event: decision.event,
      persistence,
      items: await listObligations(command.tenantId, command.matterId),
      ...(await obligationGovernanceProjection(
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
        [
          "Obligation changed;",
          "Exception request changed;",
          "Escalation changed;",
        ].some((prefix) => error.message.startsWith(prefix)))
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
            : "Obligation governance command failed",
      },
      { status: 400 },
    );
  }
}
