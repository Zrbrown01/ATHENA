import { Archive } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ModuleHeader } from "@/components/module-layout";
import { TenantExportOperations } from "@/components/tenant-export-operations";

export default function TenantExportsPage() {
  return (
    <AppShell>
      <div className="simple-page">
        <ModuleHeader
          eyebrow="ADMINISTRATION"
          title="Tenant export and portability"
          description="Checksummed synthetic archives with explicit category, table, original-object, and completeness evidence."
          action={<Archive size={20} />}
        />
        <TenantExportOperations />
      </div>
    </AppShell>
  );
}
