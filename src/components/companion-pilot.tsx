"use client";

import { AlertTriangle, Check, Download, FileSearch, LoaderCircle, LockKeyhole, MailWarning, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { CompanionResponse } from "@/app/api/companion/route";
import type { CompanionAction, CompanionStage } from "@/domain/companion/run";
import { StatusPill } from "./status-pill";

const steps: { stage: Exclude<CompanionStage, "not_started">; title: string; detail: string; provider: string }[] = [
  { stage: "matter_imported", title: "Matter imported", detail: "Separate Matter, Claim, Injury, and ADJ identities preserved from a deterministic MerusCase-shaped record.", provider: "MerusCase sandbox" },
  { stage: "analysis_ready", title: "QME analysis ready", detail: "Classification and fixed OCR/extraction produce three exact-page candidate facts without invoking an external provider.", provider: "Deterministic processor" },
  { stage: "draft_ready", title: "Verbatim work product drafted", detail: "A source-linked QME analysis draft is created with a visible sandbox provider label.", provider: "Verbatim sandbox" },
  { stage: "report_approved", title: "Attorney approval recorded", detail: "An authenticated attorney or partner approves the client report and creates audit/event evidence.", provider: "Athena native" },
  { stage: "delivery_handoff_blocked", title: "Microsoft delivery handoff", detail: "The approved report is queued as retryable work but remains blocked—not sent—until Microsoft 365 is activated.", provider: "Microsoft 365 disconnected" },
  { stage: "time_confirmed", title: "Time and billing validated", detail: "1.2 hours are human-confirmed; the synthetic Summit rule version validates narrative and UTBMS codes.", provider: "Athena native" },
  { stage: "export_ready", title: "Auditable export ready", detail: "A tenant-scoped JSON manifest with sources, facts, events, time, limitations, and checksum is stored in R2.", provider: "Athena native" },
];

const actionLabels: Record<CompanionAction, string> = {
  import_matter: "Import deterministic matter",
  process_qme: "Run deterministic QME processing",
  create_verbatim_draft: "Create source-linked draft",
  approve_report: "Approve client report",
  queue_email: "Create Microsoft handoff",
  confirm_time: "Confirm time and validate billing",
  create_export: "Create auditable export",
};

export function CompanionPilot() {
  const [data, setData] = useState<CompanionResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/companion", { cache: "no-store" });
      if (!response.ok) throw new Error("The pilot state could not be loaded.");
      setData(await response.json() as CompanionResponse);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The pilot state could not be loaded."); }
  }

  async function advance() {
    if (!data?.nextAction) return;
    setPending(true); setError(null);
    try {
      const response = await fetch("/api/companion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: data.nextAction, idempotencyKey: `companion-${data.nextAction}-${crypto.randomUUID()}` }) });
      const payload = await response.json() as CompanionResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The workflow could not advance.");
      setData(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The workflow could not advance."); }
    finally { setPending(false); }
  }

  const currentIndex = data ? ["not_started", ...steps.map((step) => step.stage)].indexOf(data.stage) : 0;
  return <div className="companion-pilot">
    <div className="truth-banner"><LockKeyhole size={18}/><div><strong>Deterministic synthetic pilot</strong><p>This proves Athena’s records, approvals, events, billing validation, failure states, and export. It does not call MerusCase, OCR/AI, Verbatim, or Microsoft 365.</p></div></div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <section className="pilot-grid" aria-label="Release 1 workflow">
      <ol className="pilot-stepper">{steps.map((step, index) => {
        const complete = currentIndex > index;
        const current = currentIndex === index + 1;
        return <li key={step.stage} className={complete ? "complete" : current ? "current" : "pending"}><span className="step-marker">{complete ? <Check size={14}/> : index + 1}</span><div><div className="step-title"><strong>{step.title}</strong><StatusPill tone={complete ? "success" : current ? "info" : "neutral"}>{complete ? "Complete" : current ? "Current" : "Pending"}</StatusPill></div><p>{step.detail}</p><small>{step.provider}</small></div></li>;
      })}</ol>
      <aside className="panel pilot-control"><span className="eyebrow">CONTROLLED ACTION</span><h2>{data?.nextAction ? actionLabels[data.nextAction] : data ? "Release 1 pilot complete" : "Load persistent pilot state"}</h2>
        {!data && <><p>Load the tenant-scoped workflow state before running the first controlled transition.</p><button className="primary-action" type="button" onClick={() => void load()}>Load pilot state</button></>}
        {data?.nextAction && <><p>{actionHelp(data.nextAction)}</p><button className="primary-action" type="button" onClick={advance} disabled={pending}>{pending ? <><LoaderCircle className="spin" size={15}/>Recording…</> : actionLabels[data.nextAction]}</button></>}
        {data?.run?.handoff && <div className="pilot-result warning"><MailWarning size={17}/><span><strong>Delivery not sent</strong><small>{data.run.handoff.activationRequirement}</small></span></div>}
        {data?.run?.billing && <div className="pilot-result success"><ShieldCheck size={17}/><span><strong>Billing rule {data.run.billing.outcome}</strong><small>{data.run.billing.explanation}</small></span></div>}
        {data?.run?.exportJob && <a className="secondary-action export-link" href={`/api/exports/${data.run.exportJob.id}`}><Download size={15}/>Download verified pilot export</a>}
      </aside>
    </section>
    <section className="panel provenance-strip"><FileSearch size={19}/><div><strong>Source grounding</strong><p>QME pages 27, 29, and 31 remain linked to the impairment, restriction, and apportionment candidates. Every transition adds an actor-attributed event, audit record, and outbox item.</p></div><AlertTriangle size={18}/><div><strong>Release limitation</strong><p>The fixture contains no original PDF bytes. Real uploads remain quarantined until an approved malware scanner and OCR pipeline are connected.</p></div></section>
  </div>;
}

function actionHelp(action: CompanionAction) {
  if (action === "approve_report") return "This is a substantive human gate. Approval records your authenticated identity and makes the draft eligible for a delivery handoff.";
  if (action === "queue_email") return "This records recoverable outbound work. Because Microsoft 365 is disconnected, Athena will stop in a truthful blocked state.";
  if (action === "confirm_time") return "This is a financial human gate. Confirmation creates a time record and evaluates the versioned synthetic client billing rule.";
  if (action === "create_export") return "This creates a tenant-scoped, checksummed R2 export manifest and an authorized download record.";
  return "Run the next deterministic processor. Its provider mode and exact output are recorded for audit and export.";
}
