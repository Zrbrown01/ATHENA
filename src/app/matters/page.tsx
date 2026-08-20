import { ArrowRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { matterInventory } from "@/domain/golden-matter";

export default function MattersPage() {
  return <AppShell active="Matters"><div className="simple-page matters-page">
    <header className="inventory-title"><div><span className="eyebrow">MATTERS</span><h1>Matter inventory</h1><p>Current posture, ownership, and upcoming obligations across the firm.</p></div><Link href="/intake" className="primary-action"><Plus size={15} />Open matter</Link></header>
    <section className="inventory-tools" aria-label="Current matter view"><div><Search size={16} /><span>Search is not connected in this pilot</span></div><span className="filter-chip">Open matters</span><span className="filter-chip">My team</span></section>
    <section className="panel inventory-panel" aria-labelledby="inventory-heading"><header className="panel-heading"><div><h2 id="inventory-heading">Open matters</h2><p>Synthetic pilot inventory · 42 representative matters</p></div></header><div className="work-table-wrap"><table className="matter-table"><thead><tr><th>Matter</th><th>Claim / ADJ</th><th>Client</th><th>Attorney</th><th>Next event</th><th>Report</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{matterInventory.map((matter) => <tr key={matter.id}><td><Link href="/matters/golden"><strong>{matter.caption}</strong><small>{matter.matterNumber} · DOI {matter.injuryDate}</small></Link></td><td><strong>{matter.claimNumber}</strong><small>{matter.adjNumber}</small></td><td><strong>{matter.client}</strong><small>{matter.employer}</small></td><td>{matter.assignedAttorney}</td><td>{matter.nextEvent}</td><td><span className={matter.reportRisk ? "due overdue" : "due"}>{matter.reportDue}</span></td><td><StatusPill tone="success">{matter.status}</StatusPill></td><td><Link className="row-action" href="/matters/golden" aria-label={`Open ${matter.caption}`}><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div></section>
  </div></AppShell>;
}
