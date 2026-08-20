import { BadgeDollarSign, CircleAlert, Handshake, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MatterHeader } from "@/components/matter-header";
import { MetricGrid } from "@/components/module-layout";
import { WorkflowDecision } from "@/components/workflow-decision";
import { goldenMatter } from "@/domain/golden-matter";

export default function AuthorityPage() {
  return <AppShell active="Matters"><MatterHeader matter={goldenMatter}/><div className="page-content">
    <MetricGrid metrics={[
      { label: "Demand", value: "$185,000", detail: "Applicant counsel", icon: BadgeDollarSign },
      { label: "Current authority", value: "$125,000", detail: "Verification pending", icon: ShieldCheck },
      { label: "Exposure range", value: "$92k–$148k", detail: "Attorney assessment", icon: CircleAlert },
      { label: "Next event", value: "MSC", detail: "Aug 21 · 8:30 AM", icon: Handshake },
    ]}/>
    <div className="module-two-column"><section className="panel resolution-panel"><span className="eyebrow">RESOLUTION WORKSPACE</span><h2>Authority history and settlement posture</h2><p>The current authority was transcribed from a synthetic client email. The amount is not usable until a person confirms the source and scope.</p><ol><li><strong>$125,000 proposed authority</strong><small>Aug 20 · source email linked · unconfirmed</small></li><li><strong>$95,000 prior authority</strong><small>Jul 18 · confirmed by Maya Chen</small></li><li><strong>$72,500 initial evaluation</strong><small>Jun 02 · internal attorney range</small></li></ol></section><aside className="panel decision-panel"><span className="eyebrow">AUTHORITY GATE</span><h2>Confirm $125,000</h2><p>Confirm that Summit Claims authorized up to $125,000 inclusive of permanent disability, future medical, and liens.</p><dl><div><dt>Source</dt><dd>Synthetic email</dd></div><div><dt>Received</dt><dd>Aug 20 · 8:47 AM</dd></div><div><dt>Scope</dt><dd>C&amp;R inclusive</dd></div></dl><WorkflowDecision workflowType="authority" aggregateId="authority-rivera-125k" matterId="matter-golden" action="confirm" label="Confirm authority" successLabel="Authority confirmed" /></aside></div>
  </div></AppShell>;
}
