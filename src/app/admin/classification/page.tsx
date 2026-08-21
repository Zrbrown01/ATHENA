import { Tags } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ClassificationOperations } from "@/components/classification-operations";
import { ModuleHeader } from "@/components/module-layout";

export default function ClassificationPage() {
  return (
    <AppShell>
      <div className="simple-page">
        <ModuleHeader
          eyebrow="ADMINISTRATION"
          title="Data classification control"
          description="Versioned labels, per-plane deny-overrides-allow decisions, time-limited overrides, and immutable evidence."
          action={<Tags size={20} />}
        />
        <ClassificationOperations />
      </div>
    </AppShell>
  );
}
