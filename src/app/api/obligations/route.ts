import { calculateDeadline } from "@/domain/governance/deadline";
import { decideObligation, obligationCommand } from "@/domain/governance/obligation";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import { GOLDEN_MATTER_ID, PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import { listObligations, persistObligationDecision, readObligation, readObligationRule } from "@/platform/obligation-persistence";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { AuthorizationError } from "@/platform/tenant-context";

const PILOT_RULE = "firm-pilot-qme-review";
const SYNTHETIC_CLOSURES = new Set(["2026-08-24"]);

export async function GET(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    const context = pilotContext(actor);
    await authorizePersistedMatter(context, PILOT_TENANT_ID, GOLDEN_MATTER_ID);
    const [items, rule] = await Promise.all([listObligations(PILOT_TENANT_ID, GOLDEN_MATTER_ID), readObligationRule(PILOT_TENANT_ID, PILOT_RULE)]);
    return Response.json({ items, rule: rule && { code: rule.code, version: rule.version, authorityCitation: rule.authorityCitation, contentStatus: rule.contentStatus, reviewBy: rule.reviewBy }, limitation: "The active pilot rule and supplied closure date are synthetic firm-policy content, not a California statutory deadline." });
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: "Obligations could not be read" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request);
    const actor = requestActor(request);
    if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    const context = pilotContext(actor);
    const command = obligationCommand.parse(await request.json());
    await authorizePersistedMatter(context, command.tenantId, command.matterId);
    const rule = command.action === "create" ? await readObligationRule(command.tenantId, command.ruleCode) : undefined;
    const deadline = command.action === "create" && rule ? calculateDeadline(command.triggerDate, rule.deadlineRule, SYNTHETIC_CLOSURES) : undefined;
    const current = command.action === "create" ? undefined : await readObligation(command.tenantId, command.matterId, command.obligationId);
    const decision = decideObligation({ context, raw: command, current, rule: rule && { code: rule.code, version: rule.version, contentStatus: rule.contentStatus }, deadline });
    const persistence = await persistObligationDecision({ ...decision, actor, deadline, rule: rule ?? undefined });
    return Response.json({ event: decision.event, persistence, items: await listObligations(command.tenantId, command.matterId) });
  } catch (error) {
    if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 });
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Obligation command failed" }, { status: 400 });
  }
}
