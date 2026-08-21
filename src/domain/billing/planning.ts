import { z } from "zod";
import { createEvent } from "@/platform/events";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";
const id = z.string().min(3).max(160), cents = z.number().int().nonnegative(), reason = z.string().trim().min(12).max(1500);
const base = { tenantId: z.string().min(1), matterId: z.string().min(1), budgetId: id, idempotencyKey: z.string().min(8).max(200) };
export const budgetPlanningCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("materialize_fixture_budget"), ...base, title: z.string().min(5).max(240), totalBudgetCents: cents.positive(), effectiveDate: z.iso.date(), phases: z.array(z.object({ id, phaseCode: z.string().min(2).max(40), title: z.string().min(3).max(160), budgetCents: cents.positive() })).min(2).max(12), sandboxAcknowledged: z.literal(true) }).superRefine((value, context) => { if (value.phases.reduce((sum, phase) => sum + phase.budgetCents, 0) !== value.totalBudgetCents) context.addIssue({ code: "custom", path: ["phases"], message: "Phase budgets must reconcile exactly to the total budget" }); }),
  z.object({ action: z.literal("approve_budget"), ...base, expectedRevision: z.number().int().positive(), reason }),
  z.object({ action: z.literal("record_accrual"), ...base, expectedRevision: z.number().int().positive(), accrualId: id, period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), feesCents: cents, expensesCents: cents, sourceRecordIds: z.array(id).min(1).max(30) }),
  z.object({ action: z.literal("snapshot_profitability"), ...base, expectedRevision: z.number().int().positive(), snapshotId: id, asOfDate: z.iso.date(), billedCents: cents, collectedCents: cents, workedValueCents: cents.positive(), directCostCents: cents, sourceRecordIds: z.array(id).min(1).max(30) }).superRefine((value, context) => { if (value.collectedCents > value.billedCents) context.addIssue({ code: "custom", path: ["collectedCents"], message: "Collected amount cannot exceed billed amount" }); }),
]);
export type BudgetPlanningCommand = z.infer<typeof budgetPlanningCommand>;
export type BudgetState = { id: string; status: "draft" | "approved" | "closed"; revision: number; totalBudgetCents: number };
export function calculatePlanning(input: { totalBudgetCents: number; feesCents: number; expensesCents: number; billedCents: number; collectedCents: number; workedValueCents: number; directCostCents: number }) { const totalAccruedCents = input.feesCents + input.expensesCents; return { totalAccruedCents, budgetVarianceCents: input.totalBudgetCents - totalAccruedCents, realizationBasisPoints: Math.round(input.collectedCents * 10_000 / input.workedValueCents), contributionCents: input.collectedCents - input.directCostCents }; }
export function decideBudgetPlanning(input: { context: TenantContext; raw: unknown; budget?: BudgetState | null; targetExists?: boolean }) {
  const command = budgetPlanningCommand.parse(input.raw); authorizeMatter(input.context, command.tenantId, command.matterId); requireRole(input.context, ["attorney", "partner", "billing_specialist"]);
  let fromStatus = "not_created", toStatus = "draft";
  if (command.action === "materialize_fixture_budget") { if (input.targetExists) throw new Error("Budget identity already exists"); }
  else { const budget = input.budget; if (!budget || budget.revision !== command.expectedRevision) throw new Error("Budget changed; refresh before retrying"); if (budget.status === "closed") throw new Error("Closed budgets cannot change"); fromStatus = budget.status;
    if (command.action === "approve_budget") { requireRole(input.context, ["attorney", "partner"]); if (budget.status !== "draft") throw new Error("Only a draft budget can be approved"); toStatus = "approved"; }
    else { if (budget.status !== "approved") throw new Error("Accrual and profitability snapshots require an approved budget"); toStatus = budget.status; }
  }
  return { command, fromStatus, toStatus, event: createEvent({ eventType: `billing_planning.${({ materialize_fixture_budget: "budget_materialized", approve_budget: "budget_approved", record_accrual: "accrual_recorded", snapshot_profitability: "profitability_snapshotted" } as const)[command.action]}`, tenantId: command.tenantId, aggregateType: "matter_budget", aggregateId: command.budgetId, matterId: command.matterId, actorId: input.context.userId, correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "restricted", retentionPolicy: "matter-lifecycle-plus-firm-retention", payload: { action: command.action, fromStatus, toStatus, humanAuthorized: true, integerCentArithmetic: true, accountingProviderConnected: false } }) };
}
