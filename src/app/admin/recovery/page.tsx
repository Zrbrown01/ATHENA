import { HardDriveDownload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ModuleHeader } from "@/components/module-layout";
import { RecoveryOperations } from "@/components/recovery-operations";
export default function RecoveryPage() {
  return (
    <AppShell>
      <div className="simple-page">
        <ModuleHeader
          eyebrow="ADMINISTRATION"
          title="Backup and recovery evidence"
          description="Checksum-pinned snapshots, disposable restore exercises, exact verification checks, recovery objectives, and human approval."
          action={<HardDriveDownload size={20} />}
        />
        <RecoveryOperations />
      </div>
    </AppShell>
  );
}
