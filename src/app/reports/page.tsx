import { BarChart3, FileCheck2, FileClock, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricGrid, ModuleHeader, WorkstreamTable } from "@/components/module-layout";
import { ReportingOperations } from "@/components/reporting-operations";
const rows=[
 {primary:"90-day status — Rivera v. Northstar",secondary:"Client template v4 · sources linked",owner:"Maya Chen",due:"Due Aug 21",status:"Needs approval",tone:"warning" as const},
 {primary:"Quarterly portfolio — Summit Claims",secondary:"23 open matters · synthetic metrics",owner:"Client team",due:"Due Aug 30",status:"In progress",tone:"info" as const},
 {primary:"Closure report — Vasquez v. Orion",secondary:"Settlement and lien closure verified",owner:"Sara Kim",due:"Completed Aug 18",status:"Approved",tone:"success" as const},
];
export default function ReportsPage(){return <AppShell active="Reports"><div className="simple-page"><ModuleHeader eyebrow="REPORTING" title="Client reporting" description="Source-linked drafts, client-specific definitions, human approval, and delivery readiness." /><MetricGrid metrics={[{label:"Due this week",value:"8",detail:"3 need approval",icon:FileClock},{label:"Approved",value:"14",detail:"This month",icon:FileCheck2},{label:"Portfolio reports",value:"4",detail:"Scheduled intent",icon:BarChart3},{label:"Uncited claims",value:"0",detail:"In approval queue",icon:ShieldCheck}]} /><ReportingOperations/><WorkstreamTable title="Report queue" description="These overview rows remain visual fixtures; the governed lifecycle above is durable and source-linked." rows={rows} column="Report" /></div></AppShell>}
