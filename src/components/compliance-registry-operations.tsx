"use client";
import { BadgeCheck, CheckCircle2, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";
type P = {
  vendors: Array<{
    id: string;
    name: string;
    service: string;
    status: string;
    revision: number;
    dataRegions: string[];
    dataCategories: string[];
    trainingUse: string;
    providerConnected: boolean;
  }>;
  reviews: Array<{
    id: string;
    outcome: string;
    validUntil: string;
    controlsReviewed: string[];
  }>;
  agreements: Array<{
    id: string;
    agreementType: string;
    status: string;
    artifactRef: string;
  }>;
  authorities: Array<{
    id: string;
    status: string;
    allowedDataCategories: string[];
    trainingUseProhibited: boolean;
  }>;
  assessments: Array<{
    id: string;
    outcome: string;
    missingRequirements: string[];
    credentialActivationAllowed: boolean;
    providerConnected: boolean;
  }>;
  limitation?: string;
  error?: string;
};
const V = "subprocessor-ocr-synthetic-001";
async function digest(x: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x));
  return Array.from(new Uint8Array(b), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}
export function ComplianceRegistryOperations() {
  const [data, setData] = useState<P | null>(null),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  async function load() {
    setPending(true);
    try {
      const r = await fetch("/api/admin/compliance-registry"),
        x = (await r.json()) as P;
      if (!r.ok) throw new Error(x.error ?? "Load failed");
      setData(x);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setPending(false);
    }
  }
  async function act() {
    const v = data?.vendors.find((x) => x.id === V),
      review = data?.reviews.find(
        (x) => x.id === "vendor-review-ocr-synthetic-001",
      ),
      baa = data?.agreements.find((x) => x.agreementType === "baa"),
      dpa = data?.agreements.find((x) => x.agreementType === "dpa"),
      dua = data?.authorities.find(
        (x) => x.id === "data-use-ocr-synthetic-001",
      ),
      shared = {
        tenantId: "tenant-golden",
        subprocessorId: V,
        idempotencyKey: `compliance-${crypto.randomUUID()}`,
      };
    let body: Record<string, unknown>;
    if (!v)
      body = {
        action: "register_candidate",
        ...shared,
        name: "Synthetic OCR provider candidate",
        service: "Optical character recognition",
        dataRegions: ["United States — unverified fixture"],
        dataCategories: ["medical-sensitive", "privileged"],
        usesAi: true,
        trainingUse: "unknown",
        ownerId: "user-maya-chen",
        syntheticAcknowledged: true,
      };
    else if (!review) {
      const ref =
        "Synthetic security questionnaire fixture; not independent vendor evidence.";
      body = {
        action: "record_security_review",
        ...shared,
        expectedRevision: v.revision,
        reviewId: "vendor-review-ocr-synthetic-001",
        outcome: "pass",
        controlsReviewed: [
          "access control",
          "encryption",
          "incident response",
          "subprocessor disclosure",
        ],
        evidenceRef: ref,
        evidenceSha256: await digest(ref),
        validUntil: new Date(Date.now() + 90 * 86400000).toISOString(),
      };
    } else if (!baa) {
      const ref =
        "Draft BAA placeholder; no signatures and not legally effective.";
      body = {
        action: "record_agreement",
        ...shared,
        expectedRevision: v.revision,
        agreementId: "baa-ocr-synthetic-draft",
        agreementType: "baa",
        status: "draft",
        effectiveAt: null,
        expiresAt: null,
        artifactRef: ref,
        artifactSha256: await digest(ref),
      };
    } else if (!dpa) {
      const ref =
        "Draft DPA placeholder; no signatures and not legally effective.";
      body = {
        action: "record_agreement",
        ...shared,
        expectedRevision: v.revision,
        agreementId: "dpa-ocr-synthetic-draft",
        agreementType: "dpa",
        status: "draft",
        effectiveAt: null,
        expiresAt: null,
        artifactRef: ref,
        artifactSha256: await digest(ref),
      };
    } else if (!dua)
      body = {
        action: "approve_data_use",
        ...shared,
        expectedRevision: v.revision,
        authorityId: "data-use-ocr-synthetic-001",
        purpose:
          "Permit only a future approved OCR provider to transform quarantined medical documents after malware release and matter authorization.",
        allowedDataCategories: ["medical-sensitive", "privileged"],
        allowedOperations: ["ocr_transform"],
        aiAllowed: false,
        trainingUseProhibited: true,
      };
    else
      body = {
        action: "assess_activation",
        ...shared,
        expectedRevision: v.revision,
        assessmentId: `activation-${crypto.randomUUID()}`,
        reason:
          "Evaluate contractual prerequisites separately from credentials, connectivity, and provider reconciliation.",
      };
    setPending(true);
    try {
      const r = await fetch("/api/admin/compliance-registry", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        x = (await r.json()) as P;
      if (!r.ok) throw new Error(x.error ?? "Compliance action failed");
      setData(x);
      setMessage("Compliance evidence advanced.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setPending(false);
    }
  }
  if (!data)
    return (
      <section className="panel operator-load">
        <BadgeCheck size={22} />
        <div>
          <h2>Provider compliance registry</h2>
          <p>
            Load subprocessors, security review, agreement, data-use, and
            activation-gate evidence.
          </p>
          <button
            className="secondary-action"
            onClick={() => void load()}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <BadgeCheck size={15} />
            )}
            Load compliance registry
          </button>
          {message && <p className="inline-message">{message}</p>}
        </div>
      </section>
    );
  const v = data.vendors.find((x) => x.id === V),
    a = data.assessments.at(-1),
    done = Boolean(a);
  return (
    <section className="panel operator-panel">
      <header>
        <div>
          <h2>Provider activation prerequisites</h2>
          <p>{data.limitation}</p>
        </div>
        <StatusPill
          tone={
            a?.outcome === "contractually_eligible"
              ? "success"
              : a
                ? "danger"
                : "info"
          }
        >
          {a?.outcome ?? v?.status ?? "not registered"}
        </StatusPill>
      </header>
      {v && (
        <p>
          <strong>{v.name}</strong> · {v.service}
          <br />
          <small>
            {v.dataCategories.join(" · ")} · training {v.trainingUse} · provider
            connected {String(v.providerConnected)}
          </small>
        </p>
      )}
      {data.reviews.map((x) => (
        <p key={x.id}>
          <strong>Security review · {x.outcome}</strong> · valid to{" "}
          {new Date(x.validUntil).toLocaleDateString()}
          <br />
          <small>{x.controlsReviewed.join(" · ")}</small>
        </p>
      ))}
      {data.agreements.map((x) => (
        <p key={x.id}>
          <strong>
            {x.agreementType.toUpperCase()} · {x.status}
          </strong>{" "}
          · {x.artifactRef}
        </p>
      ))}
      {data.authorities.map((x) => (
        <p key={x.id}>
          <strong>Data use · {x.status}</strong> · training prohibited{" "}
          {String(x.trainingUseProhibited)} ·{" "}
          {x.allowedDataCategories.join(" · ")}
        </p>
      ))}
      {a && (
        <div className="truth-banner">
          <BadgeCheck size={17} />
          <div>
            <strong>Activation {a.outcome}</strong>
            <p>
              Missing: {a.missingRequirements.join(" · ") || "none"}. Credential
              activation allowed {String(a.credentialActivationAllowed)} ·
              provider connected {String(a.providerConnected)}.
            </p>
          </div>
        </div>
      )}
      {!done && (
        <button
          className="primary-action"
          onClick={() => void act()}
          disabled={pending}
        >
          <CheckCircle2 size={15} />
          Advance compliance review
        </button>
      )}
      {message && (
        <p className="inline-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
