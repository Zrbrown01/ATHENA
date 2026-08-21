import { z } from "zod";
import { createEvent } from "@/platform/events";
import { AuthorizationError, requireRole, type TenantContext } from "@/platform/tenant-context";
const id = z.string().min(3).max(160), detail = z.string().trim().min(12).max(2000);
export const scaleAuditCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("run_local_benchmark"), tenantId: z.string().min(1), assessmentId: id, workloadProfile: detail, maxPageSize: z.number().int().min(10).max(100), outboxBatchLimit: z.number().int().min(1).max(100), archiveByteLimit: z.number().int().min(1048576).max(536870912), archiveRowLimit: z.number().int().min(1000).max(250000), idempotencyKey: z.string().min(8).max(200), syntheticAcknowledged: z.literal(true) }),
  z.object({ action: z.literal("review_capacity"), tenantId: z.string().min(1), assessmentId: id, expectedRevision: z.number().int().positive(), outcome: z.enum(["accept_with_gaps", "reject"]), reason: detail, idempotencyKey: z.string().min(8).max(200) }),
]);
export type ScaleAuditCommand = z.infer<typeof scaleAuditCommand>;
export type ScaleMeasurement = { metricCode: string; targetMs: number; measuredMs: number | null; status: "pass" | "fail" | "not_measured"; method: string; sampleSize: number; limitation: string | null };
export type ScaleAssessmentState = { id: string; status: "measured" | "reviewed_with_gaps" | "rejected"; revision: number; blockingGaps: string[] };
export function decideScaleAudit(input: { context: TenantContext; raw: unknown; current?: ScaleAssessmentState | null; measurements?: ScaleMeasurement[] }) {
  const command = scaleAuditCommand.parse(input.raw); if (command.tenantId !== input.context.tenantId) throw new AuthorizationError(); requireRole(input.context, ["partner", "firm_administrator"]);
  let fromStatus = "not_created", toStatus: ScaleAssessmentState["status"] = "measured";
  if (command.action === "run_local_benchmark") { if (input.current) throw new Error("Scale assessment identity already exists"); if (!input.measurements?.length) throw new Error("Benchmark measurements are required"); }
  else { const current = input.current; if (!current || current.revision !== command.expectedRevision) throw new Error("Scale assessment changed; refresh before retrying"); if (current.status !== "measured") throw new Error(`review_capacity is not allowed from ${current.status}`); if (command.outcome === "accept_with_gaps" && current.blockingGaps.length === 0) throw new Error("Conditional review requires explicit blocking gaps"); fromStatus = current.status; toStatus = command.outcome === "reject" ? "rejected" : "reviewed_with_gaps"; }
  return { command, fromStatus, toStatus, event: createEvent({ eventType: `scale.${command.action}`, tenantId: command.tenantId, aggregateType: "scale_assessment", aggregateId: command.assessmentId, actorId: input.context.userId, correlationId: command.assessmentId, causationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "internal", retentionPolicy: "security-assurance", payload: { action: command.action, fromStatus, toStatus, productionReady: false, representativeLoadProven: false, independentValidation: false, humanAuthorized: command.action === "review_capacity" } }) };
}
export function measureLocalPerformance(now: () => number = () => performance.now()): ScaleMeasurement[] {
  const rows = Array.from({ length: 25000 }, (_, i) => ({ id: `matter-${i}`, title: `Synthetic matter ${i}`, status: i % 3 ? "open" : "closed", owner: `user-${i % 25}` }));
  const benchmark = (metricCode: string, targetMs: number, method: string, operation: () => unknown, sampleSize = 40): ScaleMeasurement => { const samples: number[] = []; for (let i = 0; i < sampleSize; i++) { const start = now(); operation(); samples.push(now() - start); } samples.sort((a, b) => a - b); const measuredMs = Math.ceil(samples[Math.max(0, Math.ceil(samples.length * 0.95) - 1)]); return { metricCode, targetMs, measuredMs, status: measuredMs <= targetMs ? "pass" : "fail", method, sampleSize, limitation: "Local in-process synthetic algorithm benchmark; excludes network, production database, browser rendering, concurrency, and provider latency." }; };
  return [
    benchmark("known_matter_search", 1000, "25k-row exact synthetic lookup p95", () => rows.find((row) => row.id === "matter-24999")),
    benchmark("filter_update", 300, "25k-row status/owner filter p95", () => rows.filter((row) => row.status === "open" && row.owner === "user-7")),
    benchmark("context_panel", 200, "500-field structured context serialization p95", () => JSON.stringify(rows.slice(0, 500))),
    benchmark("common_matter_view", 2000, "5k-row matter projection serialization p95", () => JSON.stringify(rows.slice(0, 5000))),
    { metricCode: "event_availability", targetMs: 5000, measuredMs: null, status: "not_measured", method: "Requires deployed producer-to-consumer timing under representative load", sampleSize: 0, limitation: "Sites cron and external consumers are not connected." },
    { metricCode: "background_job_ack", targetMs: 500, measuredMs: null, status: "not_measured", method: "Requires deployed queue acknowledgment timing under representative load", sampleSize: 0, limitation: "No production queue/provider load test exists." },
  ];
}
export const scaleBlockingGaps = ["representative_multi_user_load", "production_database_query_plan", "browser_render_and_network", "edge_waf_throttling", "event_consumer_latency", "background_queue_acknowledgment", "streaming_archive_memory", "independent_performance_validation"];
