import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DispositionOperations } from "@/components/disposition-operations";
import { ModuleHeader } from "@/components/module-layout";
export default function DispositionPage() {
  return (
    <AppShell>
      <div className="simple-page">
        <ModuleHeader
          eyebrow="ADMINISTRATION"
          title="Deletion and disposition control"
          description="Legal-hold enforcement, exact scope preview, separation of duties, dual approval, synthetic execution, and preserved evidence."
          action={<Trash2 size={20} />}
        />
        <DispositionOperations />
      </div>
    </AppShell>
  );
}
