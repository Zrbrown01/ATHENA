import { AppShell } from "@/components/app-shell";
import { FactReview } from "@/components/fact-review";
import { MatterHeader } from "@/components/matter-header";
import { MatterGraph } from "@/components/matter-graph";
import { PartyRoster } from "@/components/party-roster";
import { MatterTasks } from "@/components/matter-tasks";
import { MatterOverview } from "@/components/matter-overview";
import { candidateFacts, goldenMatter, matterEvents } from "@/domain/golden-matter";

export default function GoldenMatterPage() {
  return (
    <AppShell active="Matters">
      <MatterHeader matter={goldenMatter} />
      <div className="page-content">
        <MatterOverview matter={goldenMatter} events={matterEvents} />
        <MatterGraph />
        <PartyRoster />
        <MatterTasks />
        <FactReview initialFacts={candidateFacts} />
      </div>
    </AppShell>
  );
}
