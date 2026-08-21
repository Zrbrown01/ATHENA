import { z } from "zod";
import {
  calculateDeadline,
  calculateDependentDeadline,
  type DeadlineRule,
} from "./deadline";
import { createEvent } from "@/platform/events";
import {
  authorizeMatter,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";

const base = {
  tenantId: z.string().min(1),
  matterId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(200),
};
export const obligationRebuildCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("run_rebuild"),
    ...base,
    runId: z.string().min(3).max(160),
    asOfDate: z.iso.date(),
    syntheticDataAcknowledged: z.literal(true),
  }),
  z.object({
    action: z.literal("review_rebuild"),
    ...base,
    runId: z.string().min(3).max(160),
    expectedRevision: z.number().int().positive(),
    outcome: z.enum(["certified", "exceptions_noted"]),
    notes: z.string().trim().min(12).max(1500),
  }),
]);
export type ObligationRebuildCommand = z.infer<typeof obligationRebuildCommand>;

export type RebuildObligation = {
  id: string;
  ruleId: string;
  ruleCode: string;
  ruleVersion: number;
  authorityCitation: string;
  triggerAt: Date;
  dueAt: Date;
  status: "open" | "completed" | "cancelled" | "waived";
};
export type RebuildRule = {
  id: string;
  code: string;
  version: number;
  authorityType: DeadlineRule["authorityType"];
  authorityCitation: string;
  businessDays: number;
  effectiveAt: Date;
  reviewBy: Date;
  contentStatus:
    "synthetic_sandbox" | "pending_attorney_review" | "attorney_approved";
  reviewedBy: string | null;
  reviewedAt: Date | null;
};
export type RebuildDependency = {
  id: string;
  predecessorObligationId: string;
  successorObligationId: string;
  relationType: "preparation_before" | "follow_up_after";
  offsetBusinessDays: number;
};
export type RebuildException = {
  id: string;
  obligationId: string;
  exceptionType: "due_date_exception" | "waiver";
  status: "requested" | "approved" | "denied" | "revoked";
  proposedDueAt: Date | null;
};
export type RebuildFinding = {
  obligationId: string;
  result: "matched" | "drifted" | "blocked";
  actualDueDate: string;
  expectedDueDate: string | null;
  actualStatus: string;
  expectedStatus: string | null;
  ruleCode: string;
  ruleVersion: number;
  dependencyId: string | null;
  exceptionIds: string[];
  reasons: string[];
  calculation: string[];
};
export type RebuildResult = {
  outcome: "matched" | "exceptions" | "blocked";
  findings: RebuildFinding[];
  matchedCount: number;
  driftedCount: number;
  blockedCount: number;
};

const date = (value: Date) => value.toISOString().slice(0, 10);
const key = (code: string, version: number) => `${code}@${version}`;

export function rebuildMatterObligations(input: {
  obligations: RebuildObligation[];
  rules: RebuildRule[];
  dependencies: RebuildDependency[];
  exceptions: RebuildException[];
  asOfDate: string;
  holidays: Set<string>;
}): RebuildResult {
  const rules = new Map(
    input.rules.map((rule) => [key(rule.code, rule.version), rule]),
  );
  const dependencies = new Map<string, RebuildDependency[]>();
  for (const dependency of input.dependencies)
    dependencies.set(dependency.successorObligationId, [
      ...(dependencies.get(dependency.successorObligationId) ?? []),
      dependency,
    ]);
  const exceptions = new Map<string, RebuildException[]>();
  for (const exception of input.exceptions)
    exceptions.set(exception.obligationId, [
      ...(exceptions.get(exception.obligationId) ?? []),
      exception,
    ]);
  const pending = new Map(
    input.obligations.map((obligation) => [obligation.id, obligation]),
  );
  const findings = new Map<string, RebuildFinding>();

  const blocked = (
    obligation: RebuildObligation,
    reasons: string[],
    dependencyId: string | null = null,
  ): RebuildFinding => ({
    obligationId: obligation.id,
    result: "blocked",
    actualDueDate: date(obligation.dueAt),
    expectedDueDate: null,
    actualStatus: obligation.status,
    expectedStatus: null,
    ruleCode: obligation.ruleCode,
    ruleVersion: obligation.ruleVersion,
    dependencyId,
    exceptionIds: (exceptions.get(obligation.id) ?? [])
      .map((item) => item.id)
      .sort(),
    reasons,
    calculation: [],
  });

  while (pending.size) {
    let progressed = false;
    for (const [id, obligation] of [...pending]) {
      const edges = dependencies.get(id) ?? [];
      if (edges.length > 1) {
        findings.set(
          id,
          blocked(obligation, [
            "Multiple predecessor dependencies make the rebuild ambiguous.",
          ]),
        );
        pending.delete(id);
        progressed = true;
        continue;
      }
      const dependency = edges[0];
      if (dependency && !findings.has(dependency.predecessorObligationId))
        continue;
      const rule = rules.get(key(obligation.ruleCode, obligation.ruleVersion));
      const reasons: string[] = [];
      if (!rule)
        reasons.push(
          "The exact referenced governance rule version is missing.",
        );
      else {
        if (
          rule.id !== obligation.ruleId ||
          rule.authorityCitation !== obligation.authorityCitation
        )
          reasons.push(
            "The stored rule identity or authority citation differs from the immutable rule version.",
          );
        if (date(rule.effectiveAt) > input.asOfDate)
          reasons.push("The rule was not effective on the rebuild date.");
        if (date(rule.reviewBy) < input.asOfDate)
          reasons.push("The rule review date has expired.");
        if (rule.contentStatus === "pending_attorney_review")
          reasons.push("The rule is still pending attorney review.");
        if (
          rule.contentStatus === "attorney_approved" &&
          (!rule.reviewedBy || !rule.reviewedAt)
        )
          reasons.push("Attorney-approved content lacks reviewer evidence.");
      }
      const related = exceptions.get(id) ?? [];
      if (related.some((item) => item.status === "requested"))
        reasons.push("An exception request is still awaiting decision.");
      const approved = related.filter((item) => item.status === "approved");
      if (approved.length > 1)
        reasons.push(
          "Multiple approved exceptions make the expected obligation state ambiguous.",
        );
      if (dependency) {
        const predecessor = findings.get(dependency.predecessorObligationId);
        if (!predecessor) continue;
        if (!predecessor.expectedDueDate)
          reasons.push(
            "The predecessor could not produce a deterministic expected due date.",
          );
      }
      if (reasons.length || !rule) {
        findings.set(id, blocked(obligation, reasons, dependency?.id ?? null));
        pending.delete(id);
        progressed = true;
        continue;
      }

      let expectedDueDate: string;
      let calculation: string[];
      if (dependency) {
        const predecessor = findings.get(dependency.predecessorObligationId)!;
        const result = calculateDependentDeadline(
          predecessor.expectedDueDate!,
          dependency.offsetBusinessDays,
          dependency.relationType,
          input.holidays,
        );
        expectedDueDate = result.dueDate;
        calculation = result.trace;
      } else {
        const result = calculateDeadline(
          date(obligation.triggerAt),
          {
            code: rule.code,
            version: rule.version,
            authorityType: rule.authorityType,
            authorityCitation: rule.authorityCitation,
            baseDays: rule.businessDays,
            dayKind: "business",
            rollConvention: "next_business_day",
            effectiveDate: date(rule.effectiveAt),
            reviewDate: date(rule.reviewBy),
          },
          input.holidays,
        );
        expectedDueDate = result.dueDate;
        calculation = result.trace;
      }
      const exception = approved[0];
      let expectedStatus = obligation.status;
      if (
        exception?.exceptionType === "due_date_exception" &&
        exception.proposedDueAt
      ) {
        expectedDueDate = date(exception.proposedDueAt);
        calculation = [
          ...calculation,
          `Approved exception ${exception.id} overrides due date to ${expectedDueDate}`,
        ];
      }
      if (exception?.exceptionType === "waiver") expectedStatus = "waived";
      const mismatch: string[] = [];
      if (date(obligation.dueAt) !== expectedDueDate)
        mismatch.push(
          `Stored due date ${date(obligation.dueAt)} differs from rebuilt date ${expectedDueDate}.`,
        );
      if (obligation.status !== expectedStatus)
        mismatch.push(
          `Stored status ${obligation.status} differs from rebuilt status ${expectedStatus}.`,
        );
      findings.set(id, {
        obligationId: id,
        result: mismatch.length ? "drifted" : "matched",
        actualDueDate: date(obligation.dueAt),
        expectedDueDate,
        actualStatus: obligation.status,
        expectedStatus,
        ruleCode: obligation.ruleCode,
        ruleVersion: obligation.ruleVersion,
        dependencyId: dependency?.id ?? null,
        exceptionIds: related.map((item) => item.id).sort(),
        reasons: mismatch,
        calculation,
      });
      pending.delete(id);
      progressed = true;
    }
    if (!progressed) {
      for (const obligation of pending.values())
        findings.set(
          obligation.id,
          blocked(obligation, [
            "Dependency cycle or missing predecessor prevents deterministic rebuilding.",
          ]),
        );
      pending.clear();
    }
  }
  const ordered = [...findings.values()].sort((a, b) =>
    a.obligationId.localeCompare(b.obligationId),
  );
  const matchedCount = ordered.filter(
    (item) => item.result === "matched",
  ).length;
  const driftedCount = ordered.filter(
    (item) => item.result === "drifted",
  ).length;
  const blockedCount = ordered.filter(
    (item) => item.result === "blocked",
  ).length;
  return {
    outcome: blockedCount ? "blocked" : driftedCount ? "exceptions" : "matched",
    findings: ordered,
    matchedCount,
    driftedCount,
    blockedCount,
  };
}

export function decideObligationRebuild(input: {
  context: TenantContext;
  raw: unknown;
  current?: {
    id: string;
    status: "pending_review" | "reviewed";
    outcome: "matched" | "exceptions" | "blocked";
    revision: number;
  } | null;
  result?: RebuildResult | null;
}) {
  const command = obligationRebuildCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId);
  requireRole(
    input.context,
    command.action === "review_rebuild"
      ? ["partner"]
      : ["partner", "docketing_specialist"],
  );
  if (command.action === "review_rebuild") {
    if (
      !input.current ||
      input.current.id !== command.runId ||
      input.current.status !== "pending_review" ||
      input.current.revision !== command.expectedRevision
    )
      throw new Error("Rebuild review changed; refresh before retrying");
    if (command.outcome === "certified" && input.current.outcome !== "matched")
      throw new Error("Only a fully matched rebuild can be certified");
    if (
      command.outcome === "exceptions_noted" &&
      input.current.outcome === "matched"
    )
      throw new Error("A matched rebuild must be certified");
  } else if (!input.result) throw new Error("Rebuild calculation is required");
  const counts = input.result
    ? {
        matchedCount: input.result.matchedCount,
        driftedCount: input.result.driftedCount,
        blockedCount: input.result.blockedCount,
      }
    : {};
  return {
    command,
    event: createEvent({
      eventType: `obligation_rebuild.${command.action}`,
      tenantId: command.tenantId,
      aggregateType: "obligation_rebuild",
      aggregateId: command.runId,
      matterId: command.matterId,
      actorId: input.context.userId,
      correlationId: command.idempotencyKey,
      idempotencyKey: command.idempotencyKey,
      source: "athena.web",
      visibility: "internal",
      retentionPolicy: "matter-lifecycle-plus-firm-retention",
      payload: {
        action: command.action,
        humanAuthorized: true,
        contentStatus: "synthetic_sandbox",
        californiaLegalContentApproved: false,
        ...counts,
      },
    }),
  };
}
