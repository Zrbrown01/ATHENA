import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { integrationHealth } from "@/domain/golden-matter";

export default function IntegrationsPage() {
  return (
    <AppShell>
      <div className="simple-page">
        <div className="page-title"><div><span className="eyebrow">ADMINISTRATION</span><h1>Integration health</h1><p>External providers remain disabled until credentials, contractual authority, and verification are complete.</p></div></div>
        <section className="panel integration-table" aria-labelledby="connections-title">
          <header className="panel-heading"><div><h2 id="connections-title">Connections</h2><p>No connection is represented as live in this environment.</p></div></header>
          <table>
            <thead><tr><th>Provider</th><th>Status</th><th>Activation requirement</th><th>Last sync</th></tr></thead>
            <tbody>{integrationHealth.map((integration) => <tr key={integration.name}><td><strong>{integration.name}</strong></td><td><StatusPill tone="neutral">Not connected</StatusPill></td><td>{integration.detail}</td><td>Never</td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
