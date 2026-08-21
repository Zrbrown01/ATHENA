"use client";

import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { StatusPill } from "./status-pill";

type Projection = {
  items: Array<{
    id: string;
    title: string;
    dueAt: string;
    status: "open" | "completed" | "cancelled" | "waived";
    revision: number;
  }>;
  dependencies: Array<{
    id: string;
    predecessorObligationId: string;
    successorObligationId: string;
    relationType: string;
    offsetBusinessDays: number;
    calculation: string[];
  }>;
  exceptions: Array<{
    id: string;
    obligationId: string;
    exceptionType: string;
    status: string;
    proposedDueAt?: string | null;
    decisionReason?: string | null;
    revision: number;
  }>;
  escalations: Array<{
    id: string;
    obligationId: string;
    level: string;
    status: string;
    businessDaysRemaining: number;
    basis: string;
    response?: string | null;
    revision: number;
  }>;
  limitation: string;
  error?: string;
};

export function ObligationGovernanceControl() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/obligations/governance")
      .then(async (response) => {
        const body = (await response.json()) as Projection;
        if (!response.ok)
          throw new Error(
            body.error ?? "Governance evidence could not be loaded",
          );
        if (active) setData(body);
      })
      .catch((error: Error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  async function advance() {
    if (!data) return;
    const successorIds = new Set(
      data.dependencies.map((dependency) => dependency.successorObligationId),
    );
    const predecessor = data.items.find(
      (item) => item.status === "open" && !successorIds.has(item.id),
    );
    if (!predecessor) {
      setMessage(
        "Create an open pilot obligation above before building its chain.",
      );
      return;
    }
    const dependency = data.dependencies.find(
      (item) => item.predecessorObligationId === predecessor.id,
    );
    const dependent = dependency
      ? data.items.find((item) => item.id === dependency.successorObligationId)
      : undefined;
    const exception = dependent
      ? data.exceptions.find((item) => item.obligationId === dependent.id)
      : undefined;
    const escalation = dependent
      ? data.escalations.find((item) => item.obligationId === dependent.id)
      : undefined;
    const common = {
      tenantId: "tenant-golden",
      matterId: "matter-golden-001",
      idempotencyKey: `obligation-governance-${crypto.randomUUID()}`,
    };
    let body: Record<string, unknown>;
    if (!dependent) {
      const suffix = crypto.randomUUID();
      body = {
        action: "create_dependent",
        ...common,
        predecessorObligationId: predecessor.id,
        expectedPredecessorRevision: predecessor.revision,
        dependentObligationId: `obligation-dependent-${suffix}`,
        dependencyId: `obligation-dependency-${suffix}`,
        relationType: "preparation_before",
        offsetBusinessDays: 2,
        title: "Prepare attorney QME review materials",
        requirement:
          "Assemble the source-linked QME pages and issue checklist before the synthetic review obligation.",
        ownerId: "user-sara-kim",
        reason:
          "Synthetic preparation chain demonstrates governed dependency ordering without asserting a California deadline.",
      };
    } else if (!exception) {
      const proposed = new Date(dependent.dueAt);
      proposed.setUTCDate(proposed.getUTCDate() + 1);
      body = {
        action: "request_exception",
        ...common,
        obligationId: dependent.id,
        expectedRevision: dependent.revision,
        exceptionId: `obligation-exception-${crypto.randomUUID()}`,
        exceptionType: "due_date_exception",
        proposedDueDate: proposed.toISOString().slice(0, 10),
        reason:
          "Synthetic source packet review needs one additional day before attorney verification.",
        authorityBasis:
          "Matter-specific firm workflow exception only; no court, statute, regulation, or client extension is claimed.",
      };
    } else if (exception.status === "requested") {
      body = {
        action: "decide_exception",
        ...common,
        obligationId: dependent.id,
        expectedRevision: dependent.revision,
        exceptionId: exception.id,
        expectedExceptionRevision: exception.revision,
        outcome: "approved",
        decisionReason:
          "Partner approved the synthetic firm-workflow date adjustment while preserving the original due date and reason evidence.",
      };
    } else if (!escalation) {
      const asOf = new Date(dependent.dueAt);
      asOf.setUTCDate(asOf.getUTCDate() + 1);
      body = {
        action: "evaluate_escalation",
        ...common,
        obligationId: dependent.id,
        expectedRevision: dependent.revision,
        escalationId: `obligation-escalation-${crypto.randomUUID()}`,
        asOfDate: asOf.toISOString().slice(0, 10),
      };
    } else {
      body = {
        action: "acknowledge_escalation",
        ...common,
        obligationId: dependent.id,
        escalationId: escalation.id,
        expectedEscalationRevision: escalation.revision,
        response:
          "Partner acknowledged the synthetic breach, confirmed ownership, and preserved the escalation for follow-up; no external extension is inferred.",
      };
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/obligations/governance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const next = (await response.json()) as Projection;
      if (!response.ok)
        throw new Error(next.error ?? "Governance action failed");
      setData(next);
      setMessage("Governed deadline evidence advanced.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setPending(false);
    }
  }

  if (!data)
    return (
      <section className="panel approval-strip">
        <LoaderCircle className="spin" size={18} />
        <p>Loading dependency, exception, and escalation evidence…</p>
        {message && <small role="alert">{message}</small>}
      </section>
    );

  const latestEscalation = data.escalations.at(-1);
  return (
    <section className="panel operator-panel">
      <header>
        <div>
          <span className="eyebrow">DEADLINE GOVERNANCE</span>
          <h2>Chains, exceptions, and escalation</h2>
          <p>{data.limitation}</p>
        </div>
        <StatusPill
          tone={
            latestEscalation?.status === "acknowledged"
              ? "success"
              : latestEscalation
                ? "danger"
                : "info"
          }
        >
          {latestEscalation?.status ?? "controlled pilot"}
        </StatusPill>
      </header>
      {data.dependencies.map((dependency) => (
        <p key={dependency.id}>
          <GitBranch size={14} aria-hidden="true" />{" "}
          <strong>{dependency.relationType.replaceAll("_", " ")}</strong> ·{" "}
          {dependency.offsetBusinessDays} business days
          <br />
          <small>{dependency.calculation.join(" · ")}</small>
        </p>
      ))}
      {data.exceptions.map((exception) => (
        <p key={exception.id}>
          <ShieldAlert size={14} aria-hidden="true" />{" "}
          <strong>{exception.exceptionType.replaceAll("_", " ")}</strong> ·{" "}
          {exception.status}
          {exception.proposedDueAt
            ? ` · proposed ${new Date(exception.proposedDueAt).toLocaleDateString()}`
            : ""}
          <br />
          <small>{exception.decisionReason}</small>
        </p>
      ))}
      {data.escalations.map((escalation) => (
        <p key={escalation.id}>
          <AlertTriangle size={14} aria-hidden="true" />{" "}
          <strong>{escalation.level}</strong> · {escalation.status} ·{" "}
          {escalation.businessDaysRemaining} business days remaining
          <br />
          <small>{escalation.basis}</small>
          {escalation.response && (
            <>
              <br />
              <small>{escalation.response}</small>
            </>
          )}
        </p>
      ))}
      <button
        className="primary-action"
        type="button"
        onClick={() => void advance()}
        disabled={pending || latestEscalation?.status === "acknowledged"}
      >
        {pending ? (
          <LoaderCircle className="spin" size={15} />
        ) : (
          <CheckCircle2 size={15} />
        )}
        Advance governed deadline lifecycle
      </button>
      {message && (
        <p className="inline-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
