import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ModuleHeader } from "@/components/module-layout";
import { SecurityOperations } from "@/components/security-operations";

export default function SecurityOperationsPage() {
  return (
    <AppShell>
      <div className="simple-page">
        <ModuleHeader
          eyebrow="ADMINISTRATION"
          title="Security and incident operations"
          description="Incident response, counsel-owned breach review, control evidence, and risk treatment with immutable decision history."
          action={<ShieldAlert size={20} />}
        />
        <SecurityOperations />
      </div>
    </AppShell>
  );
}
