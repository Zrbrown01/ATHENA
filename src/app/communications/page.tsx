import { Inbox, MailCheck, MessageSquareWarning, Send } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CommunicationOperations } from "@/components/communication-operations";
import { MetricGrid, ModuleHeader, WorkstreamTable } from "@/components/module-layout";

const rows = [
  { primary: "Summit Claims — authority follow-up", secondary: "Linked to Rivera v. Northstar · draft preserved", owner: "Maya Chen", due: "Drafted 10:18 AM", status: "Needs approval", tone: "warning" as const },
  { primary: "Applicant counsel — deposition dates", secondary: "Nguyen v. Arcadia Foods · inbound", owner: "Jon Bell", due: "Received 9:51 AM", status: "Needs response", tone: "danger" as const },
  { primary: "QME office — supplemental record set", secondary: "Cruz v. Ember Manufacturing", owner: "Sara Kim", due: "Synthetic record", status: "Fixture only", tone: "neutral" as const },
];

export default function CommunicationsPage() {
  return <AppShell active="Communications"><div className="simple-page"><ModuleHeader eyebrow="COMMUNICATIONS" title="Matter communications" description="A matter-linked record of inbound messages, drafts, approvals, and delivery evidence." action={<Link className="primary-action" href="/pilot/release-one">Open delivery pilot</Link>}/><div className="truth-banner"><MessageSquareWarning size={18}/><div><strong>Microsoft Graph is not connected</strong><p>Sending, inbox sync, notifications, delta recovery, attachment download, and delivery confirmation are disabled. Athena records a retryable blocked handoff instead of fake delivery.</p></div></div><MetricGrid metrics={[{ label: "Needs response", value: "5", detail: "Synthetic queue", icon: Inbox }, { label: "Draft approvals", value: "3", detail: "Attorney review", icon: MailCheck }, { label: "Sent today", value: "0", detail: "Provider offline", icon: Send }, { label: "Unlinked", value: "2", detail: "Triage fixture", icon: MessageSquareWarning }]}/><CommunicationOperations/><WorkstreamTable title="Communication queue" description="These rows remain visual fixtures. The lifecycle above is the durable, authenticated evidence slice." rows={rows} column="Thread"/></div></AppShell>;
}
