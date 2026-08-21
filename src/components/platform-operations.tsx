"use client";

import { Activity, ArchiveRestore, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";

interface Projection {
  outbox: { pending: number; leased: number; processed: number; deadLetter: number; oldestReadyAt: string | null; lastError: string | null };
  retention: { outcome: "retain" | "held" | "eligible_for_review"; reason: string; policyCode: string; policyVersion: number };
  deadline: { dueDate: string; ruleCode: string; ruleVersion: number; authorityCitation: string; trace: string[] };
  security: { access: { allowed: number; denied: number }; rateLimit: { activeWindows: number; throttledRequests: number; policy: string } };
  limitation: string;
}

export function PlatformOperations() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setPending("load"); setMessage(null);
    try {
      const response = await fetch("/api/operations/platform");
      if (!response.ok) throw new Error("Platform health could not be loaded.");
      setData(await response.json() as Projection);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Platform health could not be loaded."); }
    finally { setPending(null); }
  }

  async function operate(action: "publish_internal" | "replay_dead_letters") {
    setPending(action); setMessage(null);
    try {
      const response = await fetch("/api/operations/platform", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      if (!response.ok) throw new Error("The controlled platform operation failed.");
      const result = await response.json() as Projection & { result: { delivered?: number; replayed?: number } };
      setData(result);
      setMessage(action === "publish_internal" ? `${result.result.delivered ?? 0} internal events delivered.` : `${result.result.replayed ?? 0} dead letters replayed.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The controlled platform operation failed."); }
    finally { setPending(null); }
  }

  if (!data) return <section className="panel operator-load"><ShieldCheck size={22}/><div><h2>Owner-only operator controls</h2><p>Load tenant-scoped platform health before invoking a controlled operation.</p><button className="primary-action" type="button" onClick={() => void load()} disabled={pending !== null}>{pending ? <LoaderCircle className="spin" size={15}/> : <Activity size={15}/>}Load platform health</button>{message && <p className="inline-message">{message}</p>}</div></section>;

  return <div className="operator-grid">
    <section className="panel operator-panel"><header><div><h2>Transactional outbox</h2><p>{data.limitation}</p></div><StatusPill tone={data.outbox.deadLetter ? "danger" : data.outbox.pending ? "warning" : "success"}>{data.outbox.deadLetter ? "Attention" : data.outbox.pending ? "Ready" : "Healthy"}</StatusPill></header><dl><div><dt>Pending</dt><dd>{data.outbox.pending}</dd></div><div><dt>Leased</dt><dd>{data.outbox.leased}</dd></div><div><dt>Processed</dt><dd>{data.outbox.processed}</dd></div><div><dt>Dead letter</dt><dd>{data.outbox.deadLetter}</dd></div></dl><div className="operator-actions"><button className="primary-action" type="button" onClick={() => void operate("publish_internal")} disabled={pending !== null || data.outbox.pending === 0}><RefreshCw size={15}/>Publish ready internal events</button><button className="secondary-action" type="button" onClick={() => void operate("replay_dead_letters")} disabled={pending !== null || data.outbox.deadLetter === 0}><ArchiveRestore size={15}/>Replay dead letters</button></div>{data.outbox.lastError && <p className="inline-error">{data.outbox.lastError}</p>}</section>
    <section className="panel operator-panel"><header><div><h2>Retention guard</h2><p>{data.retention.policyCode}@{data.retention.policyVersion}</p></div><StatusPill tone="success">{data.retention.outcome}</StatusPill></header><p>{data.retention.reason}</p><small>No automated deletion path exists; legal holds override eligibility.</small></section>
    <section className="panel operator-panel"><header><div><h2>Deadline proof</h2><p>{data.deadline.ruleCode}@{data.deadline.ruleVersion}</p></div><StatusPill tone="info">Due {data.deadline.dueDate}</StatusPill></header><p>{data.deadline.authorityCitation}</p><ol>{data.deadline.trace.map((entry) => <li key={entry}>{entry}</li>)}</ol></section>
    <section className="panel operator-panel"><header><div><h2>Access and throttling</h2><p>{data.security.rateLimit.policy}</p></div><StatusPill tone={data.security.access.denied || data.security.rateLimit.throttledRequests ? "warning" : "success"}>{data.security.rateLimit.throttledRequests ? "Throttled" : "Enforced"}</StatusPill></header><dl><div><dt>Allowed</dt><dd>{data.security.access.allowed}</dd></div><div><dt>Denied</dt><dd>{data.security.access.denied}</dd></div><div><dt>Active windows</dt><dd>{data.security.rateLimit.activeWindows}</dd></div><div><dt>Throttled</dt><dd>{data.security.rateLimit.throttledRequests}</dd></div></dl><small>Counts contain identifiers and decision codes only; no matter content is stored in these controls.</small></section>
    {message && <p className="operator-message" role="status">{message}</p>}
  </div>;
}
