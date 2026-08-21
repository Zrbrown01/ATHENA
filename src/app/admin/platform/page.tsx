import { AppShell } from "@/components/app-shell";
import { PlatformOperations } from "@/components/platform-operations";
import { EthicalWallOperations } from "@/components/ethical-wall-operations";
import { AccessControlOperations } from "@/components/access-control-operations";
import { RetentionOperations } from "@/components/retention-operations";
import { ScaleOperations } from "@/components/scale-operations";

export default function PlatformOperationsPage() {
  return <AppShell><div className="simple-page"><header className="module-title"><div><span className="eyebrow">ADMINISTRATION</span><h1>Platform operations</h1><p>Tenant-scoped event delivery, access isolation, retention safeguards, deadline calculation evidence, recovery controls, and bounded scale evidence for the private pilot.</p></div></header><div className="truth-banner"><div><strong>Controlled pilot boundary</strong><p>Publishing below targets Athena’s internal event projection only. It does not send email, file with EAMS, update MerusCase, invoke a disconnected provider, or establish production readiness.</p></div></div><RetentionOperations/><AccessControlOperations/><EthicalWallOperations/><ScaleOperations/><PlatformOperations/></div></AppShell>;
}
