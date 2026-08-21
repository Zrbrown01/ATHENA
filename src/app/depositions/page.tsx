import { Video } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DepositionOperations } from "@/components/deposition-operations";
import { ModuleHeader } from "@/components/module-layout";
export default function DepositionsPage() {
  return (
    <AppShell active="Noted">
      <div className="simple-page">
        <ModuleHeader
          eyebrow="DEPOSITIONS"
          title="Noted deposition operations"
          description="Governed request, approval, provider truth, scheduling evidence, completion, and transcript return."
          action={<Video size={20} />}
        />
        <DepositionOperations />
      </div>
    </AppShell>
  );
}
