"use client";
import { CheckCircle2, FileCheck2, LoaderCircle, MailWarning, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";
type Definition = { id: string; code: string; version: number; cadence: string; scheduleMode: string; contentStatus: string; requiredSections: string[] };
type Instance = { id: string; title: string; status: string; revision: number; sourceCoverageCount: number; unresolvedConflictCount: number; recipientAddresses: string[]; providerMode: string };
type Section = { id: string; reportInstanceId: string; title: string; position: number; bodySha256: string; sourceRecordIds: string[] };
type Validation = { id: string; outcome: string; sourceCoverageCount: number; checks: Array<{ code: string; status: string; explanation: string }> };
type Delivery = { id: string; status: string; providerMode: string; providerDeliveryAttempted: boolean; providerMessageId?: string | null };
type Projection = { definitions: Definition[]; instances: Instance[]; sections: Section[]; validations: Validation[]; deliveries: Delivery[]; limitation?: string; error?: string };
const REPORT = "report-rivera-90-day-001";
export function ReportingOperations() {
  const [data, setData] = useState<Projection | null>(null), [pending, setPending] = useState(false), [message, setMessage] = useState<string | null>(null);
  async function load() { setPending(true); try { const response = await fetch("/api/reports/lifecycle"), result = await response.json() as Projection; if (!response.ok) throw new Error(result.error ?? "Reports could not be loaded"); setData(result); } catch (error) { setMessage(error instanceof Error ? error.message : "Load failed"); } finally { setPending(false); } }
  async function act(action: "materialize" | "validate" | "approve" | "block") {
    const report = data?.instances.find((item) => item.id === REPORT), shared = { tenantId: "tenant-golden", matterId: "matter-golden-001", reportInstanceId: REPORT, idempotencyKey: `reporting-${action}-${crypto.randomUUID()}` };
    const sections = [
      { id: "report-section-identity-001", sectionCode: "matter_identity", title: "Matter identity", body: "Elena Rivera v. Northstar Logistics, claim SCS-CA-884103, ADJ18420931. This is deterministic synthetic pilot data.", sourceRecordIds: ["matter-golden-001", "claim-golden-001", "adj-golden-001"] },
      { id: "report-section-posture-001", sectionCode: "current_posture", title: "Current posture", body: "The synthetic matter is active with an MSC preparation workflow and an unresolved external-provider boundary.", sourceRecordIds: ["proceeding-msc-golden-001"] },
      { id: "report-section-medical-001", sectionCode: "medical_status", title: "Medical status", body: "The checksum-pinned synthetic QME source is preserved; no production OCR or AI conclusion is claimed.", sourceRecordIds: ["evidence-qme-golden-001"] },
      { id: "report-section-authority-001", sectionCode: "authority", title: "Authority", body: "The attorney-reviewed structured authority ledger is the controlling source; earlier candidates remain historical.", sourceRecordIds: ["authority-candidate-125k"] },
      { id: "report-section-events-001", sectionCode: "upcoming_events", title: "Upcoming events", body: "The local docket includes an MSC, a preparation dependency, reminders, and explicit conflict evidence.", sourceRecordIds: ["calendar-event-msc-001", "calendar-conflict-rivera-001"] },
      { id: "report-section-spend-001", sectionCode: "legal_spend", title: "Legal spend", body: "The synthetic invoice and payment lifecycle supplies integer-cent billed, collected, and realization evidence.", sourceRecordIds: ["invoice-golden-001"] },
    ];
    const body = action === "materialize" ? { action: "materialize_fixture_report", ...shared, definitionId: "report-definition-summit-90-day-v1", definitionCode: "SUMMIT-90-DAY", title: "90-day status — Rivera v. Northstar", dueAt: "2026-09-30T23:59:00.000Z", recipientAddresses: ["jennifer.smith@example.test"], sections, sandboxAcknowledged: true }
      : action === "validate" ? { action: "validate_report", ...shared, expectedRevision: report?.revision }
      : action === "approve" ? { action: "approve_report", ...shared, expectedRevision: report?.revision, reason: "Attorney reviewed every cited section, recipient, schedule intent, and validation result." }
      : { action: "record_delivery_block", ...shared, expectedRevision: report?.revision, deliveryId: "report-delivery-rivera-001", reason: "Microsoft delivery credentials, mailbox authorization, and delivery reconciliation remain unavailable." };
    setPending(true); try { const response = await fetch("/api/reports/lifecycle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), result = await response.json() as Projection; if (!response.ok) throw new Error(result.error ?? "Report operation failed"); setData(result); setMessage(({ materialize: "Versioned source-linked report draft preserved.", validate: "Required sections, ordering, citations, conflicts, and recipients passed validation.", approve: "Attorney approval recorded.", block: "Microsoft delivery recorded as blocked—not sent." } as const)[action]); } catch (error) { setMessage(error instanceof Error ? error.message : "Operation failed"); } finally { setPending(false); }
  }
  if (!data) return <section className="panel operator-load"><FileCheck2 size={22}/><div><h2>Governed report lifecycle</h2><p>Load versioned definitions, source-linked sections, validation, approval, and delivery evidence.</p><button className="secondary-action" onClick={() => void load()} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <FileCheck2 size={15}/>}Load report records</button>{message && <p className="inline-message" role="status">{message}</p>}</div></section>;
  const report = data.instances.find((item) => item.id === REPORT), definition = data.definitions[0], validation = data.validations.at(-1), delivery = data.deliveries.at(-1);
  const next = !report ? "materialize" : report.status === "draft" ? "validate" : report.status === "validated" ? "approve" : report.status === "approved" ? "block" : null;
  const labels = { materialize: "Materialize source-linked report", validate: "Validate governed report", approve: "Approve report", block: "Record blocked delivery" } as const;
  return <section className="panel operator-panel"><header><div><h2>Governed report lifecycle</h2><p>{data.limitation}</p></div><StatusPill tone={report?.status === "delivery_blocked" ? "warning" : report?.status === "approved" ? "success" : "neutral"}>{report?.status ?? "empty"}</StatusPill></header>
    {definition && <p><strong>{definition.code}@{definition.version}</strong> · cadence {definition.cadence} · {definition.scheduleMode} · {definition.contentStatus}</p>}
    {report && <><p><strong>{report.title}</strong> · {report.sourceCoverageCount} source links · {report.unresolvedConflictCount} unresolved conflicts · {report.recipientAddresses.length} recipient</p><ol>{data.sections.filter((section) => section.reportInstanceId === REPORT).map((section) => <li key={section.id}><strong>{section.position}. {section.title}</strong><small>{section.sourceRecordIds.length} source link(s) · SHA-256 {section.bodySha256.slice(0, 16)}…</small></li>)}</ol></>}
    {validation && <div className="truth-banner"><ShieldCheck size={17}/><div><strong>Validation {validation.outcome}</strong><p>{validation.checks.map((check) => `${check.code}:${check.status}`).join(" · ")}</p></div></div>}
    {delivery && <div className="truth-banner"><MailWarning size={17}/><div><strong>Microsoft delivery {delivery.status}</strong><p>Provider {delivery.providerMode} · attempted {String(delivery.providerDeliveryAttempted)} · provider message ID {delivery.providerMessageId ?? "none"}</p></div></div>}
    {next && <div className="operator-actions"><button className="primary-action" onClick={() => void act(next)} disabled={pending}>{pending ? <LoaderCircle className="spin" size={15}/> : <CheckCircle2 size={15}/>} {labels[next]}</button></div>}{message && <p className="inline-message" role="status">{message}</p>}
  </section>;
}
