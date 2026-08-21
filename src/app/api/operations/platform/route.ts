import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateDeadline } from "@/domain/governance/deadline";
import { evaluateRetention } from "@/domain/platform/retention-policy";
import { pilotContext, PILOT_TENANT_ID, GOLDEN_MATTER_ID } from "@/platform/pilot-context";
import { readLatestOutboxReconciliation, readOutboxHealth, publishReadyInternalEvents, replayDeadLetters } from "@/platform/outbox-persistence";
import { readPlatformPolicies } from "@/platform/platform-policy-persistence";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { AuthorizationError, requireRole } from "@/platform/tenant-context";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/platform/rate-limit-persistence";
import { readSecurityControlHealth } from "@/platform/security-control-persistence";
import { runScheduledInternalDelivery } from "@/platform/outbox-scheduler";
import { assessAutomationHealth } from "@/domain/platform/automation-health";
import { readLatestCronAutomationHeartbeat } from "@/platform/automation-heartbeat-persistence";

const command = z.object({ action: z.enum(["publish_internal", "replay_dead_letters", "run_internal_cycle"]) });

export async function GET(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    requireRole(pilotContext(actor), ["partner", "firm_admin"]);
    return NextResponse.json(await projection());
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Platform health could not be read" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request);
    const actor = requestActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    await enforceRateLimit({ tenantId: PILOT_TENANT_ID, actorId: actor.userId, action: "platform.operate", policy: { limit: 10, windowMs: 60_000 } });
    requireRole(pilotContext(actor), ["partner", "firm_admin"]);
    const input = command.parse(await request.json());
    const result = input.action === "publish_internal" ? await publishReadyInternalEvents(PILOT_TENANT_ID, `operator:${actor.userId}`)
      : input.action === "replay_dead_letters" ? await replayDeadLetters(PILOT_TENANT_ID)
      : await runScheduledInternalDelivery({ trigger: `manual:${actor.userId}` });
    return NextResponse.json({ result, ...(await projection()) });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof RequestSecurityError) return NextResponse.json({ error: "Untrusted request origin" }, { status: 403 });
    if (error instanceof AuthorizationError) return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Platform operation failed" }, { status: 400 });
  }
}

async function projection() {
  const policies = await readPlatformPolicies(PILOT_TENANT_ID, GOLDEN_MATTER_ID);
  return {
    outbox: await readOutboxHealth(PILOT_TENANT_ID),
    reconciliation: await readLatestOutboxReconciliation(PILOT_TENANT_ID),
    scheduler: assessAutomationHealth(await readLatestCronAutomationHeartbeat(PILOT_TENANT_ID)),
    retention: evaluateRetention({ createdAt: new Date("2026-08-20T00:00:00.000Z"), asOf: new Date(), policy: policies.retention, activeLegalHold: policies.activeLegalHold }),
    deadline: calculateDeadline("2026-08-20", policies.deadlineRule, new Set(["2026-08-24"])),
    security: await readSecurityControlHealth(PILOT_TENANT_ID),
    providerMode: "athena_native",
    limitation: "Internal event-bus delivery only. External provider delivery remains disconnected.",
  };
}
