export interface DeadlineRule {
  code: string;
  version: number;
  authorityType: "statute" | "regulation" | "court_rule" | "client_policy" | "firm_policy";
  authorityCitation: string;
  baseDays: number;
  dayKind: "calendar" | "business";
  rollConvention: "next_business_day";
  effectiveDate: string;
  reviewDate: string;
}

export interface DeadlineResult {
  dueDate: string;
  ruleCode: string;
  ruleVersion: number;
  authorityCitation: string;
  trace: string[];
}

export function calculateDeadline(triggerDate: string, rule: DeadlineRule, holidays: Set<string>): DeadlineResult {
  validateDateOnly(triggerDate);
  if (!Number.isInteger(rule.baseDays) || rule.baseDays < 0) throw new Error("Deadline days must be a non-negative integer");
  let date = parseDateOnly(triggerDate);
  const trace = [`Trigger ${triggerDate}`, `${rule.code}@${rule.version}: add ${rule.baseDays} ${rule.dayKind} days`];
  date = rule.dayKind === "business" ? addBusinessDays(date, rule.baseDays, holidays) : addCalendarDays(date, rule.baseDays);
  if (!isBusinessDay(date, holidays)) {
    const beforeRoll = formatDateOnly(date);
    do date = addCalendarDays(date, 1); while (!isBusinessDay(date, holidays));
    trace.push(`Rolled ${beforeRoll} to the next business day`);
  }
  return { dueDate: formatDateOnly(date), ruleCode: rule.code, ruleVersion: rule.version, authorityCitation: rule.authorityCitation, trace };
}

export function isBusinessDay(date: Date, holidays: Set<string>) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6 && !holidays.has(formatDateOnly(date));
}

export function calculateDependentDeadline(
  predecessorDueDate: string,
  offsetBusinessDays: number,
  relationType: "preparation_before" | "follow_up_after",
  holidays: Set<string>,
) {
  validateDateOnly(predecessorDueDate);
  if (!Number.isInteger(offsetBusinessDays) || offsetBusinessDays < 1)
    throw new Error("Dependency offset must be a positive integer");
  const direction = relationType === "preparation_before" ? -1 : 1;
  let date = parseDateOnly(predecessorDueDate);
  let remaining = offsetBusinessDays;
  while (remaining > 0) {
    date = addCalendarDays(date, direction);
    if (isBusinessDay(date, holidays)) remaining -= 1;
  }
  return {
    dueDate: formatDateOnly(date),
    trace: [
      `Predecessor due ${predecessorDueDate}`,
      `${relationType}: ${offsetBusinessDays} business days`,
      `Dependent due ${formatDateOnly(date)}`,
    ],
  };
}

export function evaluateDeadlineEscalation(
  dueDate: string,
  asOfDate: string,
  holidays: Set<string>,
) {
  validateDateOnly(dueDate);
  validateDateOnly(asOfDate);
  const due = parseDateOnly(dueDate);
  const asOf = parseDateOnly(asOfDate);
  if (asOf.getTime() > due.getTime())
    return {
      level: "breached" as const,
      businessDaysRemaining: -countBusinessDays(due, asOf, holidays),
      basis: `Open obligation passed its due date ${dueDate}; evaluated ${asOfDate}.`,
    };
  const remaining = countBusinessDays(asOf, due, holidays);
  if (remaining > 3) return null;
  return {
    level: remaining <= 1 ? ("critical" as const) : ("attention" as const),
    businessDaysRemaining: remaining,
    basis: `Open obligation has ${remaining} business days remaining; due ${dueDate}, evaluated ${asOfDate}.`,
  };
}

function addBusinessDays(date: Date, days: number, holidays: Set<string>) {
  let result = date;
  let remaining = days;
  while (remaining > 0) {
    result = addCalendarDays(result, 1);
    if (isBusinessDay(result, holidays)) remaining -= 1;
  }
  return result;
}

function countBusinessDays(start: Date, end: Date, holidays: Set<string>) {
  let cursor = start;
  let count = 0;
  while (cursor.getTime() < end.getTime()) {
    cursor = addCalendarDays(cursor, 1);
    if (isBusinessDay(cursor, holidays)) count += 1;
  }
  return count;
}

function addCalendarDays(date: Date, days: number) { return new Date(date.getTime() + days * 86_400_000); }
function parseDateOnly(value: string) { return new Date(`${value}T12:00:00.000Z`); }
function formatDateOnly(value: Date) { return value.toISOString().slice(0, 10); }
function validateDateOnly(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parseDateOnly(value).getTime())) throw new Error("A valid YYYY-MM-DD trigger date is required"); }
