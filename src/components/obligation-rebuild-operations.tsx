"use client";

import { CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";

type Run = {
  id: string;
  outcome: "matched" | "exceptions" | "blocked";
  status: "pending_review" | "reviewed";
  obligationCount: number;
  matchedCount: number;
  driftedCount: number;
  blockedCount: number;
  revision: number;
  reviewOutcome: string | null;
  createdAt: string;
};
type Finding = {
  id: string;
  runId: string;
  obligationId: string;
  result: "matched" | "drifted" | "blocked";
  actualDueAt: string;
  expectedDueAt: string | null;
  reasons: string[];
};
type Projection = {
  runs: Run[];
  findings: Finding[];
  limitation: string;
  error?: string;
};

export function ObligationRebuildOperations() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function request(body?: Record<string, unknown>) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(
        "/api/admin/governance/rebuild",
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
        throw new Error(result.error ?? "Rebuild operation failed");
      setData(result);
      if (body)
        setMessage(
          body.action === "run_rebuild"
            ? "Immutable rebuild findings recorded for partner review; no obligation was changed."
            : "Partner review evidence recorded with optimistic concurrency protection.",
        );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setPending(false);
    }
  }
  const latest = data?.runs[0];
  const findings = latest
    ? (data?.findings.filter((finding) => finding.runId === latest.id) ?? [])
    : [];
  function run() {
    return request({
      action: "run_rebuild",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      runId: `obligation-rebuild-${crypto.randomUUID()}`,
      asOfDate: "2026-08-21",
      syntheticDataAcknowledged: true,
      idempotencyKey: `obligation-rebuild-run-${crypto.randomUUID()}`,
    });
  }
  function review(run: Run) {
    return request({
      action: "review_rebuild",
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      runId: run.id,
      expectedRevision: run.revision,
      outcome: run.outcome === "matched" ? "certified" : "exceptions_noted",
      notes:
        run.outcome === "matched"
          ? "Partner certified that immutable rebuild evidence matches every stored obligation state."
          : "Partner reviewed the rebuild and noted all drifted or blocked findings for governed follow-up.",
      idempotencyKey: `obligation-rebuild-review-${crypto.randomUUID()}`,
    });
  }
  if (!data)
    return (
      <section className="panel operator-load">
        <RefreshCw size={22} />
        <div>
          <h2>Full-matter obligation rebuild</h2>
          <p>
            Recompute deadlines from exact rule, dependency, and
            approved-exception history.
          </p>
          <button
            className="secondary-action"
            onClick={() => void request()}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <RefreshCw size={15} />
            )}
            Load rebuild evidence
          </button>
          {message && <p className="inline-message">{message}</p>}
        </div>
      </section>
    );
  return (
    <section className="panel operator-panel">
      <header>
        <div>
          <h2>Full-matter obligation rebuild</h2>
          <p>{data.limitation}</p>
        </div>
        <StatusPill
          tone={
            latest?.outcome === "matched"
              ? "success"
              : latest
                ? "warning"
                : "info"
          }
        >
          {latest ? latest.status.replace("_", " ") : "not run"}
        </StatusPill>
      </header>
      {latest && (
        <>
          <div className="readiness-findings">
            <div>
              <span>Matched obligations</span>
              <StatusPill tone="success">{latest.matchedCount}</StatusPill>
            </div>
            <div>
              <span>Drifted obligations</span>
              <StatusPill tone={latest.driftedCount ? "warning" : "success"}>
                {latest.driftedCount}
              </StatusPill>
            </div>
            <div>
              <span>Blocked obligations</span>
              <StatusPill tone={latest.blockedCount ? "warning" : "success"}>
                {latest.blockedCount}
              </StatusPill>
            </div>
          </div>
          {findings
            .filter((finding) => finding.result !== "matched")
            .slice(0, 5)
            .map((finding) => (
              <p className="inline-message" key={finding.id}>
                <strong>{finding.obligationId}</strong>:{" "}
                {finding.reasons.join(" ")}
              </p>
            ))}
        </>
      )}
      <button
        className="primary-action"
        onClick={() =>
          void (latest?.status === "pending_review" ? review(latest) : run())
        }
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle className="spin" size={15} />
        ) : (
          <CheckCircle2 size={15} />
        )}
        {latest?.status === "pending_review"
          ? "Record partner review"
          : "Run immutable rebuild"}
      </button>
      {message && (
        <p className="inline-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
