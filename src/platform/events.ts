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
  payload: TPayload;
}

export function createEvent<TPayload extends Record<string, unknown>>(
  input: Omit<EventEnvelope<TPayload>, "eventId" | "eventVersion" | "occurredAt">,
): EventEnvelope<TPayload> {
  return {
    ...input,
    eventId: createId(),
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
  };
}
