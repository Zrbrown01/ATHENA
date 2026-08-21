import { CalendarCheck2, Clock3, Gavel, MapPin } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricGrid, ModuleHeader, WorkstreamTable } from "@/components/module-layout";
import { WorkflowDecision } from "@/components/workflow-decision";
import { ObligationControl } from "@/components/obligation-control";
import { ProceedingReadiness } from "@/components/proceeding-readiness";
import { FilingPacketOperations } from "@/components/filing-packet-operations";

const rows = [
  { primary:"MSC — Rivera v. Northstar",secondary:"Los Angeles WCAB · Room 405",owner:"Maya Chen",due:"Aug 21 · 8:30 AM",status:"Packet review",tone:"warning" as const },
  { primary:"Applicant deposition — Nguyen",secondary:"Remote · Noted reporter requested",owner:"Jon Bell",due:"Aug 21 · 1:00 PM",status:"Confirmed",tone:"success" as const },
  { primary:"QME cross-exam deadline — Cruz",secondary:"Statutory deadline · source verified",owner:"Sara Kim",due:"Aug 23 · 5:00 PM",status:"Due soon",tone:"danger" as const },
  { primary:"Client strategy call — Rivera",secondary:"Microsoft meeting link not connected",owner:"Maya Chen",due:"Aug 24 · 10:00 AM",status:"Draft",tone:"info" as const },
];
export default function CalendarPage(){return <AppShell active="Calendar"><div className="simple-page"><ModuleHeader eyebrow="CALENDAR & DEADLINES" title="Docket control" description="Proceedings, verified deadlines, preparation work, and calendar-source health in one defensible view." /><MetricGrid metrics={[{label:"Today",value:"4",detail:"2 proceedings",icon:CalendarCheck2},{label:"Critical deadlines",value:"2",detail:"Next 7 days",icon:Clock3},{label:"Proceedings",value:"6",detail:"Next 30 days",icon:Gavel},{label:"Venues",value:"3",detail:"California boards",icon:MapPin}]} /><WorkstreamTable title="Upcoming docket" description="Calendar sync remains off; entries shown here are synthetic and locally controlled." rows={rows} column="Event" /><ObligationControl/><ProceedingReadiness/><FilingPacketOperations/><section className="panel approval-strip"><div><span className="eyebrow">FILING GATE</span><h2>MSC packet — Rivera v. Northstar</h2><p>Human approval is required before any external filing action. EAMS e-filing is not connected.</p></div><WorkflowDecision workflowType="filing" aggregateId="packet-rivera-msc" matterId="matter-golden-001" action="approve_packet" label="Approve filing packet" successLabel="Packet approved" /></section></div></AppShell>}
