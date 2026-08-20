"use client";

import { CheckCircle2, LoaderCircle, RotateCcw, ShieldAlert, UserRoundCheck, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "./status-pill";

type Item = { id: string; title: string; requirement: string; dueAt: string; ownerId: string; status: "open" | "completed" | "cancelled"; revision: number; authorityCitation: string; calculation: string[]; completionEvidence?: string | null; cancellationReason?: string | null };
type Projection = { items: Item[]; rule: { code: string; version: number; authorityCitation: string; contentStatus: string } | null; limitation: string };

export function ObligationControl() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { const response = await fetch("/api/obligations"); if (!response.ok) throw new Error("Could not load obligations"); setData(await response.json()); }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/obligations").then(async (response) => {
      if (!response.ok) throw new Error("Could not load obligations");
      const projection = await response.json() as Projection;
      if (active) setData(projection);
    }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);

  async function command(action: "create" | "reassign" | "complete" | "cancel", item?: Item) {
    setPending(action); setError(null);
    const common = { action, tenantId: "tenant-golden", matterId: "matter-golden-001", idempotencyKey: `obligation-${action}-${crypto.randomUUID()}` };
    const body = action === "create" ? { ...common, ruleCode: "firm-pilot-qme-review", title: "Review source-linked QME findings", requirement: "Verify impairment, apportionment, and restrictions against QME pages 27–31 before client reporting.", triggerDate: "2026-08-20", triggerSourceType: "document", triggerSourceId: "fixture-qme-rivera-20260818", ownerId: "user-maya-chen", sandboxAcknowledged: true }
      : action === "reassign" ? { ...common, obligationId: item!.id, expectedRevision: item!.revision, ownerId: "user-sara-kim", reason: "Docketing coverage reassignment for the pilot review." }
      : action === "complete" ? { ...common, obligationId: item!.id, expectedRevision: item!.revision, evidence: "Attorney verified the source-linked findings on QME pages 27–31." }
      : { ...common, obligationId: item!.id, expectedRevision: item!.revision, reason: "Pilot trigger was entered in error; no legal deadline was cancelled." };
    try { const response = await fetch("/api/obligations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error ?? "Command failed"); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Command failed"); }
    finally { setPending(null); }
  }

  if (!data) return <section className="panel approval-strip"><LoaderCircle className="spin" size={18}/><p>Loading durable obligations…</p>{error && <small role="alert">{error}</small>}</section>;
  const item = data.items[0];
  return <section className="panel operator-panel" aria-labelledby="obligation-title">
    <header><div><span className="eyebrow">DURABLE OBLIGATION</span><h2 id="obligation-title">QME review control</h2><p>{data.rule?.code}@{data.rule?.version} · {data.rule?.contentStatus.replaceAll("_", " ")}</p></div><StatusPill tone={item?.status === "completed" ? "success" : item?.status === "cancelled" ? "danger" : "warning"}>{item?.status ?? "Not created"}</StatusPill></header>
    <div className="truth-banner"><ShieldAlert size={18}/><div><strong>Synthetic policy boundary</strong><p>{data.limitation}</p></div></div>
    {!item ? <button className="primary-action" type="button" disabled={Boolean(pending)} onClick={() => command("create")}>{pending ? <LoaderCircle className="spin" size={15}/> : <CheckCircle2 size={15}/>}Create pilot obligation</button> : <>
      <p><strong>{item.title}</strong> — {item.requirement}</p><p>Owner: {item.ownerId} · Due {new Date(item.dueAt).toLocaleDateString()} · Revision {item.revision}</p>
      <ol>{item.calculation.map((step) => <li key={step}>{step}</li>)}</ol>
      {item.completionEvidence && <p><strong>Completion evidence:</strong> {item.completionEvidence}</p>}{item.cancellationReason && <p><strong>Cancellation reason:</strong> {item.cancellationReason}</p>}
      {item.status === "open" && <div className="decision-control"><button className="secondary-action" type="button" disabled={Boolean(pending)} onClick={() => command("reassign", item)}><UserRoundCheck size={15}/>Reassign</button><button className="primary-action" type="button" disabled={Boolean(pending)} onClick={() => command("complete", item)}><CheckCircle2 size={15}/>Complete with evidence</button><button className="secondary-action" type="button" disabled={Boolean(pending)} onClick={() => command("cancel", item)}><XCircle size={15}/>Cancel with reason</button></div>}
      {item.status !== "open" && <button className="secondary-action" type="button" onClick={() => load()}><RotateCcw size={15}/>Refresh evidence</button>}
    </>}
    {error && <small role="alert">{error}</small>}
  </section>;
}
