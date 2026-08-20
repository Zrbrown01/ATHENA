import type { CandidateFact, IntegrationHealth, MatterEvent, MatterInventoryItem, MatterSummary, WorkItem } from "./types";

export const goldenMatter: MatterSummary = {
  id: "matter-golden-001",
  matterNumber: "NRL-2026-0042",
  caption: "Rivera v. Northstar Logistics",
  client: "Summit Claims Services",
  employer: "Northstar Logistics, Inc.",
  applicant: "Elena Rivera",
  claimNumber: "SCS-CA-884103",
  adjNumber: "ADJ18420931",
  injuryDate: "2025-11-04",
  assignedAttorney: "Maya Chen",
  status: "Open",
  nextEvent: "MSC · Sep 14, 2026",
  reportDue: "Aug 24, 2026",
  authorityStatus: "Pending review",
  exposure: 112500,
  unbilledHours: 1.4,
};

export const candidateFacts: CandidateFact[] = [
  {
    id: "fact-001",
    type: "wpi",
    label: "Whole Person Impairment",
    proposedValue: "12% WPI — lumbar spine",
    sourceDocument: "QME Report — Dr. Priya Shah — 08/18/2026",
    sourcePage: 27,
    sourceExcerpt: "Using Table 15-3, the examinee falls within DRE Lumbar Category III, corresponding to 12% whole person impairment.",
    confidence: 0.97,
    reviewStatus: "candidate",
    downstreamImpact: "Updates medical posture, exposure worksheet, and client report draft.",
  },
  {
    id: "fact-002",
    type: "apportionment",
    label: "Apportionment",
    proposedValue: "80% industrial / 20% pre-existing degenerative changes",
    sourceDocument: "QME Report — Dr. Priya Shah — 08/18/2026",
    sourcePage: 31,
    sourceExcerpt: "Eighty percent of permanent disability is attributable to the industrial injury and twenty percent to documented pre-existing degeneration.",
    confidence: 0.94,
    reviewStatus: "candidate",
    downstreamImpact: "Changes projected permanent disability and settlement analysis.",
  },
  {
    id: "fact-003",
    type: "work_restriction",
    label: "Work restrictions",
    currentValue: "Temporary modified duty",
    proposedValue: "No lifting over 25 lb; alternate sitting and standing",
    sourceDocument: "QME Report — Dr. Priya Shah — 08/18/2026",
    sourcePage: 29,
    sourceExcerpt: "Permanent restrictions include no lifting greater than 25 pounds and the ability to alternate sitting and standing as needed.",
    confidence: 0.92,
    reviewStatus: "candidate",
    downstreamImpact: "Updates return-to-work status and creates employer follow-up work.",
  },
];

export const matterEvents: MatterEvent[] = [
  {
    id: "event-003",
    type: "fact.review.requested",
    title: "Three medical facts need review",
    detail: "QME extraction completed with source-linked candidate facts.",
    timestamp: "Aug 20, 2026 · 9:12 AM",
    actor: "Athena Document Worker",
  },
  {
    id: "event-002",
    type: "document.processed",
    title: "QME report processed",
    detail: "42 pages scanned, classified, and indexed. Original preserved.",
    timestamp: "Aug 20, 2026 · 9:11 AM",
    actor: "Athena Document Worker",
  },
  {
    id: "event-001",
    type: "matter.imported",
    title: "Matter imported",
    detail: "Matter structure reconciled from a synthetic legacy export.",
    timestamp: "Aug 19, 2026 · 4:34 PM",
    actor: "Jordan Lee",
  },
];

export const integrationHealth: IntegrationHealth[] = [
  { name: "Microsoft 365", status: "not_connected", detail: "App registration and tenant consent required" },
  { name: "MerusCase", status: "not_connected", detail: "Provider access and endpoint verification required" },
  { name: "OCR", status: "not_connected", detail: "Provider security review and BAA required" },
  { name: "AI", status: "not_connected", detail: "Production regulated-data processing is disabled" },
];

export const workItems: WorkItem[] = [
  { id: "work-001", priority: "Critical", caption: "Rivera v. Northstar Logistics", matterNumber: "NRL-2026-0042", client: "Summit Claims", action: "Verify QME findings", owner: "Maya Chen", due: "Today · 4:00 PM", overdue: false, reason: "Client report deadline starts after review", status: "Needs review", statusTone: "warning" },
  { id: "work-002", priority: "Critical", caption: "Nguyen v. Arcadia Foods", matterNumber: "NRL-2026-0031", client: "Pacific TPA", action: "Resolve filing rejection", owner: "Docketing", due: "Overdue · 1 day", overdue: true, reason: "EAMS packet rejected: separator sheet", status: "Blocked", statusTone: "danger" },
  { id: "work-003", priority: "High", caption: "Harris v. Westline Transit", matterNumber: "NRL-2025-0188", client: "Summit Claims", action: "Approve status report", owner: "Maya Chen", due: "Tomorrow", overdue: false, reason: "90-day client reporting obligation", status: "Draft ready", statusTone: "info" },
  { id: "work-004", priority: "High", caption: "Cruz v. Ember Manufacturing", matterNumber: "NRL-2026-0019", client: "Vantage Casualty", action: "Request settlement authority", owner: "Maya Chen", due: "Aug 24", overdue: false, reason: "MSC is within 30 days", status: "Ready", statusTone: "success" },
  { id: "work-005", priority: "Normal", caption: "Patel v. Bellwether Health", matterNumber: "NRL-2025-0154", client: "Pacific TPA", action: "Confirm candidate time", owner: "Maya Chen", due: "Today", overdue: false, reason: "Five activities totaling 1.7 hours", status: "9 entries", statusTone: "neutral" },
];

export const matterInventory: MatterInventoryItem[] = [
  { ...goldenMatter, reportRisk: true },
  { id: "matter-002", matterNumber: "NRL-2026-0031", caption: "Nguyen v. Arcadia Foods", client: "Pacific TPA", employer: "Arcadia Foods, LLC", applicant: "Minh Nguyen", claimNumber: "PTPA-413920", adjNumber: "ADJ18110382", injuryDate: "2025-09-17", assignedAttorney: "Maya Chen", status: "Open", nextEvent: "Deposition · Aug 27", reportDue: "Aug 25, 2026", authorityStatus: "None", exposure: 78000, unbilledHours: 2.2, reportRisk: false },
  { id: "matter-003", matterNumber: "NRL-2025-0188", caption: "Harris v. Westline Transit", client: "Summit Claims Services", employer: "Westline Transit", applicant: "Jordan Harris", claimNumber: "SCS-CA-773102", adjNumber: "ADJ17642011", injuryDate: "2024-12-02", assignedAttorney: "Maya Chen", status: "Open", nextEvent: "QME · Sep 3", reportDue: "Tomorrow", authorityStatus: "$45,000", exposure: 92000, unbilledHours: 0.9, reportRisk: true },
  { id: "matter-004", matterNumber: "NRL-2026-0019", caption: "Cruz v. Ember Manufacturing", client: "Vantage Casualty", employer: "Ember Manufacturing", applicant: "Sofia Cruz", claimNumber: "VC-992103", adjNumber: "ADJ17930844", injuryDate: "2025-06-21", assignedAttorney: "Noah Williams", status: "Open", nextEvent: "MSC · Sep 18", reportDue: "Sep 2, 2026", authorityStatus: "Requested", exposure: 134000, unbilledHours: 3.4, reportRisk: false },
  { id: "matter-005", matterNumber: "NRL-2025-0154", caption: "Patel v. Bellwether Health", client: "Pacific TPA", employer: "Bellwether Health", applicant: "Ravi Patel", claimNumber: "PTPA-388410", adjNumber: "ADJ17123992", injuryDate: "2024-08-15", assignedAttorney: "Elena Torres", status: "Stayed", nextEvent: "Status conference · Oct 8", reportDue: "Sep 15, 2026", authorityStatus: "$85,000", exposure: 106000, unbilledHours: 1.7, reportRisk: false },
];
