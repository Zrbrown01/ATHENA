import { PILOT_TENANT_ID } from "./pilot-context";
import { publishReadyInternalEvents, reconcileInternalOutbox } from "./outbox-persistence";

export async function runScheduledInternalDelivery(input: { trigger: string; scheduledAt?: Date }) {
  const now = input.scheduledAt ?? new Date();
  const workerId = `internal-scheduler:${now.getTime()}`;
  const delivery = await publishReadyInternalEvents(PILOT_TENANT_ID, workerId, now, 100);
  const reconciliation = await reconcileInternalOutbox(PILOT_TENANT_ID, input.trigger, now);
  return { providerMode: "athena_native", externalDelivery: false, delivery, reconciliation };
}
