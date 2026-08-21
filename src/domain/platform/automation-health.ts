export type AutomationHeartbeat = {
  trigger: string;
  scheduledFor: Date;
  finishedAt: Date;
  outcome: "succeeded" | "failed";
  detail: string;
};

export function assessAutomationHealth(
  heartbeat: AutomationHeartbeat | null,
  now = new Date(),
  maximumAgeMs = 10 * 60_000,
) {
  if (!heartbeat) return {
    status: "not_connected" as const,
    lastScheduledFor: null,
    lastFinishedAt: null,
    detail: "No production cron heartbeat has been recorded.",
  };
  if (heartbeat.outcome === "failed") return {
    status: "failed" as const,
    lastScheduledFor: heartbeat.scheduledFor.toISOString(),
    lastFinishedAt: heartbeat.finishedAt.toISOString(),
    detail: heartbeat.detail,
  };
  if (now.getTime() - heartbeat.scheduledFor.getTime() > maximumAgeMs) return {
    status: "stale" as const,
    lastScheduledFor: heartbeat.scheduledFor.toISOString(),
    lastFinishedAt: heartbeat.finishedAt.toISOString(),
    detail: "The last successful production cron heartbeat is older than the allowed interval.",
  };
  return {
    status: "healthy" as const,
    lastScheduledFor: heartbeat.scheduledFor.toISOString(),
    lastFinishedAt: heartbeat.finishedAt.toISOString(),
    detail: heartbeat.detail,
  };
}
