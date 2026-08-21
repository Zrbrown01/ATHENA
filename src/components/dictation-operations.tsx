"use client";
import { CheckCircle2, LoaderCircle, Mic2 } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";

type Projection = {
  items: Array<{ id: string; title: string; status: string; revision: number; providerMode: string; templateVersion: string | null; workProductId: string | null; candidateTimeId: string | null }>;
  artifacts: Array<{ id: string; sessionId: string; artifactType: string; title: string; sha256: string; status: string }>;
  times: Array<{ id: string; runId: string; minutes: number; narrative: string; status: string; confirmedBy: string }>;
  limitation?: string;
  error?: string;
};
const SESSION_ID = "dictation-rivera-sandbox-001";
const shared = { tenantId: "tenant-golden", matterId: "matter-golden-001", sessionId: SESSION_ID };

export function DictationOperations() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function request(body?: Record<string, unknown>) {
    const response = await fetch("/api/verbatim", { method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json() as Projection;
    if (!response.ok) throw new Error(payload.error ?? "Operation failed");
    setData(payload);
  }
  async function load() {
    setPending(true);
    try { await request(); } catch (error) { setMessage(error instanceof Error ? error.message : "Load failed"); } finally { setPending(false); }
  }
  async function advance() {
    const session = data?.items.find((item) => item.id === SESSION_ID);
    const idempotencyKey = `dictation-${crypto.randomUUID()}`;
    let body: Record<string, unknown>;
    if (!session) body = {
      action: "capture_session", ...shared, idempotencyKey, title: "Rivera QME client report", workProductType: "client_report",
      durationSeconds: 183, audioArtifactId: "dictation-audio-rivera-001", audioSha256: "a1".repeat(32),
      consentEvidence: "Attorney confirmed recording consent and use of an explicitly synthetic, non-production audio metadata fixture.", syntheticDataAcknowledged: true,
    };
    else {
      const base = { ...shared, idempotencyKey, expectedRevision: session.revision };
      if (session.status === "captured") body = { action: "attempt_transcription", ...base, reason: "Record the honest Verbatim connection block without transmitting audio or making a provider call." };
      else if (session.status === "provider_blocked") body = { action: "materialize_synthetic_transcript", ...base, transcriptArtifactId: "dictation-transcript-rivera-001", content: "Synthetic dictation transcript: QME findings remain under attorney review. Prepare the client report with source limitations stated and do not represent this fixture as medical evidence.", syntheticDataAcknowledged: true };
      else if (session.status === "transcript_ready") body = { action: "apply_template", ...base, draftArtifactId: "dictation-draft-rivera-001", transcriptArtifactId: "dictation-transcript-rivera-001", templateId: "client-report-standard", templateVersion: "1.0", body: "CLIENT REPORT — SYNTHETIC FIXTURE\n\nThe QME findings remain under attorney review. This deterministic draft proves source linkage, template versioning, and governed review only; it is not legal or medical advice." };
      else if (session.status === "templated") body = { action: "submit_review", ...base, reason: "Submitted the source-linked templated draft to the attorney review queue." };
      else if (session.status === "in_review") body = { action: "approve_work_product", ...base, reason: "Attorney reviewed the source checksum, template version, synthetic limitations, and approved this fixture." };
      else if (session.status === "approved") body = { action: "confirm_time", ...base, candidateTimeId: "dictation-time-rivera-001", minutes: 12, narrative: "Review and approve synthetic QME client report dictation workflow", taskCode: "L120", activityCode: "A104", reason: "Attorney explicitly confirmed twelve minutes after reviewing the generated time evidence." };
      else body = { action: "file_to_matter", ...base, workProductId: "dictation-work-product-rivera-001", reason: "Attorney filed the approved, source-linked synthetic work product to the golden matter." };
    }
    setPending(true);
    try { await request(body); setMessage("Dictation evidence advanced."); } catch (error) { setMessage(error instanceof Error ? error.message : "Operation failed"); } finally { setPending(false); }
  }
  if (!data) return <section className="panel operator-load"><Mic2 size={22}/><div><h2>Verbatim dictation operations</h2><p>Load capture, transcription truth, template, review, approval, time, and filing evidence.</p><button className="secondary-action" onClick={() => void load()} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <Mic2 size={15}/>}Load dictation</button>{message && <p className="inline-message">{message}</p>}</div></section>;
  const session = data.items.find((item) => item.id === SESSION_ID);
  const draft = data.artifacts.find((item) => item.sessionId === SESSION_ID && item.artifactType === "templated_draft");
  const time = data.times.find((item) => item.runId === SESSION_ID);
  return <section className="panel operator-panel"><header><div><h2>Governed dictation lifecycle</h2><p>{data.limitation}</p></div><StatusPill tone={session?.status === "filed" ? "success" : session?.status === "provider_blocked" ? "warning" : "info"}>{session?.status ?? "not started"}</StatusPill></header>
    {session && <dl><div><dt>Provider</dt><dd>{session.providerMode}</dd></div><div><dt>Revision</dt><dd>{session.revision}</dd></div><div><dt>Template</dt><dd>{session.templateVersion ?? "—"}</dd></div><div><dt>Time</dt><dd>{time ? `${time.minutes}m` : "—"}</dd></div></dl>}
    {draft && <p><strong>{draft.title}</strong> · {draft.status}<br/><small>SHA-256 {draft.sha256}</small></p>}
    {session?.workProductId && <p><strong>Matter work product:</strong> {session.workProductId}</p>}
    {session?.status !== "filed" && <button className="primary-action" onClick={() => void advance()} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <CheckCircle2 size={15}/>}Advance synthetic lifecycle</button>}
    {message && <p className="inline-message" role="status">{message}</p>}
  </section>;
}
