import { AppShell } from "@/components/app-shell";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock3, FileText, Scale, Timer, WalletCards } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { workItems } from "@/domain/golden-matter";

export default function Home() {
  return (
    <AppShell active="My Work">
      <div className="work-page">
        <header className="work-title">
          <div><span className="eyebrow">THURSDAY · AUGUST 20</span><h1>Good afternoon, Maya</h1><p>Here is the work that needs your attention across 42 open matters.</p></div>
          <Link href="/pilot/release-one" className="primary-action">Run Release 1 pilot</Link>
        </header>

        <section className="kpi-strip" aria-label="Work summary">
          <div><span className="kpi-icon blue"><Scale size={17} /></span><dl><dt>Open matters</dt><dd>42</dd></dl><small>3 opened this month</small></div>
          <div><span className="kpi-icon amber"><FileText size={17} /></span><dl><dt>Reports due</dt><dd>7</dd></dl><small>2 due this week</small></div>
          <div><span className="kpi-icon red"><AlertTriangle size={17} /></span><dl><dt>Overdue</dt><dd>3</dd></dl><small>Oldest is 2 days</small></div>
          <div><span className="kpi-icon violet"><CalendarDays size={17} /></span><dl><dt>Depositions</dt><dd>4</dd></dl><small>Next 14 days</small></div>
          <div><span className="kpi-icon green"><Timer size={17} /></span><dl><dt>Candidate time</dt><dd>6.8h</dd></dl><small>Ready to confirm</small></div>
          <div><span className="kpi-icon navy"><WalletCards size={17} /></span><dl><dt>Monthly target</dt><dd>74%</dd></dl><small>108.4 of 146h</small></div>
        </section>

        <section className="queue-panel" aria-labelledby="priority-work-title">
          <header className="queue-header">
            <div><h2 id="priority-work-title">Priority work</h2><p>Ordered by deadline, risk, and client obligation.</p></div>
            <div className="queue-tabs" aria-label="Current priority work view">
              <span className="selected">Today <b>8</b></span>
              <span>Client reports</span><span>Authority pending</span><span>Data review</span><span>My hearings</span>
            </div>
          </header>
          <div className="work-table-wrap">
            <table className="work-table">
              <thead><tr><th>Priority</th><th>Matter</th><th>Required action</th><th>Due</th><th>Reason</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead>
              <tbody>{workItems.map((item) => <tr key={item.id}>
                <td><span className={`priority-marker ${item.priority.toLowerCase()}`}><span />{item.priority}</span></td>
                <td><Link href="/matters/golden"><strong>{item.caption}</strong><small>{item.matterNumber} · {item.client}</small></Link></td>
                <td><strong>{item.action}</strong><small>{item.owner}</small></td>
                <td><span className={item.overdue ? "due overdue" : "due"}>{item.due}</span></td>
                <td>{item.reason}</td>
                <td><StatusPill tone={item.statusTone}>{item.status}</StatusPill></td>
                <td><Link className="row-action" href="/matters/golden" aria-label={`Open ${item.caption}`}><ArrowRight size={16} /></Link></td>
              </tr>)}</tbody>
            </table>
          </div>
          <footer className="queue-footer"><span><CheckCircle2 size={15} />4 items completed today</span><Link href="/matters">View all work <ArrowRight size={14} /></Link></footer>
        </section>

        <div className="work-bottom-grid">
          <section className="panel day-panel"><header className="section-heading"><h2>Today’s schedule</h2><Link href="/calendar">Open calendar <ArrowRight size={14} /></Link></header><ol><li><time>10:00</time><span><strong>Rivera · QME review</strong><small>Client report preparation</small></span></li><li><time>13:30</time><span><strong>Nguyen · Applicant deposition</strong><small>Remote · Noted pending connection</small></span></li><li><time>15:00</time><span><strong>Harris · Strategy call</strong><small>Summit Claims Services</small></span></li></ol></section>
          <section className="panel time-panel"><header className="section-heading"><h2>Candidate time</h2><Link href="/billing">Review all <ArrowRight size={14} /></Link></header><div className="time-total"><Clock3 size={20} /><span><strong>6.8 hours</strong><small>Across 9 activities</small></span></div><div className="time-bars"><div><span>Email &amp; reporting</span><b>3.2h</b></div><div><span>Document review</span><b>2.1h</b></div><div><span>Hearings &amp; calls</span><b>1.5h</b></div></div></section>
        </div>
      </div>
    </AppShell>
  );
}
