import { AlertTriangle, ArrowUpRight, CalendarClock, CircleDollarSign, Clock3, FileCheck2 } from "lucide-react";
import type { MatterEvent, MatterSummary } from "@/domain/types";
import { StatusPill } from "./status-pill";
import Link from "next/link";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function MatterOverview({ matter, events }: { matter: MatterSummary; events: MatterEvent[] }) {
  return (
    <div className="overview-grid">
      <section className="panel posture" aria-labelledby="posture-title">
        <header className="section-heading"><h2 id="posture-title">Current posture</h2><Link href="/pilot/release-one">View analysis <ArrowUpRight size={14} /></Link></header>
        <p className="posture-copy">Applicant is permanent and stationary following the August QME. The report finds lumbar impairment with industrial apportionment and permanent restrictions. Attorney verification is required before the client report updates.</p>
        <div className="issue-row">
          <div><span>Primary issue</span><strong>Permanent disability</strong></div>
          <div><span>Medical status</span><strong>P&amp;S / MMI proposed</strong></div>
          <div><span>Proceeding</span><strong>MSC preparation</strong></div>
        </div>
      </section>

      <aside className="panel next-actions" aria-labelledby="next-actions-title">
        <header className="section-heading"><h2 id="next-actions-title">What comes next</h2></header>
        <ol>
          <li className="urgent"><span className="action-icon"><AlertTriangle size={16} /></span><div><strong>Verify QME findings</strong><small>Due today · Attorney</small></div></li>
          <li><span className="action-icon"><FileCheck2 size={16} /></span><div><strong>Approve client report</strong><small>Due Aug 24 · Attorney</small></div></li>
          <li><span className="action-icon"><CalendarClock size={16} /></span><div><strong>Prepare for MSC</strong><small>Due Sep 7 · Legal team</small></div></li>
        </ol>
      </aside>

      <section className="panel key-financials" aria-labelledby="financial-title">
        <header className="section-heading"><h2 id="financial-title">Resolution &amp; work</h2></header>
        <dl>
          <div><dt>Current exposure</dt><dd>{currency.format(matter.exposure)}</dd></div>
          <div><dt>Authority</dt><dd><StatusPill tone="warning">{matter.authorityStatus}</StatusPill></dd></div>
          <div><dt>Candidate time</dt><dd><Clock3 size={15} />{matter.unbilledHours.toFixed(1)} hours</dd></div>
          <div><dt>Next client report</dt><dd>{matter.reportDue}</dd></div>
        </dl>
        <Link className="full-button" href="/billing"><CircleDollarSign size={15} />Review candidate time</Link>
      </section>

      <section className="panel activity" aria-labelledby="activity-title">
        <header className="section-heading"><h2 id="activity-title">Recent activity</h2><Link href="/pilot/release-one">View workflow history <ArrowUpRight size={14} /></Link></header>
        <ol className="timeline">
          {events.map((event) => <li key={event.id}><span className="timeline-dot" /><div><strong>{event.title}</strong><p>{event.detail}</p><small>{event.timestamp} · {event.actor}</small></div></li>)}
        </ol>
      </section>
    </div>
  );
}
