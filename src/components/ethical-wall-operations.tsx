"use client";

import { LoaderCircle, ShieldOff, ShieldPlus } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";

type Wall = { targetUserId?: never; userId: string; status: "active" | "released"; reason: string; revision: number; placedBy: string; effectiveAt: string; releasedBy?: string | null; releasedAt?: string | null; releaseReason?: string | null };
type Projection = { items: Wall[]; limitation: string };
const TARGET = "user-restricted-reviewer";

export function EthicalWallOperations() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function load() { setPending("load"); setMessage(null); try { const response = await fetch("/api/admin/ethical-walls"); if (!response.ok) throw new Error("Ethical-wall state could not be loaded."); setData(await response.json() as Projection); } catch(e) { setMessage(e instanceof Error ? e.message : "Load failed"); } finally { setPending(null); } }
  async function operate(action: "place" | "release") {
    const current = data?.items.find((item) => item.userId === TARGET);
    setPending(action); setMessage(null);
    const body = action === "place" ? { action, tenantId: "tenant-golden", matterId: "matter-golden-001", targetUserId: TARGET, reason: "Synthetic conflict screen requires restricted matter access for isolation testing.", idempotencyKey: `wall-place-${crypto.randomUUID()}` }
      : { action, tenantId: "tenant-golden", matterId: "matter-golden-001", targetUserId: TARGET, reason: "Synthetic conflict cleared after documented partner review.", expectedRevision: current?.revision, idempotencyKey: `wall-release-${crypto.randomUUID()}` };
    try { const response = await fetch("/api/admin/ethical-walls", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json() as Projection & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Operation failed"); setData(result); setMessage(action === "place" ? "Ethical wall placed and isolation event recorded." : "Ethical wall released with reason and actor evidence."); } catch(e) { setMessage(e instanceof Error ? e.message : "Operation failed"); } finally { setPending(null); }
  }
  if (!data) return <section className="panel operator-load"><ShieldOff size={22}/><div><h2>Ethical-wall administration</h2><p>Load the tenant-scoped policy before placing or releasing the synthetic reviewer wall.</p><button className="primary-action" type="button" onClick={() => void load()} disabled={Boolean(pending)}>{pending ? <LoaderCircle className="spin" size={15}/> : <ShieldPlus size={15}/>}Load access policy</button>{message && <p className="inline-message">{message}</p>}</div></section>;
  const current = data.items.find((item) => item.userId === TARGET);
  const active = current?.status === "active";
  return <section className="panel operator-panel"><header><div><h2>Ethical wall</h2><p>{TARGET} · Rivera golden matter</p></div><StatusPill tone={active ? "danger" : "success"}>{active ? "Blocked" : "Clear"}</StatusPill></header><p>{current?.reason ?? data.limitation}</p>{current && <small>Revision {current.revision} · placed by {current.placedBy}</small>}<div className="operator-actions">{active ? <button className="secondary-action" type="button" disabled={Boolean(pending)} onClick={() => void operate("release")}><ShieldOff size={15}/>Release with evidence</button> : <button className="primary-action" type="button" disabled={Boolean(pending)} onClick={() => void operate("place")}><ShieldPlus size={15}/>Place ethical wall</button>}</div>{message && <p className="inline-message" role="status">{message}</p>}</section>;
}
