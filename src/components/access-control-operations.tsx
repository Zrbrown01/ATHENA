"use client";

import { ClipboardCheck, KeyRound, LoaderCircle, ShieldX } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";

type Grant = { supportUserId: string; matterId: string; status: "active" | "revoked"; purpose: string; ticketReference: string; expiresAt: string; revision: number; revocationReason?: string | null };
type Review = { id: string; outcome: "certified" | "exceptions_noted"; snapshot: Record<string, number>; reviewerId: string; reviewedAt: string; notes: string };
type Projection = { grants: Grant[]; reviews: Review[]; limitation?: string; error?: string };
const SUPPORT_USER = "user-support-sandbox";

export function AccessControlOperations() {
  const [data, setData] = useState<Projection | null>(null), [pending, setPending] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null);
  async function load() { setPending("load"); setMessage(null); try { const r=await fetch("/api/admin/access-controls"); if(!r.ok) throw new Error("Access-control state could not be loaded."); setData(await r.json() as Projection); } catch(e){setMessage(e instanceof Error?e.message:"Load failed");} finally{setPending(null);} }
  async function operate(action: "grant"|"revoke"|"attest_review") {
    const current=data?.grants.find(g=>g.supportUserId===SUPPORT_USER&&g.matterId==="matter-golden-001"); setPending(action); setMessage(null);
    const body=action==="grant"?{action,tenantId:"tenant-golden",matterId:"matter-golden-001",supportUserId:SUPPORT_USER,purpose:"Investigate a synthetic archive retrieval failure without receiving matter content.",ticketReference:"SUP-SYNTH-1042",durationMinutes:60,idempotencyKey:`support-grant-${crypto.randomUUID()}`}
      :action==="revoke"?{action,tenantId:"tenant-golden",matterId:"matter-golden-001",supportUserId:SUPPORT_USER,reason:"Synthetic investigation completed; support scope is no longer required.",expectedRevision:current?.revision,idempotencyKey:`support-revoke-${crypto.randomUUID()}`}
      :{action,tenantId:"tenant-golden",periodStartedAt:"2026-08-01T00:00:00.000Z",periodEndedAt:"2026-08-20T23:59:59.000Z",outcome:"certified",notes:"Reviewed synthetic ethical walls, support grants, and content-free access decision counts.",idempotencyKey:`access-review-${crypto.randomUUID()}`};
    try{const r=await fetch("/api/admin/access-controls",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const result=await r.json() as Projection;if(!r.ok)throw new Error(result.error??"Operation failed");setData(result);setMessage(action==="grant"?"Time-boxed synthetic support grant recorded.":action==="revoke"?"Support grant revoked immediately.":"Access-review snapshot attested.");}catch(e){setMessage(e instanceof Error?e.message:"Operation failed");}finally{setPending(null);}
  }
  if(!data)return <section className="panel operator-load"><KeyRound size={22}/><div><h2>Support access and reviews</h2><p>Load time-boxed support scopes and prior access-review attestations.</p><button className="primary-action" type="button" onClick={()=>void load()} disabled={Boolean(pending)}>{pending?<LoaderCircle className="spin" size={15}/>:<KeyRound size={15}/>}Load access controls</button>{message&&<p className="inline-message">{message}</p>}</div></section>;
  const grant=data.grants.find(g=>g.supportUserId===SUPPORT_USER&&g.matterId==="matter-golden-001"),active=grant?.status==="active"&&new Date(grant.expiresAt)>new Date(),review=data.reviews[0];
  return <section className="panel operator-panel"><header><div><h2>Support access and review</h2><p>{data.limitation??"Matter-scoped control evidence only."}</p></div><StatusPill tone={active?"warning":"success"}>{active?"Time-boxed":"No active grant"}</StatusPill></header>{grant&&<p>{grant.ticketReference} · {grant.purpose} · expires {new Date(grant.expiresAt).toLocaleString()}</p>}{review&&<small>Latest review: {review.outcome} by {review.reviewerId} · {Object.entries(review.snapshot).map(([k,v])=>`${k}: ${v}`).join(" · ")}</small>}<div className="operator-actions">{active?<button className="secondary-action" type="button" onClick={()=>void operate("revoke")} disabled={Boolean(pending)}><ShieldX size={15}/>Revoke immediately</button>:<button className="primary-action" type="button" onClick={()=>void operate("grant")} disabled={Boolean(pending)}><KeyRound size={15}/>Grant 60-minute scope</button>}<button className="secondary-action" type="button" onClick={()=>void operate("attest_review")} disabled={Boolean(pending)}><ClipboardCheck size={15}/>Attest review snapshot</button></div>{message&&<p className="inline-message" role="status">{message}</p>}</section>;
}
