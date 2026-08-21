"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";

type Candidate = {
  status:
    | "conflict_review"
    | "missing_information"
    | "ready_to_open"
    | "opened"
    | "rejected";
  revision: number;
  missingFields: string[];
  caption: string;
  clientName: string;
  claimNumber?: string | null;
};
type OpeningObligation = {
  id: string;
  title: string;
  ruleCode: string;
  ruleVersion: number;
  dueAt: string;
  status: string;
};
type Projection = {
  candidate: Candidate | null;
  matches: Array<{
    disposition: string;
    scoreBasisPoints: number;
    evidence: string[];
  }>;
  conflicts: Array<{ status: string; severity: string; reason: string }>;
  reviews: Array<{ id: string; action: string }>;
  openingObligations: OpeningObligation[];
  openConflictCount: number;
  unresolvedMatchCount: number;
  limitation?: string;
  error?: string;
};

type Action =
  | "create_candidate"
  | "resolve_match"
  | "clear_conflict"
  | "supply_information"
  | "approve_open"
  | "materialize_initial_obligations";

export function IntakeCandidateReview() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setPending(true);
    try {
      const response = await fetch("/api/intake/candidates/golden");
      const result = (await response.json()) as Projection;
      if (!response.ok)
        throw new Error(result.error ?? "Intake could not be loaded");
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Load failed");
    } finally {
      setPending(false);
    }
  }

  async function act(action: Action) {
    setPending(true);
    setMessage(null);
    const openingAction =
      action === "approve_open" || action === "materialize_initial_obligations";
    const body: Record<string, unknown> = {
      action,
      expectedRevision: data?.candidate?.revision,
      idempotencyKey: `intake-${action}-${crypto.randomUUID()}`,
      reason:
        action === "resolve_match"
          ? "Exact claim and ADJ review shows this synthetic referral is not a duplicate of another live matter."
          : action === "clear_conflict"
            ? "Prior representation was unrelated after documented partner review of the synthetic conflict evidence."
            : action === "supply_information"
              ? "Claims professional email was supplied from the preserved synthetic referral source."
              : action === "materialize_initial_obligations"
                ? "The already-open pilot matter was reviewed and migrated to the versioned synthetic opening-rule bundle."
                : "Conflict, duplicate, completeness, governance, and opening review are documented and approved.",
    };
    if (action === "resolve_match") body.disposition = "ruled_out";
    if (action === "supply_information")
      body.fields = ["claims_professional_email"];
    if (openingAction) {
      body.openingTriggerDate = "2026-08-20";
      body.syntheticDataAcknowledged = true;
    }
    try {
      const response = await fetch("/api/intake/candidates/golden", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as Projection;
      if (!response.ok)
        throw new Error(result.error ?? "Intake operation failed");
      setData(result);
      setMessage(
        openingAction
          ? "Matter opening and both versioned initial obligations are recorded with immutable event evidence."
          : "Review step recorded.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setPending(false);
    }
  }

  if (!data)
    return (
      <section className="panel operator-load">
        <FileSearch size={22} />
        <div>
          <h2>Controlled intake candidate</h2>
          <p>
            Load source, duplicate, conflict, completeness, opening, and initial
            obligation evidence.
          </p>
          <button
            className="secondary-action"
            onClick={() => void load()}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <FileSearch size={15} />
            )}
            Load intake review
          </button>
          {message && <p className="inline-message">{message}</p>}
        </div>
      </section>
    );

  if (!data.candidate)
    return (
      <section className="panel operator-panel">
        <header>
          <div>
            <h2>Controlled intake candidate</h2>
            <p>{data.limitation}</p>
          </div>
          <StatusPill tone="neutral">Not created</StatusPill>
        </header>
        <button
          className="primary-action"
          onClick={() => void act("create_candidate")}
          disabled={pending}
        >
          <FileSearch size={15} />
          Preserve referral and create candidate
        </button>
        {message && (
          <p role="status" className="inline-message">
            {message}
          </p>
        )}
      </section>
    );

  const candidate = data.candidate;
  const next: Action | null = data.unresolvedMatchCount
    ? "resolve_match"
    : data.openConflictCount
      ? "clear_conflict"
      : candidate.missingFields.length
        ? "supply_information"
        : candidate.status === "ready_to_open"
          ? "approve_open"
          : candidate.status === "opened" &&
              data.openingObligations.length === 0
            ? "materialize_initial_obligations"
            : null;
  const labels: Partial<Record<Action, string>> = {
    resolve_match: "Rule out duplicate",
    clear_conflict: "Clear conflict with evidence",
    supply_information: "Supply missing information",
    approve_open: "Approve, open, and create deadlines",
    materialize_initial_obligations: "Create governed opening deadlines",
  };

  return (
    <section className="panel operator-panel">
      <header>
        <div>
          <h2>{candidate.caption}</h2>
          <p>{data.limitation}</p>
        </div>
        <StatusPill
          tone={
            candidate.status === "opened"
              ? "success"
              : candidate.status === "conflict_review"
                ? "danger"
                : "warning"
          }
        >
          {candidate.status.replaceAll("_", " ")}
        </StatusPill>
      </header>
      <div className="intake-gates">
        <span>
          <AlertTriangle size={14} /> {data.unresolvedMatchCount} duplicate
          match
        </span>
        <span>
          <ShieldCheck size={14} /> {data.openConflictCount} open conflict
        </span>
        <span>
          <FileSearch size={14} /> {candidate.missingFields.length} missing
          field
        </span>
        <span>
          <CheckCircle2 size={14} /> {data.openingObligations.length}/2 opening
          obligations
        </span>
      </div>
      {data.openingObligations.length > 0 && (
        <ol>
          {data.openingObligations.map((obligation) => (
            <li key={obligation.id}>
              <strong>{obligation.title}</strong>
              <small>
                {obligation.ruleCode}@{obligation.ruleVersion} · due{" "}
                {new Date(obligation.dueAt).toLocaleDateString()} ·{" "}
                {obligation.status}
              </small>
            </li>
          ))}
        </ol>
      )}
      {next && (
        <div className="operator-actions">
          <button
            className="primary-action"
            onClick={() => void act(next)}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <CheckCircle2 size={15} />
            )}
            {labels[next]}
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="inline-message">
          {message}
        </p>
      )}
    </section>
  );
}
