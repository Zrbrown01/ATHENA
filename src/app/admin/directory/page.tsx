import { UserCog } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DirectoryOperations } from "@/components/directory-operations";
import { ModuleHeader } from "@/components/module-layout";
export default function DirectoryPage() {
  return (
    <AppShell>
      <div className="simple-page">
        <ModuleHeader
          eyebrow="ADMINISTRATION"
          title="Identity and role administration"
          description="Enterprise directory truth, immutable permissions, scoped assignments, drift reconciliation, immediate suspension, and evidence-backed offboarding."
          action={<UserCog size={20} />}
        />
        <DirectoryOperations />
      </div>
    </AppShell>
  );
}
