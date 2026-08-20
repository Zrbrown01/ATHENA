import { AppShell } from "@/components/app-shell";
import { CompanionPilot } from "@/components/companion-pilot";
import { ModuleHeader } from "@/components/module-layout";

export default function ReleaseOnePilotPage() {
  return <AppShell><div className="simple-page"><ModuleHeader eyebrow="RELEASE 1 · COMPANION PILOT" title="Golden workflow control room" description="Run one persistent, source-linked chain from matter import to verified export. Unavailable providers stop in explicit sandbox or blocked states."/><CompanionPilot/></div></AppShell>;
}
