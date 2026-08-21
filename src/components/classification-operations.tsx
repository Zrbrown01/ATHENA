"use client";

import { CheckCircle2, LoaderCircle, Tags } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";

const TENANT = "tenant-golden";
const MATTER = "matter-golden-001";
const RESOURCE = "classification-fixture-document-001";
const PLANES = [
  "access",
  "search",
  "ai",
  "sharing",
  "download",
  "printing",
  "retention",
  "export",
  "logging",
] as const;

type Projection = {
  policies: Array<{ id: string; version: number; status: string }>;
  resources: Array<{
    id: string;
    resourceId: string;
    labels: string[];
    policyVersion: number;
  }>;
  decisions: Array<{
    id: string;
    resourceId: string;
    plane: string;
    outcome: string;
    reasonCodes: string[];
    eventId: string;
  }>;
  limitation?: string;
  error?: string;
};

export function ClassificationOperations() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function request(body?: Record<string, unknown>) {
    const response = await fetch("/api/admin/classification", {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const projection = (await response.json()) as Projection;
    if (!response.ok) throw new Error(projection.error ?? "Operation failed");
    setData(projection);
    return projection;
  }

  async function load() {
    setPending(true);
    try {
      await request();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Load failed");
    } finally {
      setPending(false);
    }
  }

  async function provePolicy() {
    setPending(true);
    setMessage(null);
    try {
      let current = data;
      if (!current?.resources.some((row) => row.resourceId === RESOURCE)) {
        current = await request({
          action: "register_fixture_classification",
          tenantId: TENANT,
          matterId: MATTER,
          resourceType: "document",
          resourceId: RESOURCE,
          classificationId: "classification-fixture-001",
          policyId: "classification-policy-v1",
          labels: [
            "privileged",
            "medical_sensitive",
            "ai_restricted",
            "legal_hold",
          ],
          source:
            "Explicitly synthetic fixture labels selected to exercise governed policy decisions.",
          fixtureAcknowledged: true,
          idempotencyKey: `classification-register-${crypto.randomUUID()}`,
        });
      }
      const decided = new Set(
        current.decisions
          .filter((row) => row.resourceId === RESOURCE)
          .map((row) => row.plane),
      );
      for (const plane of PLANES) {
        if (decided.has(plane)) continue;
        current = await request({
          action: "evaluate_plane",
          tenantId: TENANT,
          matterId: MATTER,
          resourceType: "document",
          resourceId: RESOURCE,
          plane,
          purpose: `Prove the ${plane} classification boundary for the synthetic controlled fixture.`,
          idempotencyKey: `classification-${plane}-${crypto.randomUUID()}`,
        });
      }
      setMessage("All nine policy-plane decisions are preserved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Proof failed");
    } finally {
      setPending(false);
    }
  }

  if (!data)
    return (
      <section className="panel operator-load">
        <Tags size={22} />
        <div>
          <h2>Data classification control</h2>
          <p>
            Load versioned labels, policy planes, overrides, and immutable
            decision evidence.
          </p>
          <button
            className="secondary-action"
            onClick={() => void load()}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Tags size={15} />
            )}
            Load classification control
          </button>
          {message && <p className="inline-message">{message}</p>}
        </div>
      </section>
    );

  const fixture = data.resources.find((row) => row.resourceId === RESOURCE);
  const decisions = data.decisions.filter((row) => row.resourceId === RESOURCE);
  return (
    <section className="panel operator-panel">
      <header>
        <div>
          <h2>Governed synthetic classification</h2>
          <p>{data.limitation}</p>
        </div>
        <StatusPill
          tone={decisions.length === PLANES.length ? "success" : "info"}
        >
          {decisions.length} / {PLANES.length} planes
        </StatusPill>
      </header>
      {fixture && (
        <p>
          <strong>Policy v{fixture.policyVersion} labels:</strong>{" "}
          {fixture.labels.join(" · ")}
        </p>
      )}
      {decisions.map((decision) => (
        <p key={decision.id}>
          <strong>{decision.plane}</strong> · {decision.outcome} ·{" "}
          {decision.reasonCodes.join(", ")}
          <br />
          <small>Immutable event {decision.eventId}</small>
        </p>
      ))}
      {decisions.length < PLANES.length && (
        <button
          className="primary-action"
          onClick={() => void provePolicy()}
          disabled={pending}
        >
          {pending ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <CheckCircle2 size={15} />
          )}
          Prove all policy planes
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
