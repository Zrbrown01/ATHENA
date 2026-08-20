import type { CandidateFact, IntegrationHealth, MatterEvent, MatterSummary } from "./types";

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
