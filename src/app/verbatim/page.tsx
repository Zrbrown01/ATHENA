import { Mic2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DictationOperations } from "@/components/dictation-operations";
import { ModuleHeader } from "@/components/module-layout";

export default function VerbatimPage() {
  return <AppShell active="Verbatim"><div className="simple-page"><ModuleHeader eyebrow="DICTATION" title="Verbatim work-product operations" description="Governed capture metadata, provider truth, source-linked transcription, template review, approval, time, and matter filing." action={<Mic2 size={20}/>}/><DictationOperations/></div></AppShell>;
}
