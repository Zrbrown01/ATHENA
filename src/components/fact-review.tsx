"use client";

import { Check, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { CandidateFact, ReviewStatus } from "@/domain/types";
import { StatusPill } from "./status-pill";

const toneFor = (status: ReviewStatus) => status === "verified" ? "success" : status === "rejected" ? "danger" : "warning";

export function FactReview({ initialFacts }: { initialFacts: CandidateFact[] }) {
  const [facts, setFacts] = useState(initialFacts);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function updateFact(id: string, reviewStatus: ReviewStatus) {
    if (reviewStatus === "candidate") {
      setFacts((current) => current.map((fact) => fact.id === id ? { ...fact, reviewStatus } : fact));
      return;
    }

    setPendingId(id);
    setError(null);
    try {
      const response = await fetch("/api/facts/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId: "tenant-golden",
          matterId: "matter-golden-001",
          factId: id,
          decision: reviewStatus,
          idempotencyKey: `fact-review-${id}-${crypto.randomUUID()}`,
        }),
      });
      if (!response.ok) throw new Error("The review decision could not be recorded.");
      setFacts((current) => current.map((fact) => fact.id === id ? { ...fact, reviewStatus } : fact));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The review decision could not be recorded.");
    } finally {
      setPendingId(null);
    }
  }

  const unresolved = facts.filter((fact) => fact.reviewStatus === "candidate").length;

  return (
    <section className="panel fact-review" aria-labelledby="fact-review-title">
      <header className="panel-heading">
        <div>
          <div className="heading-with-count"><h2 id="fact-review-title">Matter data review</h2><span>{unresolved}</span></div>
          <p>Material facts extracted from the new QME report require attorney confirmation.</p>
        </div>
        <Link className="text-button" href="/pilot/release-one">Open controlled workflow</Link>
      </header>
      <div className="fact-list">
        {error && <p className="inline-error" role="alert">{error} Please try again.</p>}
        {facts.map((fact) => (
          <article className={`fact-row ${fact.reviewStatus !== "candidate" ? "resolved" : ""}`} key={fact.id}>
            <div className="fact-main">
              <div className="fact-label-row">
                <span className="fact-type">{fact.label}</span>
                <StatusPill tone={toneFor(fact.reviewStatus)}>{fact.reviewStatus === "candidate" ? `${Math.round(fact.confidence * 100)}% confidence` : fact.reviewStatus}</StatusPill>
              </div>
              {fact.currentValue && <p className="current-value"><span>Current</span> {fact.currentValue}</p>}
              <p className="proposed-value"><span>Proposed</span> {fact.proposedValue}</p>
              <blockquote>“{fact.sourceExcerpt}”</blockquote>
              <Link className="source-link" href="/documents#recent-documents"><ExternalLink size={13} />{fact.sourceDocument} · page {fact.sourcePage}</Link>
              <p className="impact"><strong>Downstream impact:</strong> {fact.downstreamImpact}</p>
            </div>
            <div className="fact-actions">
              {fact.reviewStatus === "candidate" ? <>
                <button className="confirm" type="button" disabled={pendingId === fact.id} onClick={() => updateFact(fact.id, "verified")}><Check size={15} />Confirm</button>
                <button type="button" disabled={pendingId === fact.id} onClick={() => updateFact(fact.id, "rejected")}><X size={15} />Reject</button>
              </> : <span className="decision-recorded">Decision recorded in the audit trail</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
