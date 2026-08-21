"use client";

import { Archive, CheckCircle2, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "./status-pill";

type Projection = {
  jobs: Array<{
    id: string;
    completeness: "partial" | "complete";
    includedCategoryCount: number;
    requiredCategoryCount: number;
    includedTableCount: number;
    sourceTableCount: number;
    includedOriginalCount: number;
    sourceOriginalCount: number;
    missingItems: string[];
    sha256: string;
    byteSize: number;
    archiveEntryCount: number;
  }>;
  scopeItems: Array<{
    id: string;
    exportId: string;
    category: string;
    status: string;
    recordCount: number;
    reason: string | null;
  }>;
  limitation?: string;
  error?: string;
};

export function TenantExportOperations() {
  const [data, setData] = useState<Projection | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function request(body?: Record<string, unknown>) {
    const response = await fetch("/api/admin/tenant-exports", {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const projection = (await response.json()) as Projection;
    if (!response.ok) throw new Error(projection.error ?? "Operation failed");
    setData(projection);
  }

  async function load() {
    setPending(true);
    try {
      await request();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Load failed");
    } finally {
      setPending(false);
    }
  }

  async function createExport() {
    setPending(true);
    setMessage(null);
    try {
      const id = `tenant-export-${crypto.randomUUID()}`;
      await request({
        action: "create_portability_archive",
        tenantId: "tenant-golden",
        exportId: id,
        purpose:
          "Create a governed synthetic tenant portability archive and preserve machine-readable coverage gaps.",
        syntheticDataAcknowledged: true,
        idempotencyKey: `tenant-export-create-${crypto.randomUUID()}`,
      });
      setMessage(
        "Tenant portability archive created with explicit coverage truth.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed");
    } finally {
      setPending(false);
    }
  }

  if (!data)
    return (
      <section className="panel operator-load">
        <Archive size={22} />
        <div>
          <h2>Tenant portability</h2>
          <p>Load archive coverage, checksums, gaps, and download evidence.</p>
          <button
            className="secondary-action"
            onClick={() => void load()}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Archive size={15} />
            )}
            Load tenant exports
          </button>
          {message && <p className="inline-message">{message}</p>}
        </div>
      </section>
    );

  return (
    <section className="panel operator-panel">
      <header>
        <div>
          <h2>Governed tenant portability archives</h2>
          <p>{data.limitation}</p>
        </div>
        <StatusPill tone="info">synthetic only</StatusPill>
      </header>
      {data.jobs.map((job) => (
        <article key={job.id} className="operator-record">
          <div>
            <strong>{job.id}</strong>
            <p>
              {job.includedCategoryCount}/{job.requiredCategoryCount} categories
              · {job.includedTableCount}/{job.sourceTableCount} tables ·{" "}
              {job.includedOriginalCount}/{job.sourceOriginalCount} originals ·{" "}
              {job.archiveEntryCount} archive entries
            </p>
            <p>
              <strong>Missing:</strong> {job.missingItems.join(" · ") || "none"}
            </p>
            <small>
              SHA-256 {job.sha256} · {job.byteSize.toLocaleString()} bytes
            </small>
          </div>
          <StatusPill
            tone={job.completeness === "complete" ? "success" : "warning"}
          >
            {job.completeness}
          </StatusPill>
          <a
            className="secondary-action"
            href={`/api/admin/tenant-exports/${job.id}`}
          >
            Download TAR
          </a>
          {data.scopeItems
            .filter((item) => item.exportId === job.id)
            .map((item) => (
              <p key={item.id}>
                <strong>{item.category}</strong> · {item.status} ·{" "}
                {item.recordCount} records
                {item.reason ? ` · ${item.reason}` : ""}
              </p>
            ))}
        </article>
      ))}
      <button
        className="primary-action"
        onClick={() => void createExport()}
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle className="spin" size={15} />
        ) : (
          <CheckCircle2 size={15} />
        )}
        Create partial tenant archive
      </button>
      {message && (
        <p className="inline-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
