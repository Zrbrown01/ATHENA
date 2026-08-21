import { describe, expect, it } from "vitest";
import { decideTaskRecurrence, planRecurrenceWindow, recurrenceNominalDates, type TaskRecurrenceState } from "./task-recurrence";

const context = { tenantId: "tenant-golden", userId: "user-a", roles: ["attorney" as const], matterAccess: new Set(["matter-golden-001"]) };
const series: TaskRecurrenceState = { id: "series-1", status: "active", revision: 3, cadence: "monthly", interval: 1, dayOfMonth: 31, startsOn: new Date("2026-01-31T12:00:00.000Z"), endsOn: null, occurrenceLimit: 24, materializedCount: 0, lastMaterializedThrough: null, title: "Prepare monthly client status report", taskType: "client_reporting", priority: "high", ownerId: "user-a" };
const base = { tenantId: "tenant-golden", matterId: "matter-golden-001", seriesId: series.id, idempotencyKey: "recurrence-test-001" };

describe("task recurrence", () => {
  it("clamps monthly day 31 to the last calendar day", () => expect(recurrenceNominalDates(series, "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]));
  it("stops at an approved end date even when the requested window is later", () => expect(recurrenceNominalDates({ ...series, endsOn: new Date("2026-02-28T12:00:00.000Z") }, "2027-12-31")).toEqual(["2026-01-31", "2026-02-28"]));
  it("anchors weekly intervals on the approved start date", () => expect(recurrenceNominalDates({ ...series, cadence: "weekly", interval: 2, dayOfMonth: null, startsOn: new Date("2026-09-01T12:00:00.000Z"), occurrenceLimit: 3 }, "2026-10-31")).toEqual(["2026-09-01", "2026-09-15", "2026-09-29"]));
  it("materializes no more than twelve occurrences per command", () => expect(planRecurrenceWindow(series, "2027-12-31", [])).toHaveLength(12));
  it("applies move and skip exceptions without losing nominal identity", () => {
    const planned = planRecurrenceWindow({ ...series, occurrenceLimit: 3 }, "2026-03-31", [{ nominalDueOn: new Date("2026-02-28T12:00:00.000Z"), action: "move", movedDueOn: new Date("2026-03-02T12:00:00.000Z") }, { nominalDueOn: new Date("2026-03-31T12:00:00.000Z"), action: "skip", movedDueOn: null }]);
    expect(planned).toMatchObject([{ nominalDueOn: "2026-01-31", effectiveDueOn: "2026-01-31", status: "materialized" }, { nominalDueOn: "2026-02-28", effectiveDueOn: "2026-03-02", exceptionAction: "move" }, { nominalDueOn: "2026-03-31", effectiveDueOn: null, status: "skipped" }]);
  });
  it("requires an attorney or partner to activate a draft series", () => expect(() => decideTaskRecurrence({ context: { ...context, roles: ["paralegal"] }, current: { ...series, status: "draft", revision: 1 }, raw: { ...base, action: "activate_series", expectedRevision: 1, approval: "Approved after attorney schedule review." } })).toThrow("authorized legal reviewer"));
  it("rejects stale series revisions and exceptions on materialized dates", () => {
    expect(() => decideTaskRecurrence({ context, current: series, raw: { ...base, action: "materialize_window", expectedRevision: 2, throughDate: "2026-03-31" } })).toThrow("changed");
    expect(() => decideTaskRecurrence({ context, current: { ...series, lastMaterializedThrough: new Date("2026-02-28T12:00:00.000Z") }, raw: { ...base, action: "set_exception", expectedRevision: 3, nominalDueOn: "2026-02-28", exceptionAction: "skip", movedDueOn: null, reason: "Skip this already governed occurrence after review." } })).toThrow("unmaterialized");
  });
});
