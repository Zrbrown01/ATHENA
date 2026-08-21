import { BadgeCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ComplianceRegistryOperations } from "@/components/compliance-registry-operations";
import { ModuleHeader } from "@/components/module-layout";
export default function CompliancePage() {
  return (
    <AppShell>
      <div className="simple-page">
        <ModuleHeader
          eyebrow="ADMINISTRATION"
          title="Provider compliance registry"
          description="Subprocessor inventory, security review, BAA/DPA status, data-use authority, and activation prerequisites."
          action={<BadgeCheck size={20} />}
        />
        <ComplianceRegistryOperations />
      </div>
    </AppShell>
  );
}
