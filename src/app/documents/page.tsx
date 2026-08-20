import { FileCheck2, FileClock, FileSearch, MoreHorizontal, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DocumentIntake } from "@/components/document-intake";
import { StatusPill } from "@/components/status-pill";

const documents = [
  { title: "QME Report — Dr. Priya Shah", matter: "Rivera v. Northstar Logistics", type: "QME report", pages: 42, received: "Aug 20 · 9:08 AM", status: "Needs review", tone: "warning" as const },
  { title: "MSC Notice", matter: "Cruz v. Ember Manufacturing", type: "Hearing notice", pages: 3, received: "Aug 19 · 4:14 PM", status: "Ready", tone: "success" as const },
  { title: "Applicant Deposition Transcript", matter: "Nguyen v. Arcadia Foods", type: "Deposition", pages: 118, received: "Aug 19 · 11:22 AM", status: "Indexed", tone: "info" as const },
  { title: "Client Billing Guidelines — 2026", matter: "Summit Claims Services", type: "Client guidelines", pages: 27, received: "Aug 18 · 2:31 PM", status: "Verified", tone: "success" as const },
];

export default function DocumentsPage() {
  return <AppShell active="Documents"><div className="simple-page documents-page">
    <header className="inventory-title"><div><span className="eyebrow">EVIDENCE</span><h1>Documents</h1><p>Originals, derived objects, review status, and source-linked matter evidence.</p></div></header>
    <div className="document-kpis"><div><FileSearch size={18} /><span><strong>184</strong><small>Processed this month</small></span></div><div><FileClock size={18} /><span><strong>7</strong><small>Need review</small></span></div><div><FileCheck2 size={18} /><span><strong>98.4%</strong><small>Classification confidence</small></span></div><div><ShieldCheck size={18} /><span><strong>0</strong><small>Released from quarantine without scan</small></span></div></div>
    <DocumentIntake />
    <section className="panel document-table-panel" aria-labelledby="recent-documents"><header className="panel-heading"><div><h2 id="recent-documents">Recent documents</h2><p>Originals remain distinct from OCR, summaries, redactions, and filing copies.</p></div><button type="button" className="text-button">View all documents</button></header><div className="work-table-wrap"><table className="document-table"><thead><tr><th>Document</th><th>Matter / account</th><th>Classification</th><th>Pages</th><th>Received</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{documents.map((document) => <tr key={document.title}><td><strong>{document.title}</strong><small>Original preserved · PDF</small></td><td>{document.matter}</td><td>{document.type}</td><td>{document.pages}</td><td>{document.received}</td><td><StatusPill tone={document.tone}>{document.status}</StatusPill></td><td><button type="button" className="table-icon-button" aria-label={`Actions for ${document.title}`}><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table></div></section>
  </div></AppShell>;
}
