"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";

type Projection = {
  incidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    revision: number;
    systems: string[];
    informationCategories: string[];
    suspectedAccess: boolean;
    confirmedAccess: boolean;
    providerMode: string;
  }>;
  actions: Array<{
    id: string;
    incidentId: string;
    actionType: string;
    summary: string;
    providerMode: string;
    externalOperation: boolean;
    evidenceRef: string;
  }>;
  assessments: Array<{
    id: string;
    incidentId: string;
    conclusion: string;
    notificationDecision: string;
    privilegeRestricted: boolean;
    contractualDeadlines: Array<{
      obligation: string;
      dueAt: string;
      source: string;
    }>;
  }>;
  controls: Array<{
    id: string;
    code: string;
    title: string;
    status: string;
    revision: number;
    nextReviewAt: string;
  }>;
  evidence: Array<{
    id: string;
    controlId: string;
    title: string;
    outcome: string;
    sha256: string;
    validUntil: string;
  }>;
  risks: Array<{
    id: string;
    title: string;
    status: string;
    revision: number;
    inherentScore: number;
    residualScore: number;
  }>;
  treatments: Array<{
    id: string;
    riskId: string;
    strategy: string;
    status: string;
    dueAt: string;
    controlIds: string[];
  }>;
  limitation?: string;
  error?: string;
};

const INCIDENT = "incident-tabletop-001",
  CONTROL = "control-tenant-isolation-001",
  RISK = "risk-persistence-isolation-001";

export function SecurityOperations() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setPending(true);
    try {
      const response = await fetch("/api/admin/security-operations");
      const projection = (await response.json()) as Projection;
      if (!response.ok)
        throw new Error(
          projection.error ?? "Security operations could not be loaded",
        );
      setData(projection);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Load failed");
    } finally {
      setPending(false);
    }
  }

  async function submit(body: Record<string, unknown>, success: string) {
    setPending(true);
    try {
      const response = await fetch("/api/admin/security-operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const projection = (await response.json()) as Projection;
      if (!response.ok)
        throw new Error(projection.error ?? "Security operation failed");
      setData(projection);
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setPending(false);
    }
  }

  async function advanceIncident() {
    const incident = data?.incidents.find((item) => item.id === INCIDENT);
    const shared = {
      tenantId: "tenant-golden",
      incidentId: INCIDENT,
      idempotencyKey: `incident-${crypto.randomUUID()}`,
    };
    let body: Record<string, unknown>;
    switch (incident?.status) {
      case undefined:
        body = {
          action: "create_incident",
          ...shared,
          title: "Synthetic tenant-isolation tabletop",
          detectedAt: new Date().toISOString(),
          detectionSource:
            "Manual tabletop scenario; no production alert or customer data is involved.",
          severity: "high",
          systems: ["Athena persistence boundary"],
          affectedTenantIds: ["tenant-golden"],
          affectedMatterIds: [],
          informationCategories: ["privileged", "medical-sensitive"],
          suspectedAccess: true,
          confirmedAccess: false,
          incidentLead: "user-maya-chen",
        };
        break;
      case "detected":
        body = {
          action: "scope_incident",
          ...shared,
          expectedRevision: incident!.revision,
          systems: ["Athena persistence boundary", "event ledger"],
          affectedTenantIds: ["tenant-golden"],
          affectedMatterIds: [],
          informationCategories: ["privileged", "medical-sensitive"],
          suspectedAccess: true,
          confirmedAccess: false,
          evidencePreservationRef: "synthetic-tabletop:evidence-manifest-001",
          scopeSummary:
            "Scoped the synthetic scenario to persistence authorization and verified that no production tenants or matters exist in the exercise.",
        };
        break;
      case "scoped":
        body = {
          action: "contain_incident",
          ...shared,
          expectedRevision: incident.revision,
          containmentSummary:
            "Paused the synthetic exercise path and preserved its tenant-isolation test evidence.",
          containmentEvidenceRef: "synthetic-tabletop:containment-001",
          sessionRevocationMode: "not_connected",
          sessionRevocationEvidence:
            "Automatic identity-provider revocation is not connected; no external revocation was attempted.",
        };
        break;
      case "contained":
        body = {
          action: "assess_breach",
          ...shared,
          expectedRevision: incident.revision,
          assessmentId: "breach-assessment-tabletop-001",
          conclusion: "undetermined",
          legalAnalysis:
            "Synthetic tabletop only. No legal conclusion is made; counsel must assess any real incident using verified facts and obligations.",
          notificationDecision: "pending",
          contractualDeadlines: [],
          privilegeRestricted: true,
        };
        break;
      case "legal_review":
        body = {
          action: "begin_recovery",
          ...shared,
          expectedRevision: incident.revision,
          recoverySummary:
            "Re-ran the tenant-isolation boundary test and compared the event/outbox evidence for the synthetic exercise.",
          recoveryEvidenceRef: "synthetic-tabletop:recovery-test-001",
          restorationVerified: true,
        };
        break;
      case "recovering":
        body = {
          action: "record_root_cause",
          ...shared,
          expectedRevision: incident.revision,
          rootCause:
            "Tabletop hypothesis: a missing tenant predicate at a persistence boundary could expose cross-tenant records.",
          correctiveAction:
            "Require tenant predicates, negative authorization tests, event evidence, and reviewer approval for every new persistence surface.",
          correctiveActionEvidenceRef:
            "synthetic-tabletop:corrective-action-001",
        };
        break;
      default:
        body = {
          action: "close_incident",
          ...shared,
          expectedRevision: incident!.revision,
          closureApproval:
            "Partner approves closure of this synthetic tabletop exercise only.",
          effectivenessReview:
            "The tenant-isolation control evidence passed; repeat testing remains due on the recorded cadence.",
        };
    }
    await submit(body, "Synthetic incident exercise advanced.");
  }

  async function advanceControl() {
    const control = data?.controls.find((item) => item.id === CONTROL);
    const shared = {
      tenantId: "tenant-golden",
      controlId: CONTROL,
      idempotencyKey: `control-${crypto.randomUUID()}`,
    };
    if (!control)
      return submit(
        {
          action: "register_control",
          ...shared,
          code: "AC-TENANT-01",
          title: "Tenant-bound persistence authorization",
          controlFamily: "Access control",
          ownerId: "user-maya-chen",
          description:
            "Every durable query and command must bind tenant identity and reject foreign-tenant access before persistence.",
          reviewCadenceDays: 90,
        },
        "Security control registered.",
      );
    const evidenceText =
      "Athena full suite: tenant-bound domain and API negative tests";
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(evidenceText),
    );
    const hash = Array.from(new Uint8Array(bytes), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return submit(
      {
        action: "attach_control_evidence",
        ...shared,
        expectedRevision: control.revision,
        evidenceId: `control-evidence-${crypto.randomUUID()}`,
        evidenceType: "test_result",
        title: "Tenant-bound negative authorization test",
        evidenceRef: evidenceText,
        evidenceSha256: hash,
        outcome: "pass",
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      },
      "Control evidence attached and control verified.",
    );
  }

  async function advanceRisk() {
    const risk = data?.risks.find((item) => item.id === RISK);
    const shared = {
      tenantId: "tenant-golden",
      riskId: RISK,
      idempotencyKey: `risk-${crypto.randomUUID()}`,
    };
    if (!risk)
      return submit(
        {
          action: "register_risk",
          ...shared,
          title: "Pilot persistence lacks database-enforced tenant isolation",
          category: "Multi-tenant authorization",
          description:
            "D1 queries are tenant scoped in application code, but PostgreSQL row-level security and independent multi-principal validation remain incomplete.",
          likelihood: 3,
          impact: 5,
          ownerId: "user-maya-chen",
        },
        "Security risk registered.",
      );
    return submit(
      {
        action: "plan_risk_treatment",
        ...shared,
        expectedRevision: risk.revision,
        treatmentId: "risk-treatment-persistence-001",
        strategy: "mitigate",
        actionPlan:
          "Complete PostgreSQL RLS policy enforcement, multi-principal isolation tests, and an independent control review before multi-tenant production use.",
        controlIds: [CONTROL],
        ownerId: "user-maya-chen",
        dueAt: new Date(Date.now() + 60 * 86_400_000).toISOString(),
        residualScore: 10,
        approvalEvidence:
          "Partner-approved pilot restriction: remain owner-only until the treatment evidence passes.",
      },
      "Risk treatment recorded.",
    );
  }

  if (!data)
    return (
      <section className="panel operator-load">
        <ShieldCheck size={22} />
        <div>
          <h2>Security operations register</h2>
          <p>
            Load incident, breach assessment, security-control evidence, and
            risk-treatment records.
          </p>
          <button
            className="secondary-action"
            onClick={() => void load()}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <ClipboardCheck size={15} />
            )}
            Load security operations
          </button>
          {message && (
            <p className="inline-message" role="status">
              {message}
            </p>
          )}
        </div>
      </section>
    );
  const incident = data.incidents.find((item) => item.id === INCIDENT),
    control = data.controls.find((item) => item.id === CONTROL),
    risk = data.risks.find((item) => item.id === RISK);
  return (
    <div className="simple-page">
      <section className="truth-banner">
        <AlertTriangle size={18} />
        <div>
          <strong>Provider truth boundary</strong>
          <p>{data.limitation}</p>
        </div>
      </section>
      <section className="panel operator-panel">
        <header>
          <div>
            <h2>Incident response workspace</h2>
            <p>
              A synthetic tabletop walks the required detection-to-closure
              sequence without claiming a real incident.
            </p>
          </div>
          <StatusPill tone={incident?.status === "closed" ? "success" : "info"}>
            {incident?.status ?? "not started"}
          </StatusPill>
        </header>
        {incident && (
          <>
            <p>
              <strong>{incident.title}</strong> · severity {incident.severity} ·
              suspected access {String(incident.suspectedAccess)} · confirmed
              access {String(incident.confirmedAccess)}
            </p>
            <p>
              <strong>Scope:</strong> {incident.systems.join(" · ")} ·{" "}
              {incident.informationCategories.join(" · ")}
            </p>
          </>
        )}
        {data.actions
          .filter((item) => item.incidentId === INCIDENT)
          .map((item) => (
            <p key={item.id}>
              <strong>{item.actionType}</strong> · {item.providerMode} ·
              external operation {String(item.externalOperation)}
              <br />
              <small>{item.summary}</small>
            </p>
          ))}
        {data.assessments
          .filter((item) => item.incidentId === INCIDENT)
          .map((item) => (
            <p key={item.id}>
              <strong>Privileged breach assessment:</strong> {item.conclusion} ·
              notification {item.notificationDecision} · restricted{" "}
              {String(item.privilegeRestricted)}
            </p>
          ))}
        {incident?.status !== "closed" && (
          <div className="operator-actions">
            <button
              className="primary-action"
              onClick={() => void advanceIncident()}
              disabled={pending}
            >
              <CheckCircle2 size={15} />
              Advance tabletop response
            </button>
          </div>
        )}
      </section>
      <div className="module-two-column">
        <section className="panel operator-panel">
          <header>
            <div>
              <h2>Security control evidence</h2>
              <p>
                Versioned control state with checksum-pinned evidence and a
                review expiry.
              </p>
            </div>
            <StatusPill
              tone={control?.status === "verified" ? "success" : "info"}
            >
              {control?.status ?? "not registered"}
            </StatusPill>
          </header>
          {control && (
            <p>
              <strong>
                {control.code} · {control.title}
              </strong>
              <br />
              <small>
                Next review{" "}
                {new Date(control.nextReviewAt).toLocaleDateString()}
              </small>
            </p>
          )}
          {data.evidence
            .filter((item) => item.controlId === CONTROL)
            .map((item) => (
              <p key={item.id}>
                <strong>
                  {item.title} · {item.outcome}
                </strong>
                <br />
                <small>
                  SHA-256 {item.sha256.slice(0, 16)}… · valid through{" "}
                  {new Date(item.validUntil).toLocaleDateString()}
                </small>
              </p>
            ))}
          {control?.status !== "verified" && (
            <button
              className="secondary-action"
              onClick={() => void advanceControl()}
              disabled={pending}
            >
              Advance control proof
            </button>
          )}
        </section>
        <section className="panel operator-panel">
          <header>
            <div>
              <h2>Risk register</h2>
              <p>
                Inherent and residual risk remain explicit, owned, and linked to
                treatment controls.
              </p>
            </div>
            <StatusPill
              tone={risk?.status === "treatment_planned" ? "success" : "info"}
            >
              {risk?.status ?? "not registered"}
            </StatusPill>
          </header>
          {risk && (
            <p>
              <strong>{risk.title}</strong>
              <br />
              <small>
                Inherent {risk.inherentScore} · residual {risk.residualScore}
              </small>
            </p>
          )}
          {data.treatments
            .filter((item) => item.riskId === RISK)
            .map((item) => (
              <p key={item.id}>
                <strong>
                  {item.strategy} · {item.status}
                </strong>
                <br />
                <small>
                  Due {new Date(item.dueAt).toLocaleDateString()} · controls{" "}
                  {item.controlIds.join(", ")}
                </small>
              </p>
            ))}
          {risk?.status === undefined || risk.status === "open" ? (
            <button
              className="secondary-action"
              onClick={() => void advanceRisk()}
              disabled={pending}
            >
              Advance risk treatment
            </button>
          ) : null}
        </section>
      </div>
      {message && (
        <p className="inline-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
