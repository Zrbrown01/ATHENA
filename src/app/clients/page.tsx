import { Building2, CircleDollarSign, FileText, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ClientPortalOperations } from "@/components/client-portal-operations";
import { MetricGrid, ModuleHeader, WorkstreamTable } from "@/components/module-layout";
const rows=[
 {primary:"Summit Claims Services",secondary:"23 open matters · 98% report SLA",owner:"Elena Ruiz",due:"Review Aug 28",status:"Healthy",tone:"success" as const},
 {primary:"Meridian Risk Partners",secondary:"16 open matters · 2 guideline exceptions",owner:"David Park",due:"Review Aug 25",status:"Attention",tone:"warning" as const},
 {primary:"Harbor Mutual",secondary:"9 open matters · portal invitation pending",owner:"Maya Chen",due:"Review Sep 02",status:"Internal only",tone:"neutral" as const},
];
export default function ClientsPage(){return <AppShell active="Clients"><div className="simple-page"><ModuleHeader eyebrow="CLIENT SERVICE" title="Clients and accounts" description="Account contacts, portfolio posture, billing guidelines, reporting obligations, and portal access boundaries." /><div className="truth-banner"><Users size={18}/><div><strong>Client portal login remains disabled</strong><p>This owner-only pilot can prove internal access governance, but it does not expose matter data to clients or other external users.</p></div></div><ClientPortalOperations/><MetricGrid metrics={[{label:"Active clients",value:"12",detail:"Synthetic pilot",icon:Building2},{label:"Open matters",value:"48",detail:"Across accounts",icon:FileText},{label:"Client contacts",value:"31",detail:"Internal directory",icon:Users},{label:"Outstanding AR",value:"$63,420",detail:"Synthetic",icon:CircleDollarSign}]} /><WorkstreamTable title="Account portfolio" description="Metrics shown are synthetic and do not represent a connected billing or claims system." rows={rows} column="Client" /></div></AppShell>}
