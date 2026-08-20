export type ReviewStatus = "candidate" | "verified" | "rejected" | "superseded";

export interface MatterSummary {
  id: string;
  matterNumber: string;
  caption: string;
  client: string;
  employer: string;
  applicant: string;
  claimNumber: string;
  adjNumber: string;
  injuryDate: string;
  assignedAttorney: string;
  status: "Open" | "Intake" | "Stayed" | "Closed";
  nextEvent: string;
  reportDue: string;
  authorityStatus: string;
  exposure: number;
  unbilledHours: number;
}

export interface CandidateFact {
  id: string;
  type: string;
  label: string;
  currentValue?: string;
  proposedValue: string;
  sourceDocument: string;
  sourcePage: number;
  sourceExcerpt: string;
  confidence: number;
  reviewStatus: ReviewStatus;
  downstreamImpact: string;
}

export interface MatterEvent {
  id: string;
  type: string;
  title: string;
  detail: string;
  timestamp: string;
  actor: string;
}

export interface IntegrationHealth {
  name: string;
  status: "connected" | "not_connected" | "degraded";
  detail: string;
}

export interface WorkItem {
  id: string;
  priority: "Critical" | "High" | "Normal";
  caption: string;
  matterNumber: string;
  client: string;
  action: string;
  owner: string;
  due: string;
  overdue: boolean;
  reason: string;
  status: string;
  statusTone: "success" | "warning" | "danger" | "neutral" | "info";
}

export interface MatterInventoryItem extends MatterSummary {
  reportRisk: boolean;
}
