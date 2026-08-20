export const companionFixture = {
  runId: "companion-rivera-release-one",
  matterId: "matter-golden-001",
  matter: {
    sourceSystem: "meruscase_deterministic_sandbox",
    sourceRecordId: "sandbox-merus-matter-0042",
    matterNumber: "NRL-2026-0042",
    caption: "Rivera v. Northstar Logistics",
    claimNumber: "SCS-CA-884103",
    injuryDate: "2025-11-04",
    adjNumber: "ADJ18420931",
  },
  document: {
    id: "fixture-qme-rivera-20260818",
    title: "QME Report — Dr. Priya Shah — 08/18/2026",
    classification: "QME report",
    providerMode: "deterministic_sandbox",
    sourceChecksum: "fixture-only-not-an-original-file",
  },
  facts: [
    { id: "fact-001", type: "wpi", value: "12% WPI — lumbar spine", page: 27 },
    { id: "fact-002", type: "apportionment", value: "80% industrial / 20% pre-existing", page: 31 },
    { id: "fact-003", type: "work_restriction", value: "No lifting over 25 lb; alternate sitting and standing", page: 29 },
  ],
  workProduct: {
    id: "draft-rivera-qme-analysis",
    type: "qme_analysis",
    title: "QME Analysis — Rivera v. Northstar Logistics",
    body: "Dr. Priya Shah assigns 12% whole person impairment for the lumbar spine, apportions permanent disability 80% to the industrial injury and 20% to pre-existing degeneration, and recommends a permanent 25-pound lifting limit with position changes. Attorney verification of each cited finding is required before client delivery.",
  },
  time: {
    id: "time-rivera-qme-analysis",
    minutes: 72,
    narrative: "Review QME report; analyze impairment, apportionment, and restrictions; prepare client status analysis.",
    taskCode: "L120",
    activityCode: "A104",
  },
} as const;
