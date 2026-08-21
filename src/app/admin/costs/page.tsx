import { BadgeDollarSign } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CostGovernanceOperations } from "@/components/cost-governance-operations";
import { ModuleHeader } from "@/components/module-layout";

export default function CostGovernancePage() {
  return <AppShell><div className="simple-page"><ModuleHeader eyebrow="ADMINISTRATION" title="Usage and cost governance" description="Tenant/workflow usage attribution, versioned rate provenance, exact integer-micro-dollar calculations, and estimate-versus-provider truth." action={<BadgeDollarSign size={20}/>}/><CostGovernanceOperations/></div></AppShell>;
}

