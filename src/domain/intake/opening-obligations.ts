import {
  calculateDeadline,
  type DeadlineRule,
} from "@/domain/governance/deadline";

export const OPENING_RULE_CODES = [
  "synthetic-opening-assignment-acknowledgment",
  "synthetic-opening-initial-report",
] as const;

export type OpeningRule = {
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

export type OpeningObligationPlan = {
  id: string;
  ruleId: string;
  ruleCode: string;
  ruleVersion: number;
  authorityCitation: string;
  title: string;
  requirement: string;
  triggerDate: string;
  dueDate: string;
  ownerId: string;
  calculation: string[];
};

const definitions: Record<
  (typeof OPENING_RULE_CODES)[number],
  { title: string; requirement: string }
> = {
  "synthetic-opening-assignment-acknowledgment": {
    title: "Acknowledge new matter assignment",
    requirement:
      "Assigned attorney records review of the preserved referral, conflict disposition, and initial ownership.",
  },
  "synthetic-opening-initial-report": {
    title: "Prepare initial client report",
    requirement:
      "Assigned attorney prepares the synthetic initial report after verifying matter identity and source-backed opening facts.",
  },
};

export function planOpeningObligations(input: {
  tenantId: string;
  matterId: string;
  candidateId: string;
  ownerId: string;
  triggerDate: string;
  asOfDate: string;
  rules: OpeningRule[];
  holidays: Set<string>;
  syntheticDataAcknowledged: boolean;
}) {
  if (!input.syntheticDataAcknowledged)
    throw new Error("Synthetic opening rules require explicit acknowledgement");
  const byCode = new Map(input.rules.map((rule) => [rule.code, rule]));
  return OPENING_RULE_CODES.map((code) => {
    const rule = byCode.get(code);
    if (!rule) throw new Error(`Required opening rule ${code} is missing`);
    if (rule.contentStatus === "pending_attorney_review")
      throw new Error(`Opening rule ${code} is pending attorney review`);
    if (
      rule.contentStatus === "attorney_approved" &&
      (!rule.reviewedBy || !rule.reviewedAt)
    )
      throw new Error(`Opening rule ${code} lacks attorney review evidence`);
    const effectiveDate = day(rule.effectiveAt);
    const reviewDate = day(rule.reviewBy);
    if (effectiveDate > input.triggerDate)
      throw new Error(
        `Opening rule ${code} was not effective on the trigger date`,
      );
    if (reviewDate < input.asOfDate)
      throw new Error(`Opening rule ${code} is past its review date`);
    const deadline = calculateDeadline(
      input.triggerDate,
      {
        code: rule.code,
        version: rule.version,
        authorityType: rule.authorityType,
        authorityCitation: rule.authorityCitation,
        baseDays: rule.businessDays,
        dayKind: "business",
        rollConvention: "next_business_day",
        effectiveDate,
        reviewDate,
      },
      input.holidays,
    );
    return {
      id: `opening-${input.candidateId}-${rule.code}-v${rule.version}`,
      ruleId: rule.id,
      ruleCode: rule.code,
      ruleVersion: rule.version,
      authorityCitation: rule.authorityCitation,
      title: definitions[code].title,
      requirement: definitions[code].requirement,
      triggerDate: input.triggerDate,
      dueDate: deadline.dueDate,
      ownerId: input.ownerId,
      calculation: [
        `Matter opening source ${input.candidateId}`,
        ...deadline.trace,
      ],
    } satisfies OpeningObligationPlan;
  });
}

function day(value: Date) {
  return value.toISOString().slice(0, 10);
}
