export type DirectoryProviderIdentity = {
  externalObjectId: string;
  normalizedEmail: string;
  displayName: string;
  enabled: boolean;
  mfaState: "enforced" | "not_enforced";
  roleCodes: string[];
};

export type DirectoryProviderSnapshot = {
  provider: "microsoft_entra";
  providerMode: "deterministic_sandbox" | "live";
  observedAt: string;
  identities: DirectoryProviderIdentity[];
};

export interface DirectorySnapshotAdapter {
  readonly provider: "microsoft_entra";
  readonly mode: "not_connected" | "deterministic_sandbox" | "live";
  snapshot(
    tenantId: string,
    observedAt: string,
  ): Promise<DirectoryProviderSnapshot>;
}

export class DeterministicEntraDirectoryAdapter implements DirectorySnapshotAdapter {
  readonly provider = "microsoft_entra" as const;
  readonly mode = "deterministic_sandbox" as const;

  async snapshot(
    _tenantId: string,
    observedAt: string,
  ): Promise<DirectoryProviderSnapshot> {
    return {
      provider: this.provider,
      providerMode: this.mode,
      observedAt,
      identities: [
        {
          externalObjectId: "entra-sandbox-alex-rivera",
          normalizedEmail: "alex.rivera@example.test",
          displayName: "Alex Rivera",
          enabled: true,
          mfaState: "enforced",
          roleCodes: ["attorney"],
        },
        {
          externalObjectId: "entra-sandbox-taylor-kim",
          normalizedEmail: "taylor.kim@example.test",
          displayName: "Taylor Kim",
          enabled: true,
          mfaState: "enforced",
          roleCodes: ["paralegal"],
        },
      ],
    };
  }
}

export class DisabledEntraDirectoryAdapter implements DirectorySnapshotAdapter {
  readonly provider = "microsoft_entra" as const;
  readonly mode = "not_connected" as const;

  async snapshot(): Promise<DirectoryProviderSnapshot> {
    throw new Error(
      "Microsoft Entra is not connected; tenant consent, credentials, approved scopes, delta synchronization, and reconciliation evidence are required.",
    );
  }
}
