"use client";
import { CheckCircle2, LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";
type P = {
  targets: Array<{
    id: string;
    payloadSha256: string;
    syntheticDisposable: boolean;
  }>;
  requests: Array<{
    id: string;
    status: string;
    revision: number;
    targetId: string;
    legalHoldCount: number;
    previewItemCount: number;
    immutableExclusions: string[];
    requestedBy: string;
  }>;
  approvals: Array<{
    id: string;
    requestId: string;
    sequence: number;
    approverId: string;
    outcome: string;
  }>;
  executions: Array<{
    id: string;
    requestId: string;
    deletedItemCount: number;
    deletedPayloadSha256: string;
    auditRecordsPreserved: boolean;
    eventRecordsPreserved: boolean;
  }>;
  limitation?: string;
  error?: string;
};
const R = "disposition-request-ui-001",
  M = "matter-disposition-sandbox-ui",
  T = "disposition-target-ui-001";
export function DispositionOperations() {
  const [data, setData] = useState<P | null>(null),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  async function load() {
    setPending(true);
    try {
      const r = await fetch("/api/admin/disposition"),
        x = (await r.json()) as P;
      if (!r.ok) throw new Error(x.error ?? "Load failed");
      setData(x);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setPending(false);
    }
  }
  async function act() {
    const request = data?.requests.find((x) => x.id === R),
      shared = {
        tenantId: "tenant-golden",
        matterId: M,
        requestId: R,
        idempotencyKey: `disposition-${crypto.randomUUID()}`,
      },
      body = !request
        ? {
            action: "materialize_sandbox_candidate",
            ...shared,
            targetId: T,
            payload:
              "Synthetic disposable payload created solely to prove governed deletion execution.",
            syntheticDisposable: true,
          }
        : {
            action: "preview_disposition",
            ...shared,
            expectedRevision: request.revision,
            reason:
              "Preview exactly one synthetic target and preserve audit, event, approval, execution, and decision evidence.",
          };
    setPending(true);
    try {
      const r = await fetch("/api/admin/disposition", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        x = (await r.json()) as P;
      if (!r.ok) throw new Error(x.error ?? "Disposition action failed");
      setData(x);
      setMessage("Disposition evidence advanced.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setPending(false);
    }
  }
  if (!data)
    return (
      <section className="panel operator-load">
        <Trash2 size={22} />
        <div>
          <h2>Deletion and disposition control</h2>
          <p>
            Load scope previews, hold gates, independent approvals, execution
            evidence, and immutable exclusions.
          </p>
          <button
            className="secondary-action"
            onClick={() => void load()}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Trash2 size={15} />
            )}
            Load disposition control
          </button>
          {message && <p className="inline-message">{message}</p>}
        </div>
      </section>
    );
  const r = data.requests.find((x) => x.id === R),
    execution = data.executions.find((x) => x.requestId === R),
    canAdvance = !r || r.status === "draft";
  return (
    <section className="panel operator-panel">
      <header>
        <div>
          <h2>Governed synthetic disposition</h2>
          <p>{data.limitation}</p>
        </div>
        <StatusPill
          tone={
            r?.status === "executed"
              ? "success"
              : r?.status === "blocked_by_hold"
                ? "danger"
                : "info"
          }
        >
          {r?.status ?? "not started"}
        </StatusPill>
      </header>
      {r && (
        <>
          <p>
            <strong>Scope:</strong> {r.previewItemCount} disposable item ·
            active holds {r.legalHoldCount} · revision {r.revision}
          </p>
          <p>
            <strong>Immutable exclusions:</strong>{" "}
            {r.immutableExclusions.join(" · ")}
          </p>
        </>
      )}
      {data.approvals
        .filter((x) => x.requestId === R)
        .map((x) => (
          <p key={x.id}>
            <strong>
              Approval {x.sequence} · {x.outcome}
            </strong>{" "}
            · {x.approverId}
          </p>
        ))}
      {execution && (
        <p>
          <strong>Execution:</strong> deleted {execution.deletedItemCount} ·
          audit preserved {String(execution.auditRecordsPreserved)} · events
          preserved {String(execution.eventRecordsPreserved)}
          <br />
          <small>
            Deleted payload SHA-256 {execution.deletedPayloadSha256}
          </small>
        </p>
      )}
      {r?.status === "ready_for_approval" && (
        <div className="truth-banner">
          <Trash2 size={17} />
          <div>
            <strong>Independent approvals required</strong>
            <p>
              The requesting identity cannot approve. Two other authorized
              identities must approve before execution.
            </p>
          </div>
        </div>
      )}
      {canAdvance && (
        <button
          className="primary-action"
          onClick={() => void act()}
          disabled={pending}
        >
          <CheckCircle2 size={15} />
          Advance synthetic disposition
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
