import { CalendarPlus, FileUp, Mail, Mic, MoreHorizontal, Timer } from "lucide-react";
import type { MatterSummary } from "@/domain/types";
import { StatusPill } from "./status-pill";
import Link from "next/link";

export function MatterHeader({ matter }: { matter: MatterSummary }) {
  return (
    <section className="matter-header" aria-labelledby="matter-title">
      <div className="matter-title-row">
        <div>
          <div className="eyebrow"><span>MATTERS</span><b>/</b><span>{matter.matterNumber}</span></div>
          <div className="title-line">
            <h1 id="matter-title">{matter.caption}</h1>
            <StatusPill tone="success">{matter.status}</StatusPill>
          </div>
        </div>
        <div className="quick-actions" aria-label="Matter actions">
          <Link href="/communications"><Mail size={16} />Email</Link>
          <button type="button" disabled title="Verbatim is not connected"><Mic size={16} />Dictate</button>
          <Link href="/billing"><Timer size={16} />Add time</Link>
          <Link href="/documents"><FileUp size={16} />Upload</Link>
          <Link href="/"><CalendarPlus size={16} />Task</Link>
          <button className="icon-button" type="button" disabled aria-label="More actions"><MoreHorizontal size={18} /></button>
        </div>
      </div>
      <dl className="matter-metadata">
        <div><dt>Claim</dt><dd>{matter.claimNumber}</dd></div>
        <div><dt>ADJ</dt><dd>{matter.adjNumber}</dd></div>
        <div><dt>Date of injury</dt><dd>{matter.injuryDate}</dd></div>
        <div><dt>Client</dt><dd>{matter.client}</dd></div>
        <div><dt>Employer</dt><dd>{matter.employer}</dd></div>
        <div><dt>Attorney</dt><dd>{matter.assignedAttorney}</dd></div>
      </dl>
      <nav className="matter-tabs" aria-label="Matter workspace">
        <Link className="selected" href="/matters/golden">Overview</Link>
        <Link href="/matters/golden#case">Case</Link>
        <Link href="/#priority-work-title">Work</Link>
        <Link href="/documents">Evidence</Link>
        <Link href="/billing">Financials</Link>
        <Link href="/matters/golden/authority">Resolution</Link>
      </nav>
    </section>
  );
}
