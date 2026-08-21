import { BadgeDollarSign, CircleAlert, Handshake, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MatterHeader } from "@/components/matter-header";
import { MetricGrid } from "@/components/module-layout";
import { AuthorityLedgerOperations } from "@/components/authority-ledger-operations";
import { StructuredAuthorityOperations } from "@/components/structured-authority-operations";
import { SettlementReadiness } from "@/components/settlement-readiness";
import { goldenMatter } from "@/domain/golden-matter";

export default function AuthorityPage() {
  return <AppShell active="Matters"><MatterHeader matter={goldenMatter}/><div className="page-content">
    <MetricGrid metrics={[
      { label: "Demand", value: "$185,000", detail: "Applicant counsel", icon: BadgeDollarSign },
      { label: "Current authority", value: "$125,000", detail: "Verification pending", icon: ShieldCheck },
      { label: "Exposure range", value: "$92k–$148k", detail: "Attorney assessment", icon: CircleAlert },
      { label: "Next event", value: "MSC", detail: "Aug 21 · 8:30 AM", icon: Handshake },
    ]}/>
    <div className="module-two-column"><section className="panel resolution-panel"><span className="eyebrow">RESOLUTION WORKSPACE</span><h2>Authority history and settlement posture</h2><p>A proposed amount is never active until an attorney verifies its source, classification, scope, structure, inclusions, exclusions, conditions, grantor, and dates.</p><ol><li><strong>Requests are not grants</strong><small>Classification is enforced before confirmation</small></li><li><strong>Prior authority remains historical</strong><small>A later grant supersedes rather than overwrites</small></li><li><strong>External email remains disconnected</strong><small>Current source excerpts are deterministic synthetic data</small></li></ol></section><AuthorityLedgerOperations /></div>
    <StructuredAuthorityOperations />
    <SettlementReadiness />
  </div></AppShell>;
}
