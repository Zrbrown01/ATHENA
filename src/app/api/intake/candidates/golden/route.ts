import {
  decideIntakeCandidate,
  intakeCandidateCommand,
} from "@/domain/intake/candidate";
import {
  planOpeningObligations,
  type OpeningRule,
} from "@/domain/intake/opening-obligations";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import {
  GOLDEN_CONFLICT_ID,
  GOLDEN_INTAKE_CANDIDATE_ID,
  GOLDEN_MATCH_ID,
  persistIntakeDecision,
  readIntakeEventByIdempotency,
  readIntakeOpeningRules,
  readIntakeProjection,
} from "@/platform/intake-candidate-persistence";
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

const limitation =
  "This intake uses a preserved deterministic referral, synthetic match evidence, a synthetic conflict index, and acknowledged synthetic opening rules. Initial obligations are firm-workflow evidence, not approved California legal deadlines. No mailbox, MerusCase, conflict database, malware scanner, or OCR provider is connected.";
export async function GET(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor)
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    const context = pilotContext(actor);
    await authorizePersistedMatter(context, PILOT_TENANT_ID, GOLDEN_MATTER_ID);
    return Response.json({
      ...(await readIntakeProjection(
        PILOT_TENANT_ID,
        GOLDEN_INTAKE_CANDIDATE_ID,
      )),
      limitation,
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: "Intake candidate could not be read" },
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
      action: "intake.candidate",
      policy: { limit: 12, windowMs: 60_000 },
    });
    const context = pilotContext(actor),
      raw = (await request.json()) as Record<string, unknown>,
      projection = await readIntakeProjection(
        PILOT_TENANT_ID,
        GOLDEN_INTAKE_CANDIDATE_ID,
      );
    const parsed = intakeCandidateCommand.parse({
      ...raw,
      tenantId: PILOT_TENANT_ID,
      candidateId: GOLDEN_INTAKE_CANDIDATE_ID,
      matterId: GOLDEN_MATTER_ID,
      conflictId:
        raw.action === "clear_conflict" ? GOLDEN_CONFLICT_ID : raw.conflictId,
      matchId: raw.action === "resolve_match" ? GOLDEN_MATCH_ID : raw.matchId,
    });
    await authorizePersistedMatter(context, parsed.tenantId, parsed.matterId);
    const priorEvent = await readIntakeEventByIdempotency(
      parsed.tenantId,
      parsed.idempotencyKey,
    );
    if (priorEvent)
      return Response.json({
        event: null,
        persistence: { replayed: true, eventId: priorEvent.eventId },
        ...projection,
        limitation,
      });
    const needsOpeningPlan =
      parsed.action === "approve_open" ||
      parsed.action === "materialize_initial_obligations";
    const openingPlan = needsOpeningPlan
      ? planOpeningObligations({
          tenantId: parsed.tenantId,
          matterId: parsed.matterId,
          candidateId: parsed.candidateId,
          ownerId: actor.userId,
          triggerDate: parsed.openingTriggerDate,
          asOfDate: new Date().toISOString().slice(0, 10),
          rules: (await readIntakeOpeningRules(
            parsed.tenantId,
          )) as OpeningRule[],
          holidays: new Set(["2026-08-24"]),
          syntheticDataAcknowledged: parsed.syntheticDataAcknowledged,
        })
      : undefined;
    const decision = decideIntakeCandidate({
      context,
      raw: parsed,
      current: projection.candidate,
      openConflictCount: projection.openConflictCount,
      unresolvedMatchCount: projection.unresolvedMatchCount,
      openingPlanCount: openingPlan?.length,
      existingOpeningObligationCount: projection.openingObligations.length,
    });
    const persistence = await persistIntakeDecision({
      ...decision,
      actor,
      openingPlan,
    });
    return Response.json({
      event: persistence.replayed ? null : decision.event,
      persistence,
      ...(await readIntakeProjection(
        PILOT_TENANT_ID,
        GOLDEN_INTAKE_CANDIDATE_ID,
      )),
      limitation,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (
      error instanceof OptimisticConcurrencyError ||
      (error instanceof Error &&
        error.message.startsWith("Intake candidate changed;"))
    )
      return Response.json(
        { error: "Intake candidate changed; refresh before retrying" },
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
        error: error instanceof Error ? error.message : "Intake command failed",
      },
      { status: 400 },
    );
  }
}
