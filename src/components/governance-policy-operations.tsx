"use client";

import { CheckCircle2, GitCompareArrows, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";

const CODE = "synthetic-status-report-deadline";
const scopeDefinitions = [
  {
    id: "governance-policy-firm-001",
    scopeType: "firm",
    scopeId: "tenant-golden",
    businessDays: 8,
    label: "Firm baseline",
  },
  {
    id: "governance-policy-client-001",
    scopeType: "client",
    scopeId: "client-summit",
    businessDays: 6,
    label: "Summit client override",
  },
  {
    id: "governance-policy-type-001",
    scopeType: "matter_type",
    scopeId: "california-wc-defense",
    businessDays: 5,
    label: "California WC defense matter type",
  },
  {
    id: "governance-policy-matter-v1",
    scopeType: "matter",
    scopeId: "matter-golden-001",
    businessDays: 3,
    label: "Rivera matter exception",
  },
] as const;

type Layer = {
  id: string;
  code: string;
  version: number;
  scopeType: string;
  scopeId: string;
  businessDays: number;
  contentStatus: string;
  status: string;
  revision: number;
  supersedesLayerId: string | null;
};
type Simulation = {
  id: string;
  selectedLayerId: string;
  selectedScopeType: string;
  selectedVersion: number;
  dueAt: string;
  applicableLayerIds: string[];
  calculation: string[];
};
type Diff = {
  priorLayerId: string;
  nextLayerId: string;
  businessDaysDelta: number;
  authorityCitationChanged: boolean;
};
type Projection = {
  layers: Layer[];
  simulations: Simulation[];
  diffs: Diff[];
  limitation: string;
  error?: string;
};

export function GovernancePolicyOperations() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function request(body?: Record<string, unknown>) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(
        "/api/admin/governance",
        body
          ? {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }
          : undefined,
      );
      const result = (await response.json()) as Projection;
      if (!response.ok)
        throw new Error(result.error ?? "Governance operation failed");
      setData(result);
      if (body)
        setMessage(
          body.action === "simulate"
            ? "Deterministic precedence simulation and immutable snapshot recorded."
            : "Versioned synthetic policy layer and event evidence recorded.",
        );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setPending(false);
    }
  }

  function createLayer(definition: (typeof scopeDefinitions)[number]) {
    return request({
      action: "create_layer",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      layerId: definition.id,
      code: CODE,
      version: 1,
      scopeType: definition.scopeType,
      scopeId: definition.scopeId,
      businessDays: definition.businessDays,
      authorityCitation: `${definition.label} — synthetic workflow content pending California attorney and client approval.`,
      effectiveDate: "2026-01-01",
      reviewDate: "2026-12-31",
      contentStatus: "synthetic_sandbox",
      supersedesLayerId: null,
      expectedSupersededRevision: null,
      reason:
        "Partner created a synthetic precedence layer for deterministic governance testing.",
      sandboxAcknowledged: true,
      idempotencyKey: `governance-layer-${crypto.randomUUID()}`,
    });
  }

  function supersedeMatter(layer: Layer) {
    return request({
      action: "create_layer",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      layerId: "governance-policy-matter-v2",
      code: CODE,
      version: 2,
      scopeType: "matter",
      scopeId: "matter-golden-001",
      businessDays: 4,
      authorityCitation:
        "Revised Rivera matter exception — synthetic workflow content pending California attorney and client approval.",
      effectiveDate: "2026-08-21",
      reviewDate: "2026-12-31",
      contentStatus: "synthetic_sandbox",
      supersedesLayerId: layer.id,
      expectedSupersededRevision: layer.revision,
      reason:
        "Partner revised the synthetic matter exception while preserving the prior version and diff.",
      sandboxAcknowledged: true,
      idempotencyKey: `governance-layer-v2-${crypto.randomUUID()}`,
    });
  }

  function simulate() {
    return request({
      action: "simulate",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      simulationId: `governance-simulation-${crypto.randomUUID()}`,
      code: CODE,
      triggerDate: "2026-08-20",
      asOfDate: "2026-08-21",
      clientId: "client-summit",
      matterType: "california-wc-defense",
      sandboxAcknowledged: true,
      idempotencyKey: `governance-simulate-${crypto.randomUUID()}`,
    });
  }

  if (!data)
    return (
      <section className="panel operator-load">
        <GitCompareArrows size={22} />
        <div>
          <h2>Governance precedence and simulation</h2>
          <p>
            Load versioned firm, client, matter-type, and matter policy layers.
          </p>
          <button
            className="secondary-action"
            onClick={() => void request()}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <GitCompareArrows size={15} />
            )}
            Load governance controls
          </button>
          {message && <p className="inline-message">{message}</p>}
        </div>
      </section>
    );

  const layers = data.layers.filter((layer) => layer.code === CODE);
  const missing = scopeDefinitions.find(
    (definition) => !layers.some((layer) => layer.id === definition.id),
  );
  const activeMatter = layers.find(
    (layer) => layer.scopeType === "matter" && layer.status === "active",
  );
  const latestSimulation = data.simulations.find((simulation) =>
    layers.some((layer) => layer.id === simulation.selectedLayerId),
  );
  const hasCurrentSimulation =
    latestSimulation?.selectedLayerId === activeMatter?.id;
  const next = missing
    ? "layer"
    : !latestSimulation
      ? "simulate"
      : activeMatter?.version === 1
        ? "supersede"
        : !hasCurrentSimulation
          ? "simulate"
          : null;

  return (
    <section className="panel operator-panel">
      <header>
        <div>
          <h2>Governance precedence and simulation</h2>
          <p>{data.limitation}</p>
        </div>
        <StatusPill tone={latestSimulation ? "info" : "warning"}>
          {latestSimulation
            ? `${latestSimulation.selectedScopeType} v${latestSimulation.selectedVersion}`
            : "not simulated"}
        </StatusPill>
      </header>
      <div className="readiness-findings">
        {scopeDefinitions.map((definition) => {
          const current = layers.find(
            (layer) =>
              layer.scopeType === definition.scopeType &&
              layer.status === "active",
          );
          return (
            <div key={definition.scopeType}>
              <span>
                {definition.label} · {current?.businessDays ?? "—"} business
                days
              </span>
              <StatusPill tone={current ? "success" : "warning"}>
                {current ? `v${current.version}` : "missing"}
              </StatusPill>
            </div>
          );
        })}
      </div>
      {latestSimulation && (
        <>
          <p>
            <strong>Simulated due date:</strong>{" "}
            {new Date(latestSimulation.dueAt).toLocaleDateString()} ·{" "}
            {latestSimulation.applicableLayerIds.length} applicable layers
          </p>
          <ol>
            {latestSimulation.calculation.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ol>
        </>
      )}
      {data.diffs
        .filter((diff) => layers.some((layer) => layer.id === diff.nextLayerId))
        .map((diff) => (
          <p className="inline-message" key={diff.nextLayerId}>
            Version diff: {diff.priorLayerId} → {diff.nextLayerId};{" "}
            {diff.businessDaysDelta >= 0 ? "+" : ""}
            {diff.businessDaysDelta} business day; citation{" "}
            {diff.authorityCitationChanged ? "changed" : "unchanged"}.
          </p>
        ))}
      {next && (
        <button
          className="primary-action"
          onClick={() =>
            void (next === "layer"
              ? createLayer(missing!)
              : next === "supersede"
                ? supersedeMatter(activeMatter!)
                : simulate())
          }
          disabled={pending}
        >
          {pending ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <CheckCircle2 size={15} />
          )}
          {next === "layer"
            ? `Create ${missing!.label}`
            : next === "supersede"
              ? "Create matter version 2"
              : "Run precedence simulation"}
        </button>
      )}
      {message && (
        <p className="inline-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
