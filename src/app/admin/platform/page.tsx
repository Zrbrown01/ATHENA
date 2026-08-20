import { AppShell } from "@/components/app-shell";
import { PlatformOperations } from "@/components/platform-operations";

export default function PlatformOperationsPage() {
  return <AppShell><div className="simple-page"><header className="module-title"><div><span className="eyebrow">ADMINISTRATION</span><h1>Platform operations</h1><p>Tenant-scoped event delivery, retention safeguards, deadline calculation evidence, and recovery controls for the private pilot.</p></div></header><div className="truth-banner"><div><strong>Controlled pilot boundary</strong><p>Publishing below targets Athena’s internal event projection only. It does not send email, file with EAMS, update MerusCase, or invoke any disconnected provider.</p></div></div><PlatformOperations/></div></AppShell>;
}
