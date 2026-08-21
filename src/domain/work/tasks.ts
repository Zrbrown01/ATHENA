import { z } from "zod";
import { createEvent } from "@/platform/events";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";

const base = { tenantId: z.string().min(1), matterId: z.string().min(1), taskId: z.string().min(3).max(120), idempotencyKey: z.string().min(8).max(200) };
export const taskCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), ...base, title: z.string().trim().min(5).max(240), taskType: z.string().trim().min(3).max(80), priority: z.enum(["critical", "high", "normal", "low"]), ownerId: z.string().min(3), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), dependsOnTaskIds: z.array(z.string().min(3)).max(20).default([]) }),
  z.object({ action: z.literal("start"), ...base, expectedRevision: z.number().int().positive() }),
  z.object({ action: z.literal("block"), ...base, expectedRevision: z.number().int().positive(), reason: z.string().trim().min(12).max(1000) }),
  z.object({ action: z.literal("unblock"), ...base, expectedRevision: z.number().int().positive(), reason: z.string().trim().min(12).max(1000) }),
  z.object({ action: z.literal("reassign"), ...base, expectedRevision: z.number().int().positive(), ownerId: z.string().min(3), reason: z.string().trim().min(8).max(1000) }),
  z.object({ action: z.literal("complete"), ...base, expectedRevision: z.number().int().positive(), evidence: z.string().trim().min(12).max(1000) }),
  z.object({ action: z.literal("cancel"), ...base, expectedRevision: z.number().int().positive(), reason: z.string().trim().min(12).max(1000) }),
]);
export type TaskCommand = z.infer<typeof taskCommand>;
export type TaskState = { id: string; status: "open" | "in_progress" | "blocked" | "completed" | "cancelled"; revision: number; ownerId: string };

const eventSuffix = { create: "created", start: "started", block: "blocked", unblock: "unblocked", reassign: "reassigned", complete: "completed", cancel: "cancelled" } as const;
export function decideTask(input: { context: TenantContext; raw: unknown; current?: TaskState | null; incompleteDependencyCount?: number }) {
  const command = taskCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId);
  requireRole(input.context, ["attorney", "partner", "paralegal", "legal_assistant", "docketing"]);
  let fromStatus = "not_created", toStatus: TaskState["status"] = "open";
  if (command.action !== "create") {
    const current = input.current;
    if (!current || current.id !== command.taskId) throw new Error("Task does not exist in this matter scope");
    if (current.revision !== command.expectedRevision) throw new Error("Task changed; refresh before retrying");
    if (["completed", "cancelled"].includes(current.status)) throw new Error("Task is terminal");
    fromStatus = current.status;
    if (command.action === "start") { if ((input.incompleteDependencyCount ?? 0) > 0) throw new Error("Task cannot start until dependencies are complete"); toStatus = "in_progress"; }
    else if (command.action === "block") toStatus = "blocked";
    else if (command.action === "unblock") { if (current.status !== "blocked") throw new Error("Only a blocked task can be unblocked"); toStatus = "open"; }
    else if (command.action === "complete") { if (current.status === "blocked") throw new Error("A blocked task cannot be completed"); if ((input.incompleteDependencyCount ?? 0) > 0) throw new Error("Task cannot complete until dependencies are complete"); toStatus = "completed"; }
    else if (command.action === "cancel") toStatus = "cancelled";
    else toStatus = current.status;
  }
  return { command, fromStatus, toStatus, event: createEvent({ eventType: `task.${eventSuffix[command.action]}`, tenantId: command.tenantId, aggregateType: "task", aggregateId: command.taskId, matterId: command.matterId, actorId: input.context.userId, correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "internal", retentionPolicy: "matter-lifecycle-plus-firm-retention", payload: { action: command.action, fromStatus, toStatus, incompleteDependencyCount: input.incompleteDependencyCount ?? 0, humanAuthorized: true } }) };
}
