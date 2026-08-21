"use client";
import { CheckCircle2, LoaderCircle, UserCog } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";
type P = {
  connections: Array<{
    id: string;
    provider: string;
    providerMode: string;
    status: string;
  }>;
  identities: Array<{
    id: string;
    email: string;
    displayName: string;
    status: string;
    mfaState: string;
    sessionRevocationState: string;
    revision: number;
  }>;
  roleCatalog: Array<{
    id: string;
    code: string;
    title: string;
    permissions: string[];
    privileged: boolean;
  }>;
  assignments: Array<{
    id: string;
    identityId: string;
    roleDefinitionId: string;
    scopeType: string;
    matterId?: string | null;
    status: string;
    grantReason: string;
  }>;
  offboarding: Array<{
    id: string;
    identityId: string;
    status: string;
    revision: number;
    activeAssignmentCount: number;
    revokedAssignmentCount: number;
    sessionRevocationMode: string;
    sessionRevocationEvidence?: string | null;
  }>;
  limitation?: string;
  error?: string;
};
const ID = "identity-alex-rivera-fixture",
  RUN = "offboarding-alex-rivera-001";
export function DirectoryOperations() {
  const [data, setData] = useState<P | null>(null),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  async function load() {
    setPending(true);
    try {
      const r = await fetch("/api/admin/directory"),
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
    const identity = data?.identities.find((x) => x.id === ID),
      assignments =
        data?.assignments.filter(
          (x) => x.identityId === ID && x.status === "active",
        ) ?? [],
      run = data?.offboarding.find((x) => x.id === RUN),
      shared = {
        tenantId: "tenant-golden",
        identityId: ID,
        idempotencyKey: `identity-${crypto.randomUUID()}`,
      };
    let body: Record<string, unknown>;
    if (!identity)
      body = {
        action: "register_fixture_identity",
        ...shared,
        connectionId: "directory-entra-001",
        email: "alex.rivera@example.test",
        displayName: "Alex Rivera",
        fixtureAcknowledged: true,
      };
    else if (identity.status === "invited")
      body = {
        action: "activate_local_identity",
        ...shared,
        expectedRevision: identity.revision,
        reason:
          "Activated only inside the owner-only synthetic pilot; external identity and MFA remain unverified.",
      };
    else if (identity.status === "active" && !assignments.length)
      body = {
        action: "assign_role",
        ...shared,
        expectedRevision: identity.revision,
        assignmentId: "assignment-alex-attorney-001",
        roleCode: "attorney",
        scopeType: "matter",
        matterId: "matter-golden-001",
        grantReason:
          "Synthetic attorney access is limited to the golden matter for authorization testing.",
      };
    else if (identity.status === "active")
      body = {
        action: "start_offboarding",
        ...shared,
        expectedRevision: identity.revision,
        offboardingRunId: RUN,
        reason:
          "Synthetic departure exercise requires immediate suspension before downstream cleanup.",
      };
    else if (run?.status === "initiated")
      body = {
        action: "revoke_assignments",
        ...shared,
        expectedRevision: identity.revision,
        offboardingRunId: RUN,
        expectedRunRevision: run.revision,
        revocationEvidence:
          "Revoked every active Athena-native role assignment for the synthetic identity.",
      };
    else
      body = {
        action: "record_session_revocation",
        ...shared,
        expectedRevision: identity.revision,
        offboardingRunId: RUN,
        expectedRunRevision: run!.revision,
        mode: "not_connected",
        evidence:
          "Microsoft Entra is not connected; Athena recorded the unresolved session/token revocation block without claiming completion.",
      };
    setPending(true);
    try {
      const r = await fetch("/api/admin/directory", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        x = (await r.json()) as P;
      if (!r.ok) throw new Error(x.error ?? "Directory action failed");
      setData(x);
      setMessage("Directory evidence advanced.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setPending(false);
    }
  }
  if (!data)
    return (
      <section className="panel operator-load">
        <UserCog size={22} />
        <div>
          <h2>Identity and role administration</h2>
          <p>
            Load directory health, identities, immutable roles, assignments, and
            offboarding evidence.
          </p>
          <button
            className="secondary-action"
            onClick={() => void load()}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <UserCog size={15} />
            )}
            Load directory administration
          </button>
          {message && <p className="inline-message">{message}</p>}
        </div>
      </section>
    );
  const identity = data.identities.find((x) => x.id === ID),
    run = data.offboarding.find((x) => x.id === RUN),
    blocked = run?.status === "session_revocation_blocked";
  return (
    <div className="simple-page">
      <section className="truth-banner">
        <UserCog size={18} />
        <div>
          <strong>Enterprise directory is not connected</strong>
          <p>{data.limitation}</p>
        </div>
      </section>
      <section className="panel operator-panel">
        <header>
          <div>
            <h2>Directory identity lifecycle</h2>
            <p>
              {data.connections[0]?.provider ?? "Microsoft Entra"} ·{" "}
              {data.connections[0]?.providerMode ?? "not connected"}
            </p>
          </div>
          <StatusPill
            tone={
              blocked
                ? "danger"
                : identity?.status === "active"
                  ? "success"
                  : "info"
            }
          >
            {identity?.status ?? "not registered"}
          </StatusPill>
        </header>
        {identity && (
          <p>
            <strong>{identity.displayName}</strong> · {identity.email}
            <br />
            <small>
              MFA {identity.mfaState} · session revocation{" "}
              {identity.sessionRevocationState} · revision {identity.revision}
            </small>
          </p>
        )}
        <h3>Immutable role catalog</h3>
        <p>
          {data.roleCatalog
            .map((x) => `${x.title}${x.privileged ? " (privileged)" : ""}`)
            .join(" · ") || "Created with the first fixture identity."}
        </p>
        {data.assignments
          .filter((x) => x.identityId === ID)
          .map((x) => (
            <p key={x.id}>
              <strong>{x.status} assignment</strong> · {x.scopeType}
              {x.matterId ? ` ${x.matterId}` : ""}
              <br />
              <small>{x.grantReason}</small>
            </p>
          ))}
        {run && (
          <p>
            <strong>Offboarding:</strong> {run.status} · assignments{" "}
            {run.revokedAssignmentCount}/{run.activeAssignmentCount} revoked ·
            session mode {run.sessionRevocationMode}
            <br />
            <small>{run.sessionRevocationEvidence}</small>
          </p>
        )}
        {!blocked && identity?.status !== "offboarded" && (
          <button
            className="primary-action"
            onClick={() => void act()}
            disabled={pending}
          >
            <CheckCircle2 size={15} />
            Advance controlled identity lifecycle
          </button>
        )}
        {message && (
          <p className="inline-message" role="status">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
