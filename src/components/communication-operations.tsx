"use client";

import { CheckCircle2, Inbox, Link2, LoaderCircle, MailWarning, Send, Undo2 } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";

type Thread = { id: string; subject: string; matterId?: string | null; associationStatus: string; messageCount: number; revision: number };
type Message = { id: string; threadId: string; direction: string; subject: string; status: string; providerMode: string; deliveryAttempted: boolean; revision: number; bodySha256: string };
type Attachment = { id: string; messageId: string; fileName: string; sha256: string; extractionStatus: string; matterId?: string | null };
type Candidate = { id: string; status: string; signals: string[]; confidenceBasis: string; targetMatterId?: string | null; revision: number };
type Mailbox = { id: string; mailboxAddress: string; status: string; providerMode: string; deltaCursor?: string | null; lastSuccessfulSyncAt?: string | null; grantedScopes: string[] };
type Projection = { mailboxes: Mailbox[]; threads: Thread[]; messages: Message[]; attachments: Attachment[]; candidates: Candidate[]; limitation?: string; error?: string };

const THREAD = "thread-referral-rivera-001";
const INBOUND = "message-referral-rivera-001";
const OUTBOUND = "message-rivera-update-001";
const CANDIDATE = "association-rivera-001";

export function CommunicationOperations() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setPending(true);
    try {
      const response = await fetch("/api/communications");
      const body = await response.json() as Projection;
      if (!response.ok) throw new Error(body.error ?? "Communications could not be loaded");
      setData(body);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Load failed");
    } finally { setPending(false); }
  }

  async function act(action: "materialize" | "file" | "undo" | "draft" | "approve" | "block") {
    const candidate = data?.candidates.find((item) => item.id === CANDIDATE);
    const outbound = data?.messages.find((item) => item.id === OUTBOUND);
    const shared = { tenantId: "tenant-golden", matterId: "matter-golden-001", idempotencyKey: `communication-${action}-${crypto.randomUUID()}` };
    const body = action === "materialize" ? {
      action: "materialize_fixture_inbound", ...shared, mailboxConnectionId: "mailbox-maya-fixture", threadId: THREAD,
      messageId: INBOUND, attachmentId: "attachment-referral-rivera-001", candidateId: CANDIDATE,
      mailboxAddress: "maya.chen@example.test", fromAddress: "jennifer.smith@example.test", toAddresses: ["maya.chen@example.test"],
      subject: "Rivera v. Northstar — referral and claim materials",
      bodyText: "Synthetic referral for Elena Rivera, claim SCS-CA-884103, ADJ18420931, employer Northstar Logistics. Please review and confirm representation.",
      receivedAt: "2026-08-20T17:12:00.000Z", attachmentFileName: "Rivera-referral.pdf", attachmentMimeType: "application/pdf",
      attachmentByteSize: 777, attachmentSha256: "8c89d4d1d074e36b766e524b54db100a47234476a128c697336d814923678fda", sandboxAcknowledged: true,
    } : action === "file" ? {
      action: "resolve_association", ...shared, candidateId: CANDIDATE, expectedRevision: candidate?.revision,
      decision: "file_to_matter", reason: "Attorney verified the exact claim, ADJ, applicant, and employer signals before filing.",
    } : action === "undo" ? {
      action: "undo_association", ...shared, candidateId: CANDIDATE, expectedRevision: candidate?.revision,
      reason: "Reviewer requested a reversible return to the association queue.",
    } : action === "draft" ? {
      action: "create_outbound_draft", ...shared, threadId: THREAD, messageId: OUTBOUND,
      toAddresses: ["jennifer.smith@example.test"], ccAddresses: [], subject: "Re: Rivera v. Northstar — referral and claim materials",
      bodyText: "Jennifer, we have preserved the synthetic referral and opened the matter-linked review. This draft remains inside Athena until attorney approval and a connected Microsoft delivery provider are available.",
    } : action === "approve" ? {
      action: "approve_outbound_draft", ...shared, threadId: THREAD, messageId: OUTBOUND, expectedRevision: outbound?.revision,
      reason: "Attorney reviewed the recipients, subject, message body, matter association, and attachment state.",
    } : {
      action: "record_delivery_block", ...shared, threadId: THREAD, messageId: OUTBOUND, expectedRevision: outbound?.revision,
      reason: "Microsoft app registration, tenant consent, mailbox authorization, and delivery reconciliation are unavailable.",
    };
    setPending(true);
    try {
      const response = await fetch("/api/communications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as Projection;
      if (!response.ok) throw new Error(result.error ?? "Communication operation failed");
      setData(result);
      setMessage(({ materialize: "Synthetic inbound message, thread, attachment metadata, and match candidate preserved.", file: "Thread and message filed to the verified matter.", undo: "Matter filing reversed; source records remain preserved.", draft: "Outbound draft preserved locally.", approve: "Attorney approval recorded.", block: "Retryable Microsoft handoff recorded as blocked—not sent." } as const)[action]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operation failed");
    } finally { setPending(false); }
  }

  if (!data) return <section className="panel operator-load"><Inbox size={22}/><div><h2>Durable communication lifecycle</h2><p>Load preserved threads, matter-association evidence, attachments, drafts, approvals, and delivery truth.</p><button className="secondary-action" onClick={() => void load()} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <Inbox size={15}/>}Load communication records</button>{message && <p className="inline-message" role="status">{message}</p>}</div></section>;

  const thread = data.threads.find((item) => item.id === THREAD);
  const candidate = data.candidates.find((item) => item.id === CANDIDATE);
  const outbound = data.messages.find((item) => item.id === OUTBOUND);
  const mailbox = data.mailboxes[0];
  const next = !thread ? "materialize" : candidate && ["pending", "undone"].includes(candidate.status) ? "file" : candidate?.status === "filed" && !outbound ? "draft" : outbound?.status === "draft" ? "approve" : outbound?.status === "approved" ? "block" : null;
  const labels = { materialize: "Preserve synthetic inbound", file: "File to verified matter", draft: "Create outbound draft", approve: "Approve outbound draft", block: "Record blocked handoff" } as const;

  return <section className="panel operator-panel"><header><div><h2>Durable communication lifecycle</h2><p>{data.limitation}</p></div><StatusPill tone={outbound?.status === "blocked_not_connected" ? "warning" : candidate?.status === "filed" ? "success" : "neutral"}>{outbound?.status ?? candidate?.status ?? "empty"}</StatusPill></header>
    {mailbox && <div className="truth-banner"><MailWarning size={17}/><div><strong>{mailbox.mailboxAddress} · {mailbox.status}</strong><p>No OAuth scopes, delta cursor, or successful sync timestamp are claimed.</p></div></div>}
    {thread && <ol><li><strong>{thread.subject}</strong><small>{thread.associationStatus} · {thread.messageCount} message{thread.messageCount === 1 ? "" : "s"} · matter {thread.matterId ?? "unfiled"}</small></li>{data.messages.filter((item) => item.threadId === THREAD).map((item) => <li key={item.id}><strong>{item.direction} · {item.status}</strong><small>SHA-256 {item.bodySha256.slice(0, 16)}… · provider {item.providerMode} · delivery attempted {String(item.deliveryAttempted)}</small></li>)}{data.attachments.filter((item) => item.messageId === INBOUND).map((item) => <li key={item.id}><strong>{item.fileName}</strong><small>{item.extractionStatus} · SHA-256 {item.sha256.slice(0, 16)}… · no downloaded bytes claimed</small></li>)}</ol>}
    {candidate && <p><strong>Association evidence:</strong> {candidate.signals.join(" · ")}<br/><small>{candidate.confidenceBasis}</small></p>}
    <div className="operator-actions">{next && <button className="primary-action" onClick={() => void act(next)} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : next === "block" ? <Send size={15}/> : next === "file" ? <Link2 size={15}/> : <CheckCircle2 size={15}/>} {labels[next]}</button>}{candidate?.status === "filed" && !outbound && <button className="secondary-action" onClick={() => void act("undo")} disabled={pending}><Undo2 size={15}/>Undo filing</button>}</div>
    {message && <p className="inline-message" role="status">{message}</p>}
  </section>;
}
