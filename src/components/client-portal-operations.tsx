"use client";
import { CheckCircle2, LoaderCircle, ShieldX, UserRoundCog } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";
type Projection = {
  requests: Array<{ id: string; contactName: string; contactEmail: string; status: string; revision: number; identityProviderMode: string; requestedExpiresAt: string; approvedBy: string | null }>;
  shareItems: Array<{ id: string; accessRequestId: string; title: string; labels: string[]; outcome: string; status: string; reasonCodes: string[] }>;
  decisions: Array<{ id: string; accessRequestId: string; action: string }>;
  limitation?: string; error?: string;
};
const ACCESS = "portal-access-rivera-001", shared = { tenantId: "tenant-golden", matterId: "matter-golden-001", accessRequestId: ACCESS };
export function ClientPortalOperations() {
  const [data, setData] = useState<Projection | null>(null), [pending, setPending] = useState(false), [message, setMessage] = useState<string | null>(null);
  async function request(body?: Record<string, unknown>) { const response = await fetch("/api/client-portal", { method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }); const payload = await response.json() as Projection; if (!response.ok) throw new Error(payload.error ?? "Operation failed"); setData(payload); }
  async function load() { setPending(true); try { await request(); } catch (error) { setMessage(error instanceof Error ? error.message : "Load failed"); } finally { setPending(false); } }
  async function advance() {
    const access = data?.requests.find((item) => item.id === ACCESS), shares = data?.shareItems.filter((item) => item.accessRequestId === ACCESS) ?? [], idempotencyKey = `portal-${crypto.randomUUID()}`;
    let body: Record<string, unknown>;
    if (!access) body = { action: "request_access", ...shared, idempotencyKey, clientOrganizationId: "organization-summit-claims", contactName: "Jennifer Smith", contactEmail: "jennifer.smith@example.test", purpose: "Review approved synthetic matter status summaries for the Rivera golden matter.", requestedExpiresAt: "2026-09-30T23:59:00.000Z", sandboxAcknowledged: true };
    else {
      const base = { ...shared, idempotencyKey, expectedRevision: access.revision };
      if (access.status === "requested") body = { action: "verify_identity", ...base, evidence: "Attorney manually verified the explicitly synthetic contact against the synthetic Summit Claims roster; no external identity assertion exists." };
      else if (access.status === "identity_verified") body = { action: "approve_access", ...base, reason: "Attorney approved time-bounded access design for one synthetic matter and one verified fixture contact." };
      else if (access.status === "approved" && shares.length === 0) body = { action: "evaluate_share_item", ...base, shareItemId: "portal-share-summary-rivera-001", resourceType: "report_summary", resourceId: "report-rivera-90-day-summary", title: "Approved 90-day client status summary", labels: ["internal"], reason: "Attorney selected a synthetic, approved client summary and evaluated external-sharing classification." };
      else if (access.status === "approved" && shares.length === 1) body = { action: "evaluate_share_item", ...base, shareItemId: "portal-share-medical-rivera-001", resourceType: "document", resourceId: "document-rivera-privileged-medical", title: "Privileged medical analysis", labels: ["privileged", "medical_sensitive"], reason: "Attorney evaluated a sensitive document to prove the external-sharing policy hard stop." };
      else if (access.status === "approved") body = { action: "attempt_activation", ...base, reason: "Record the honest external identity and portal-session block without sending an invitation or enabling login." };
      else body = { action: "revoke_access", ...base, reason: "Attorney revoked the synthetic access design and every previously approved share item." };
    }
    setPending(true); try { await request(body); setMessage("Client portal control evidence advanced."); } catch (error) { setMessage(error instanceof Error ? error.message : "Operation failed"); } finally { setPending(false); }
  }
  if (!data) return <section className="panel operator-load"><UserRoundCog size={22}/><div><h2>Client portal access controls</h2><p>Load identity, approval, sharing policy, activation truth, and revocation evidence.</p><button className="secondary-action" onClick={() => void load()} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <UserRoundCog size={15}/>}Load portal controls</button>{message && <p className="inline-message">{message}</p>}</div></section>;
  const access = data.requests.find((item) => item.id === ACCESS), shares = data.shareItems.filter((item) => item.accessRequestId === ACCESS);
  return <section className="panel operator-panel"><header><div><h2>Governed external-access boundary</h2><p>{data.limitation}</p></div><StatusPill tone={access?.status === "revoked" ? "success" : access?.status === "activation_blocked" ? "warning" : "info"}>{access?.status ?? "not requested"}</StatusPill></header>
    {access && <p><strong>{access.contactName}</strong> · {access.contactEmail} · identity {access.identityProviderMode} · revision {access.revision}</p>}
    {shares.length > 0 && <ol>{shares.map((item) => <li key={item.id}><strong>{item.title} · {item.outcome}</strong><small>{item.labels.join(", ")} · {item.status} · {item.reasonCodes.join(", ")}</small></li>)}</ol>}
    {access?.status === "activation_blocked" && <div className="truth-banner"><ShieldX size={17}/><div><strong>No external login or invitation exists</strong><p>The identity handoff stopped before transmission.</p></div></div>}
    {access?.status !== "revoked" && <button className="primary-action" onClick={() => void advance()} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <CheckCircle2 size={15}/>}Advance synthetic controls</button>}
    {message && <p className="inline-message" role="status">{message}</p>}
  </section>;
}
