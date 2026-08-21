import { PILOT_TENANT_ID } from "./pilot-context";
import { publishReadyInternalEvents, reconcileInternalOutbox } from "./outbox-persistence";
import { recordInternalAutomationHeartbeat } from "./automation-heartbeat-persistence";

export async function runScheduledInternalDelivery(input: { trigger: string; scheduledAt?: Date }) {
  const now = input.scheduledAt ?? new Date();
  const startedAt = new Date();
  const workerId = `internal-scheduler:${now.getTime()}`;
  try {
    const delivery = await publishReadyInternalEvents(PILOT_TENANT_ID, workerId, now, 100);
    const reconciliation = await reconcileInternalOutbox(PILOT_TENANT_ID, input.trigger, now);
    await recordInternalAutomationHeartbeat({ tenantId: PILOT_TENANT_ID, trigger: input.trigger, scheduledFor: now, startedAt, outcome: "succeeded", detail: `Internal delivery completed; ${delivery.delivered} delivered, ${delivery.deduplicated} deduplicated, ${reconciliation.exceptions} reconciliation exceptions.` });
    return { providerMode: "athena_native", externalDelivery: false, delivery, reconciliation };
  } catch (error) {
    try {
      await recordInternalAutomationHeartbeat({ tenantId: PILOT_TENANT_ID, trigger: input.trigger, scheduledFor: now, startedAt, outcome: "failed", detail: `Internal delivery failed with ${error instanceof Error ? error.name : "UnknownError"}; no legal or client data is stored in this heartbeat.` });
    } catch {
      // Preserve the originating scheduler failure when the health ledger is also unavailable.
    }
    throw error;
  }
}
