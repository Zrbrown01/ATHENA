export type ConnectionStatus = "not_connected" | "connecting" | "healthy" | "degraded" | "revoked";

export interface ConnectionHealth {
  provider: string;
  status: ConnectionStatus;
  lastSuccessfulSync?: string;
  lastReconciliation?: string;
  message: string;
}

export interface IntegrationEvent<TPayload = unknown> {
  providerEventId: string;
  tenantId: string;
  idempotencyKey: string;
  observedAt: string;
  payload: TPayload;
}

export interface IntegrationAdapter<TCursor, TPayload> {
  readonly provider: string;
  health(tenantId: string): Promise<ConnectionHealth>;
  backfill(tenantId: string, cursor?: TCursor): AsyncIterable<IntegrationEvent<TPayload>>;
  reconcile(tenantId: string, cursor?: TCursor): Promise<TCursor>;
  revoke(tenantId: string): Promise<void>;
}

export class DisabledIntegrationAdapter implements IntegrationAdapter<string, never> {
  constructor(readonly provider: string, private readonly activationRequirement: string) {}

  async health(): Promise<ConnectionHealth> {
    return { provider: this.provider, status: "not_connected", message: this.activationRequirement };
  }

  async *backfill(): AsyncIterable<IntegrationEvent<never>> {
    return;
  }

  async reconcile(): Promise<string> {
    throw new Error(`${this.provider} is not connected`);
  }

  async revoke(): Promise<void> {
    return;
  }
}
