import { Inbox, MailCheck, MessageSquareWarning, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricGrid, ModuleHeader, WorkstreamTable } from "@/components/module-layout";

const rows=[
 {primary:"Summit Claims — authority follow-up",secondary:"Linked to Rivera v. Northstar · draft preserved",owner:"Maya Chen",due:"Drafted 10:18 AM",status:"Needs approval",tone:"warning" as const},
 {primary:"Applicant counsel — deposition dates",secondary:"Nguyen v. Arcadia Foods · inbound",owner:"Jon Bell",due:"Received 9:51 AM",status:"Needs response",tone:"danger" as const},
 {primary:"QME office — supplemental record set",secondary:"Cruz v. Ember Manufacturing",owner:"Sara Kim",due:"Sent Aug 19",status:"Sent",tone:"success" as const},
];
export default function CommunicationsPage(){return <AppShell active="Communications"><div className="simple-page"><ModuleHeader eyebrow="COMMUNICATIONS" title="Matter communications" description="A matter-linked record of inbound messages, drafts, approvals, and delivery evidence." action={<button className="primary-action" disabled title="Microsoft Graph is not connected">Compose email</button>} /><div className="truth-banner"><MessageSquareWarning size={18}/><div><strong>Microsoft Graph is not connected</strong><p>Sending, inbox sync, and delivery confirmation are disabled. Synthetic examples never leave Athena.</p></div></div><MetricGrid metrics={[{label:"Needs response",value:"5",detail:"2 due today",icon:Inbox},{label:"Draft approvals",value:"3",detail:"Attorney review",icon:MailCheck},{label:"Sent today",value:"0",detail:"Provider offline",icon:Send},{label:"Unlinked",value:"2",detail:"Triage required",icon:MessageSquareWarning}]} /><WorkstreamTable title="Communication queue" description="Every message must be linked to a matter or administrative account before it can be acted on." rows={rows} column="Thread" /></div></AppShell>}
