import { ClipboardCheck, FileWarning, Scale, UserCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricGrid, ModuleHeader, WorkstreamTable } from "@/components/module-layout";
import { WorkflowDecision } from "@/components/workflow-decision";

const rows = [
  { primary: "Rivera v. Northstar Logistics", secondary: "New referral · DOI 04/12/2024 · Los Angeles WCAB", owner: "Maya Chen", due: "Received 9:42 AM", status: "Conflict clear", tone: "success" as const },
  { primary: "Ortiz v. Pacific Foundry", secondary: "Claim file incomplete · wage statement missing", owner: "Intake team", due: "Due today", status: "Needs information", tone: "warning" as const },
  { primary: "Miller v. Summit Transit", secondary: "Potential prior representation identified", owner: "Risk partner", due: "Review by 3:00 PM", status: "Conflict review", tone: "danger" as const },
];

export default function IntakePage() { return <AppShell active="Matters"><div className="simple-page"><ModuleHeader eyebrow="MATTER INTAKE" title="Referral and conflict review" description="A human-controlled gate from referral receipt through conflict clearance and matter opening." /><MetricGrid metrics={[{label:"New referrals",value:"3",detail:"Today",icon:ClipboardCheck},{label:"Conflict holds",value:"1",detail:"Partner review",icon:Scale},{label:"Missing items",value:"4",detail:"Across 2 referrals",icon:FileWarning},{label:"Ready to open",value:"1",detail:"Human approval required",icon:UserCheck}]} /><div className="module-two-column"><WorkstreamTable title="Intake queue" description="Opening a matter records the decision, actor, event, and idempotency key." rows={rows} column="Referral" /><aside className="panel decision-panel"><span className="eyebrow">READY TO OPEN</span><h2>Rivera v. Northstar Logistics</h2><p>Conflict search is clear. Referral metadata and source documents passed completeness review.</p><dl><div><dt>Client</dt><dd>Summit Claims Services</dd></div><div><dt>Claim</dt><dd>SCS-447219</dd></div><div><dt>Venue</dt><dd>Los Angeles WCAB</dd></div></dl><WorkflowDecision workflowType="intake" aggregateId="intake-rivera-001" matterId="matter-golden" action="approve_open" label="Approve and open matter" successLabel="Matter opening approved" /></aside></div></div></AppShell>; }
