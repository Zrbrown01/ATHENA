import { CalendarPlus, FileUp, Mail, Mic, MoreHorizontal, Timer } from "lucide-react";
import type { MatterSummary } from "@/domain/types";
import { StatusPill } from "./status-pill";

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
          <button type="button"><Mail size={16} />Email</button>
          <button type="button"><Mic size={16} />Dictate</button>
          <button type="button"><Timer size={16} />Add time</button>
          <button type="button"><FileUp size={16} />Upload</button>
          <button type="button"><CalendarPlus size={16} />Task</button>
          <button className="icon-button" type="button" aria-label="More actions"><MoreHorizontal size={18} /></button>
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
        {['Overview', 'Case', 'Work', 'Evidence', 'Financials', 'Resolution'].map((tab, index) => (
          <button type="button" className={index === 0 ? "selected" : ""} key={tab}>{tab}</button>
        ))}
      </nav>
    </section>
  );
}
