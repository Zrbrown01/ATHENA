"use client";
import { FileLock2, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";
type Source = { id: string; title: string; sourceSha256: string; sourceByteSize: number; status: string; revision: number; businessDays: number };
type Review = { instructionId: string; reviewType: string; outcome: string; reviewerId: string };
type Projection = { sources: Source[]; reviews: Review[]; limitation: string; error?: string };
const INSTRUCTION = "client-instruction-summit-synthetic-001";
const base = { tenantId: "tenant-golden", matterId: "matter-golden-001", instructionId: INSTRUCTION };
export function ClientInstructionOperations() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function load() {
    setPending(true);
    try { const response = await fetch("/api/admin/governance/client-instructions"), next = await response.json() as Projection; if (!response.ok) throw new Error(next.error ?? "Client instructions could not be loaded"); setData(next); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Load failed"); }
    finally { setPending(false); }
  }
  async function act(action: "materialize_synthetic_source" | "review_source" | "activate_source" | "deactivate_source") {
    const source = data?.sources.find(item => item.id === INSTRUCTION);
    const body = action === "materialize_synthetic_source" ? { action, ...base, evidenceId: "evidence-client-instruction-summit-synthetic-001", clientId: "client-summit", code: "synthetic-client-status-report-deadline", version: 1, title: "Synthetic Summit status-report instruction", businessDays: 6, authorityCitation: "Synthetic Summit workflow fixture — not an external client instruction.", effectiveDate: "2026-01-01", reviewDate: "2026-12-31", sandboxAcknowledged: true, idempotencyKey: `client-instruction-create-${crypto.randomUUID()}` }
      : action === "review_source" ? { action, ...base, expectedRevision: source?.revision, reviewId: `client-instruction-integrity-${crypto.randomUUID()}`, reviewType: "source_integrity", outcome: "approved", evidence: "Reviewer matched the preserved PDF bytes, checksum, custody identity, and synthetic label.", idempotencyKey: `client-instruction-review-${crypto.randomUUID()}` }
      : action === "activate_source" ? { action, ...base, expectedRevision: source?.revision, layerId: "governance-layer-client-instruction-synthetic-001", approval: "Partner approved the independently reviewed synthetic instruction for sandbox policy simulation only.", idempotencyKey: `client-instruction-activate-${crypto.randomUUID()}` }
      : { action, ...base, expectedRevision: source?.revision, reason: "Partner deactivated the synthetic instruction and its derived policy layer.", idempotencyKey: `client-instruction-deactivate-${crypto.randomUUID()}` };
    setPending(true);
    try { const response = await fetch("/api/admin/governance/client-instructions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), next = await response.json() as Projection; if (!response.ok) throw new Error(next.error ?? "Client-instruction operation failed"); setData(next); setMessage("Checksum-pinned instruction decision and event evidence recorded."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Operation failed"); }
    finally { setPending(false); }
  }
  if (!data) return <section className="panel operator-load"><FileLock2 size={22}/><div><h2>Client-instruction activation</h2><p>Verify immutable source identity and independent reviews before policy activation.</p><button className="secondary-action" onClick={() => void load()} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <FileLock2 size={15}/>}Load instruction controls</button>{message && <p className="inline-message">{message}</p>}</div></section>;
  const source = data.sources.find(item => item.id === INSTRUCTION), reviews = data.reviews.filter(item => item.instructionId === INSTRUCTION);
  const next = !source ? "materialize_synthetic_source" : source.status === "registered" ? "review_source" : source.status === "ready_for_activation" ? "activate_source" : ["synthetic_active", "verified_active"].includes(source.status) ? "deactivate_source" : null;
  const labels = { materialize_synthetic_source: "Preserve synthetic source", review_source: "Approve source-integrity review", activate_source: "Activate reviewed instruction", deactivate_source: "Deactivate instruction" } as const;
  return <section className="panel operator-panel"><header><div><h2>Client-instruction activation</h2><p>Immutable source → two distinct reviewers → exact-version client policy</p></div><StatusPill tone={source?.status.includes("active") ? "success" : source?.status === "ready_for_activation" ? "info" : "warning"}>{source?.status ?? "not registered"}</StatusPill></header>{source && <><p><strong>{source.title}</strong> · {source.businessDays} business days · {source.sourceByteSize} bytes</p><p className="operator-note">SHA-256 {source.sourceSha256}</p></>}{reviews.map(review => <p key={review.reviewType}><ShieldCheck size={14}/> <strong>{review.reviewType}</strong> · {review.outcome} · {review.reviewerId}</p>)}{source?.status === "under_review" && <p className="inline-message">Awaiting the instruction-scope review from a different authenticated attorney or partner.</p>}{next && <div className="operator-actions"><button className="primary-action" onClick={() => void act(next)} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <FileLock2 size={15}/>} {labels[next]}</button></div>}<p className="operator-note">{data.limitation}</p>{message && <p className="inline-message" role="status">{message}</p>}</section>;
}
