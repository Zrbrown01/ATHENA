"use client";
import { BadgeDollarSign, CheckCircle2, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";

type Projection = { rateCards: Array<{ id: string; name: string; status: string; revision: number; sourceType: string }>; rateItems: Array<{ category: string; unit: string; unitRateMicros: number }>; usage: Array<{ id: string; workflowId: string; category: string; unit: string; quantity: number; costMicros: number; pricingState: string }>; summary: { totalCostMicros: number; estimatedEntryCount: number; providerVerifiedEntryCount: number; byCategory: Array<{ category: string; costMicros: number; entryCount: number }>; byWorkflow: Array<{ workflowId: string; costMicros: number; entryCount: number }> }; limitation?: string; error?: string };
const CARD = "cost-rate-card-synthetic-001";
const rates = [
  { category: "storage", unit: "gibibyte_month", unitRateMicros: 23_000 }, { category: "ocr", unit: "page", unitRateMicros: 1_500 },
  { category: "ai", unit: "token_1k", unitRateMicros: 10_000 }, { category: "email_processing", unit: "message", unitRateMicros: 100 },
  { category: "document_processing", unit: "document", unitRateMicros: 2_000 }, { category: "noted", unit: "minute", unitRateMicros: 1_000_000 },
  { category: "verbatim", unit: "minute", unitRateMicros: 350_000 }, { category: "telephony", unit: "minute", unitRateMicros: 20_000 },
  { category: "support", unit: "hour", unitRateMicros: 75_000_000 }, { category: "migration", unit: "record", unitRateMicros: 10 },
  { category: "implementation", unit: "hour", unitRateMicros: 150_000_000 },
];
const usageFixtures = [
  { category: "document_processing", unit: "document", quantity: 1, workflowId: "qme-document-intake", sourceId: "document-qme-rivera-001", evidence: "Athena measured one checksum-pinned synthetic QME document through the intake workflow." },
  { category: "ocr", unit: "page", quantity: 42, workflowId: "qme-document-intake", sourceId: "document-qme-rivera-001", evidence: "Athena counted forty-two pages in the checksum-pinned synthetic QME document." },
  { category: "verbatim", unit: "minute", quantity: 7, workflowId: "verbatim-dictation", sourceId: "dictation-verbatim-rivera-001", evidence: "Synthetic dictation metadata recorded seven minutes; no audio or provider request left Athena." },
] as const;
const dollars = (micros: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4 }).format(micros / 1_000_000);

export function CostGovernanceOperations() {
  const [data, setData] = useState<Projection | null>(null), [pending, setPending] = useState(false), [message, setMessage] = useState<string | null>(null);
  async function request(body?: Record<string, unknown>) { const response = await fetch("/api/admin/costs", { method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }); const payload = await response.json() as Projection; if (!response.ok) throw new Error(payload.error ?? "Operation failed"); setData(payload); return payload; }
  async function load() { setPending(true); try { await request(); } catch (error) { setMessage(error instanceof Error ? error.message : "Load failed"); } finally { setPending(false); } }
  async function advance() {
    const card = data?.rateCards.find((item) => item.id === CARD);
    let body: Record<string, unknown>;
    if (!card) body = { action: "create_rate_card", tenantId: "tenant-golden", rateCardId: CARD, name: "Synthetic pilot cost assumptions", currency: "USD", sourceType: "synthetic_estimate", sourceRef: "Internal synthetic planning assumptions only; not a provider contract, invoice, client rate, or accounting entry.", effectiveAt: "2026-08-20T00:00:00.000Z", rates, syntheticAcknowledged: true, idempotencyKey: `cost-card-${crypto.randomUUID()}` };
    else if (card.status === "draft") body = { action: "approve_rate_card", tenantId: "tenant-golden", rateCardId: CARD, expectedRevision: card.revision, reason: "Partner approves these rates only for bounded synthetic cost-governance testing; no external price is asserted.", idempotencyKey: `cost-approve-${crypto.randomUUID()}` };
    else {
      const next = usageFixtures[data?.usage.length ?? 0]; if (!next) { setMessage("All bounded synthetic usage fixtures are recorded."); return; }
      body = { action: "record_usage", tenantId: "tenant-golden", rateCardId: CARD, usageEntryId: `usage-${next.sourceId}`, matterId: "matter-golden-001", ...next, pricingState: "estimated", providerName: "Athena synthetic planning model", sourceType: "athena_measured", occurredAt: new Date().toISOString(), idempotencyKey: `cost-usage-${crypto.randomUUID()}` };
    }
    setPending(true); try { await request(body); setMessage("Cost-governance evidence advanced without claiming provider billing."); } catch (error) { setMessage(error instanceof Error ? error.message : "Operation failed"); } finally { setPending(false); }
  }
  if (!data) return <section className="panel operator-load"><BadgeDollarSign size={22}/><div><h2>Usage and cost governance</h2><p>Load rate provenance, tenant/workflow allocation, and estimate-versus-provider truth.</p><button className="secondary-action" onClick={() => void load()} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <BadgeDollarSign size={15}/>}Load cost evidence</button>{message && <p className="inline-message" role="status">{message}</p>}</div></section>;
  const card = data.rateCards.find((item) => item.id === CARD), done = data.usage.length >= usageFixtures.length;
  return <section className="panel operator-panel"><header><div><h2>Tenant and workflow cost attribution</h2><p>{data.limitation}</p></div><StatusPill tone={data.summary.providerVerifiedEntryCount ? "success" : "warning"}>{data.summary.providerVerifiedEntryCount ? "provider verified" : "estimates only"}</StatusPill></header>
    <dl><div><dt>Total modeled cost</dt><dd>{dollars(data.summary.totalCostMicros)}</dd></div><div><dt>Estimated entries</dt><dd>{data.summary.estimatedEntryCount}</dd></div><div><dt>Provider-verified entries</dt><dd>{data.summary.providerVerifiedEntryCount}</dd></div><div><dt>Rate source</dt><dd>{card?.sourceType ?? "none"}</dd></div></dl>
    {data.summary.byCategory.length > 0 && <ol>{data.summary.byCategory.map((item) => <li key={item.category}><strong>{item.category.replaceAll("_", " ")} · {dollars(item.costMicros)}</strong><small>{item.entryCount} governed usage {item.entryCount === 1 ? "entry" : "entries"}</small></li>)}</ol>}
    {!done && <button className="primary-action" onClick={() => void advance()} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <CheckCircle2 size={15}/>} {!card ? "Create synthetic rate card" : card.status === "draft" ? "Approve synthetic assumptions" : "Record next measured usage"}</button>}
    {message && <p className="inline-message" role="status">{message}</p>}
  </section>;
}
