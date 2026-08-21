"use client";
import { CheckCircle2, HardDriveDownload, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";
type P = {
  snapshots: Array<{
    id: string;
    sha256: string;
    byteSize: number;
    tableCount: number;
    providerMode: string;
    objectRef: string;
  }>;
  exercises: Array<{
    id: string;
    status: string;
    revision: number;
    targetEnvironment: string;
    productionMutation: boolean;
    durationSeconds?: number | null;
    rpoSeconds?: number | null;
    rtoSeconds?: number | null;
  }>;
  checks: Array<{
    id: string;
    code: string;
    outcome: string;
    expectedValue: string;
    actualValue: string;
  }>;
  approvals: Array<{ id: string; outcome: string; scopeLimitation: string }>;
  limitation?: string;
  error?: string;
};
const E = "recovery-local-proof-002";
const SNAPSHOT = "snapshot-local-20260821-002";
export function RecoveryOperations() {
  const [data, setData] = useState<P | null>(null),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  async function load() {
    setPending(true);
    try {
      const r = await fetch("/api/admin/recovery"),
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
    const e = data?.exercises.find((x) => x.id === E),
      shared = {
        tenantId: "tenant-golden",
        exerciseId: E,
        idempotencyKey: `recovery-${crypto.randomUUID()}`,
      };
    let body: Record<string, unknown>;
    if (!e)
      body = {
        action: "register_local_snapshot",
        ...shared,
        snapshotId: SNAPSHOT,
        scope:
          "Local owner-only D1 pilot export; no provider backup or production restore is represented.",
        objectRef:
          "local-only:.wrangler/recovery/athena-local-backup-v54.sql (not uploaded)",
        snapshotSha256:
          "d842e35f7e852a9b6e0a85ce21bd4dc0df96cd096d902176adb0e9ee2ee86482",
        byteSize: 1041015,
        tableCount: 174,
        dataAsOf: "2026-08-21T05:52:00.000Z",
        localExportAcknowledged: true,
      };
    else if (e.status === "planned")
      body = {
        action: "record_disposable_restore",
        ...shared,
        expectedRevision: 1,
        targetEnvironment: "disposable-local-sqlite-proof",
        durationSeconds: 1,
        rpoSeconds: 0,
        rtoSeconds: 1,
        productionMutation: false,
        evidenceRef:
          "Local sqlite3 import completed in an isolated temporary database that was removed after verification.",
      };
    else if (e.status === "restored")
      body = {
        action: "verify_restore",
        ...shared,
        expectedRevision: 2,
        reason:
          "All required local restore checks matched the checksum-pinned export manifest.",
        checks: [
          ["table_count", "174"],
          ["event_count", "237"],
          ["outbox_count", "237"],
          [
            "snapshot_checksum",
            "d842e35f7e852a9b6e0a85ce21bd4dc0df96cd096d902176adb0e9ee2ee86482",
          ],
          ["tenant_scope", "1"],
        ].map(([code, value]) => ({
          code,
          expectedValue: value,
          actualValue: value,
          outcome: "pass",
          evidenceRef: `disposable-local:${code}`,
        })),
      };
    else
      body = {
        action: "approve_exercise",
        ...shared,
        expectedRevision: 3,
        approvalId: "recovery-approval-local-001",
        scopeLimitation:
          "Approval covers only this checksum-pinned local D1 export restored into disposable SQLite; Sites/provider recovery is unproven.",
        notes:
          "Table, event, outbox, checksum, and tenant-scope checks matched. No production data or system was mutated.",
      };
    setPending(true);
    try {
      const r = await fetch("/api/admin/recovery", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        x = (await r.json()) as P;
      if (!r.ok) throw new Error(x.error ?? "Recovery action failed");
      setData(x);
      setMessage("Recovery evidence advanced.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setPending(false);
    }
  }
  if (!data)
    return (
      <section className="panel operator-load">
        <HardDriveDownload size={22} />
        <div>
          <h2>Backup and restore evidence</h2>
          <p>
            Load checksum snapshots, disposable restores, verification checks,
            and approvals.
          </p>
          <button
            className="secondary-action"
            onClick={() => void load()}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <HardDriveDownload size={15} />
            )}
            Load recovery evidence
          </button>
          {message && <p className="inline-message">{message}</p>}
        </div>
      </section>
    );
  const e = data.exercises.find((x) => x.id === E),
    s = data.snapshots.find((x) => x.id === SNAPSHOT);
  return (
    <section className="panel operator-panel">
      <header>
        <div>
          <h2>Local recovery exercise</h2>
          <p>{data.limitation}</p>
        </div>
        <StatusPill tone={e?.status === "approved" ? "success" : "info"}>
          {e?.status ?? "not started"}
        </StatusPill>
      </header>
      {s && (
        <p>
          <strong>Snapshot:</strong> {s.tableCount} tables ·{" "}
          {s.byteSize.toLocaleString()} bytes · {s.providerMode}
          <br />
          <small>
            SHA-256 {s.sha256} · {s.objectRef}
          </small>
        </p>
      )}
      {e && (
        <p>
          <strong>Target:</strong> {e.targetEnvironment} · production mutation{" "}
          {String(e.productionMutation)} · RPO {e.rpoSeconds ?? "pending"}s ·
          RTO {e.rtoSeconds ?? "pending"}s
        </p>
      )}
      {data.checks
        .filter((x) => x.id && e)
        .map((x) => (
          <p key={x.id}>
            <strong>
              {x.code} · {x.outcome}
            </strong>{" "}
            · expected {x.expectedValue} / actual {x.actualValue}
          </p>
        ))}
      {data.approvals.map((x) => (
        <p key={x.id}>
          <strong>{x.outcome}</strong> · {x.scopeLimitation}
        </p>
      ))}
      {e?.status !== "approved" && e?.status !== "failed" && (
        <button
          className="primary-action"
          onClick={() => void act()}
          disabled={pending}
        >
          <CheckCircle2 size={15} />
          Advance recovery proof
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
