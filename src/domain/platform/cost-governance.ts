import { z } from "zod";
import { createEvent } from "@/platform/events";
import { AuthorizationError, authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";

export const costCategories = ["storage", "ocr", "ai", "email_processing", "document_processing", "noted", "verbatim", "telephony", "support", "migration", "implementation"] as const;
export const costUnits = ["gibibyte_month", "page", "token_1k", "message", "document", "minute", "hour", "record"] as const;
const id = z.string().min(3).max(160), detail = z.string().trim().min(12).max(2000), revision = z.number().int().positive();
const rateItem = z.object({ category: z.enum(costCategories), unit: z.enum(costUnits), unitRateMicros: z.number().int().nonnegative().max(1_000_000_000) });
const base = { tenantId: z.string().min(1), rateCardId: id, idempotencyKey: z.string().min(8).max(200) };

export const costGovernanceCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_rate_card"), ...base, name: z.string().trim().min(3).max(160), currency: z.literal("USD"), sourceType: z.enum(["synthetic_estimate", "provider_contract", "client_agreement"]), sourceRef: detail, effectiveAt: z.string().datetime(), rates: z.array(rateItem).min(1).max(costCategories.length), syntheticAcknowledged: z.boolean() }),
  z.object({ action: z.literal("approve_rate_card"), ...base, expectedRevision: revision, reason: detail }),
  z.object({ action: z.literal("record_usage"), ...base, usageEntryId: id, matterId: id.nullable(), workflowId: id, category: z.enum(costCategories), unit: z.enum(costUnits), quantity: z.number().int().positive().max(1_000_000_000), pricingState: z.enum(["estimated", "provider_verified", "not_billable"]), providerName: z.string().trim().min(2).max(160), sourceType: z.enum(["athena_measured", "human_verified_provider", "manual_allocation"]), sourceId: id, evidence: detail, occurredAt: z.string().datetime() }),
]);
export type CostGovernanceCommand = z.infer<typeof costGovernanceCommand>;
export type CostRateCardState = { id: string; status: "draft" | "approved" | "superseded"; revision: number; sourceType: "synthetic_estimate" | "provider_contract" | "client_agreement" };
export type CostRateItemState = { category: string; unit: string; unitRateMicros: number };

export function calculateCostMicros(quantity: number, unitRateMicros: number) {
  const result = quantity * unitRateMicros;
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("Usage cost exceeds safe integer accounting bounds");
  return result;
}

export function decideCostGovernance(input: { context: TenantContext; raw: unknown; rateCard?: CostRateCardState | null; rates?: CostRateItemState[]; usageExists?: boolean }) {
  const command = costGovernanceCommand.parse(input.raw);
  if (command.tenantId !== input.context.tenantId) throw new AuthorizationError();
  requireRole(input.context, ["partner", "firm_admin", "billing_specialist"]);
  let fromStatus = "not_created", toStatus = "draft", unitRateMicros: number | null = null, costMicros: number | null = null;
  if (command.action === "create_rate_card") {
    if (input.rateCard) throw new Error("Rate card identity already exists");
    const keys = command.rates.map((rate) => `${rate.category}:${rate.unit}`);
    if (new Set(keys).size !== keys.length) throw new Error("Rate card category and unit pairs must be unique");
    if (command.sourceType === "synthetic_estimate" && !command.syntheticAcknowledged) throw new Error("Synthetic rate cards require explicit acknowledgement");
    if (command.sourceType !== "synthetic_estimate" && command.syntheticAcknowledged) throw new Error("Contract rate evidence cannot be labeled synthetic");
  } else {
    const card = input.rateCard;
    if (!card || card.id !== command.rateCardId) throw new Error("Rate card does not exist in this tenant scope");
    fromStatus = card.status;
    if (command.action === "approve_rate_card") {
      if (card.revision !== command.expectedRevision) throw new Error("Rate card changed; refresh before retrying");
      if (card.status !== "draft") throw new Error("Only a draft rate card can be approved");
      requireRole(input.context, ["partner", "firm_admin"]);
      toStatus = "approved";
    } else {
      if (card.status !== "approved") throw new Error("Usage requires an approved rate card");
      if (command.matterId) authorizeMatter(input.context, command.tenantId, command.matterId);
      if (input.usageExists) throw new Error("Usage entry identity already exists");
      const rate = input.rates?.find((item) => item.category === command.category && item.unit === command.unit);
      if (!rate) throw new Error("Approved rate card does not contain this category and unit");
      if (command.pricingState === "provider_verified" && (command.sourceType !== "human_verified_provider" || command.providerName.toLowerCase() === "athena")) throw new Error("Provider-verified pricing requires human-verified external evidence");
      if (card.sourceType === "synthetic_estimate" && command.pricingState === "provider_verified") throw new Error("Synthetic rate cards cannot produce provider-verified cost");
      unitRateMicros = command.pricingState === "not_billable" ? 0 : rate.unitRateMicros;
      costMicros = calculateCostMicros(command.quantity, unitRateMicros);
      toStatus = command.pricingState;
    }
  }
  const aggregateId = command.action === "record_usage" ? command.usageEntryId : command.rateCardId;
  return { command, fromStatus, toStatus, unitRateMicros, costMicros, event: createEvent({ eventType: `cost.${command.action}`, tenantId: command.tenantId, aggregateType: command.action === "record_usage" ? "usage_cost_entry" : "cost_rate_card", aggregateId, matterId: command.action === "record_usage" ? command.matterId ?? undefined : undefined, actorId: input.context.userId, correlationId: command.rateCardId, causationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "internal", retentionPolicy: "financial-seven-years", payload: { action: command.action, fromStatus, toStatus, category: command.action === "record_usage" ? command.category : null, quantity: command.action === "record_usage" ? command.quantity : null, unitRateMicros, costMicros, providerVerified: command.action === "record_usage" && command.pricingState === "provider_verified", humanAuthorized: true } }) };
}
