import { createId } from "@paralleldrive/cuid2";

export interface EventEnvelope<TPayload extends Record<string, unknown>> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  matterId?: string;
  actorId: string;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  idempotencyKey: string;
  source: string;
  visibility: "internal" | "client" | "restricted";
  retentionPolicy: string;
  payload: TPayload;
}

export function createEvent<TPayload extends Record<string, unknown>>(
  input: Omit<EventEnvelope<TPayload>, "eventId" | "eventVersion" | "occurredAt" | "retentionPolicy"> & { retentionPolicy?: string },
): EventEnvelope<TPayload> {
  return {
    ...input,
    retentionPolicy: input.retentionPolicy ?? "firm-default",
    eventId: createId(),
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
  };
}
