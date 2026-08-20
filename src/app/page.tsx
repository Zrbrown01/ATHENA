import { AppShell } from "@/components/app-shell";
import { FactReview } from "@/components/fact-review";
import { MatterHeader } from "@/components/matter-header";
import { MatterOverview } from "@/components/matter-overview";
import { candidateFacts, goldenMatter, matterEvents } from "@/domain/golden-matter";

export default function Home() {
  return (
    <AppShell>
      <MatterHeader matter={goldenMatter} />
      <div className="page-content">
        <MatterOverview matter={goldenMatter} events={matterEvents} />
        <FactReview initialFacts={candidateFacts} />
      </div>
    </AppShell>
  );
}
