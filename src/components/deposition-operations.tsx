"use client";
import { CheckCircle2, LoaderCircle, Video } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";
type P = {
  items: Array<{
    id: string;
    deponentName: string;
    status: string;
    revision: number;
    providerMode: string;
    externalBookingId: string | null;
  }>;
  artifacts: Array<{
    id: string;
    depositionId: string;
    artifactType: string;
    title: string;
    sha256: string;
  }>;
  limitation?: string;
  error?: string;
};
const ID = "deposition-rivera-sandbox-001",
  shared = {
    tenantId: "tenant-golden",
    matterId: "matter-golden-001",
    depositionId: ID,
  };
export function DepositionOperations() {
  const [data, setData] = useState<P | null>(null),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  async function request(body?: Record<string, unknown>) {
    const r = await fetch("/api/depositions", {
        method: body ? "POST" : "GET",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      }),
      x = (await r.json()) as P;
    if (!r.ok) throw new Error(x.error ?? "Operation failed");
    setData(x);
  }
  async function load() {
    setPending(true);
    try {
      await request();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setPending(false);
    }
  }
  async function advance() {
    const x = data?.items.find((v) => v.id === ID),
      key = `deposition-${crypto.randomUUID()}`;
    let body: Record<string, unknown>;
    if (!x)
      body = {
        action: "request_deposition",
        ...shared,
        deponentName: "Alex Rivera",
        depositionType: "applicant",
        requestedStartsAt: "2026-09-10T17:00:00.000Z",
        timezone: "America/Los_Angeles",
        locationMode: "remote",
        reporterRequired: true,
        videoRequired: false,
        interpreterRequired: false,
        realtimeRequired: false,
        clientApprovalRequired: true,
        syntheticDataAcknowledged: true,
        idempotencyKey: key,
      };
    else {
      const b = {
        ...shared,
        expectedRevision: x.revision,
        idempotencyKey: key,
      };
      if (x.status === "pending_approval")
        body = {
          action: "approve_deposition",
          ...b,
          reason:
            "Attorney approved the synthetic deposition request under client governance.",
        };
      else if (x.status === "ready_for_handoff")
        body = {
          action: "attempt_noted_booking",
          ...b,
          reason:
            "Record the honest Noted connection block without attempting provider delivery.",
        };
      else if (x.status === "handoff_blocked")
        body = {
          action: "record_human_scheduling",
          ...b,
          externalBookingId: "human-confirmation-sandbox-001",
          scheduledAt: "2026-09-10T17:00:00.000Z",
          evidence:
            "Attorney verified an explicitly synthetic external scheduling confirmation.",
        };
      else if (x.status === "scheduled")
        body = {
          action: "complete_deposition",
          ...b,
          completionEvidence:
            "Attorney verified completion of the explicitly synthetic deposition event.",
        };
      else if (x.status === "completed")
        body = {
          action: "materialize_synthetic_transcript",
          ...b,
          artifactId: "transcript-rivera-sandbox-001",
          title: "Synthetic applicant deposition transcript",
          content:
            "Synthetic transcript fixture created solely to prove checksum and return lifecycle behavior.",
          syntheticDataAcknowledged: true,
        };
      else
        body = {
          action: "close_deposition",
          ...b,
          reason:
            "Attorney closed the synthetic deposition lifecycle after transcript verification.",
        };
    }
    setPending(true);
    try {
      await request(body);
      setMessage("Deposition evidence advanced.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setPending(false);
    }
  }
  if (!data)
    return (
      <section className="panel operator-load">
        <Video size={22} />
        <div>
          <h2>Noted deposition operations</h2>
          <p>
            Load request, governance, booking truth, scheduling, and transcript
            evidence.
          </p>
          <button
            className="secondary-action"
            onClick={() => void load()}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Video size={15} />
            )}
            Load depositions
          </button>
          {message && <p className="inline-message">{message}</p>}
        </div>
      </section>
    );
  const x = data.items.find((v) => v.id === ID),
    artifact = data.artifacts.find((v) => v.depositionId === ID);
  return (
    <section className="panel operator-panel">
      <header>
        <div>
          <h2>Governed deposition lifecycle</h2>
          <p>{data.limitation}</p>
        </div>
        <StatusPill
          tone={
            x?.status === "closed"
              ? "success"
              : x?.status === "handoff_blocked"
                ? "warning"
                : "info"
          }
        >
          {x?.status ?? "not started"}
        </StatusPill>
      </header>
      {x && (
        <p>
          <strong>{x.deponentName}</strong> · provider {x.providerMode} ·
          revision {x.revision}
          {x.externalBookingId ? ` · ${x.externalBookingId}` : ""}
        </p>
      )}
      {artifact && (
        <p>
          <strong>{artifact.title}</strong>
          <br />
          <small>SHA-256 {artifact.sha256}</small>
        </p>
      )}
      {x?.status !== "closed" && (
        <button
          className="primary-action"
          onClick={() => void advance()}
          disabled={pending}
        >
          {pending ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <CheckCircle2 size={15} />
          )}
          Advance synthetic lifecycle
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
