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

function addBusinessDays(date: Date, days: number, holidays: Set<string>) {
  let result = date;
  let remaining = days;
  while (remaining > 0) {
    result = addCalendarDays(result, 1);
    if (isBusinessDay(result, holidays)) remaining -= 1;
  }
  return result;
}

function addCalendarDays(date: Date, days: number) { return new Date(date.getTime() + days * 86_400_000); }
function parseDateOnly(value: string) { return new Date(`${value}T12:00:00.000Z`); }
function formatDateOnly(value: Date) { return value.toISOString().slice(0, 10); }
function validateDateOnly(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parseDateOnly(value).getTime())) throw new Error("A valid YYYY-MM-DD trigger date is required"); }
