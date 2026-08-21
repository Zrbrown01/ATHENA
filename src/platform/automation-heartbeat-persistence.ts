import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, like } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { automationExecutionHeartbeats } from "../../db/schema";

const subsystem = "internal_outbox";

export async function recordInternalAutomationHeartbeat(input: {
  tenantId: string;
  trigger: string;
  scheduledFor: Date;
  startedAt: Date;
  outcome: "succeeded" | "failed";
  detail: string;
}) {
  const finishedAt = new Date();
  await getPreviewDb().insert(automationExecutionHeartbeats).values({
    id: createId(), tenantId: input.tenantId, subsystem, trigger: input.trigger,
    scheduledFor: input.scheduledFor, startedAt: input.startedAt, finishedAt,
    outcome: input.outcome, detail: input.detail,
  });
  return { finishedAt };
}

export async function readLatestCronAutomationHeartbeat(tenantId: string) {
  const [row] = await getPreviewDb().select().from(automationExecutionHeartbeats).where(and(
    eq(automationExecutionHeartbeats.tenantId, tenantId),
    eq(automationExecutionHeartbeats.subsystem, subsystem),
    like(automationExecutionHeartbeats.trigger, "cron:%"),
  )).orderBy(desc(automationExecutionHeartbeats.finishedAt)).limit(1);
  return row ?? null;
}
