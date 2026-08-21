# Data Model

## Two explicit persistence surfaces

`src/db/schema.ts` is the normalized PostgreSQL target model. `db/schema.ts` is the Sites/D1 private-pilot implementation. This distinction is intentional and must remain visible until the pilot migrates to the production relational control plane.

## Canonical target kernel

- Identity: Tenant, User.
- Matter Core: Matter, Claim, Injury, ADJ/WCAB Case.
- Evidence: Document original identity and Fact Observation with normalized value, source page/excerpt, extraction method, confidence, verification, supersession, and conflict group.
- Trust: immutable Business Event and transactional Outbox Message.

The target model must expand by domain rather than accumulating unrelated JSON. Tenant-owned rows carry `tenant_id`; canonical records carry timestamps, actor attribution, version, status, and archival state where applicable.

## Live pilot tables

| Table | Ownership and purpose |
|---|---|
| `document_intakes` | tenant/matter-scoped quarantined R2 original metadata and checksum |
| `fact_reviews` | human fact verification/rejection decisions |
| `workflow_decisions` | intake, authority, time, report, and filing approvals |
| `companion_runs` | durable current stage of the deterministic Release 1 workflow |
| `work_product_drafts` | source-linked Verbatim-shaped draft and approval state |
| `integration_handoffs` | explicit external operation, provider mode, retryability, and activation requirement |
| `candidate_time_entries` | confirmed time, narrative, and UTBMS codes |
| `billing_validations` | versioned rule outcome and explanation |
| `export_jobs` | authorized R2 artifact identity, checksum, size, and manifest version |
| `audit_records` | actor, action, resource, outcome, reason, and request identity |
| `preview_events` | immutable business-event envelope |
| `preview_outbox` | reliable outgoing work pending processing/reconciliation |
| `governance_rules` | immutable tenant/code/version calculation content with explicit synthetic, pending-review, or attorney-approved status |
| `obligations` | matter-scoped rule snapshot, trigger provenance, calculation trace, owner/revision, and completion or cancellation evidence |
| `access_decision_events` | content-free immutable allow/deny evidence by tenant, actor, matter, data plane, reason code, request, and time |
| `rate_limit_windows` | durable atomic per-actor/per-action fixed-window counters and expiry metadata |
| `support_access_grants` | one synthetic support identity, matter, purpose, ticket, mandatory expiry, approval/revocation actors, status, and revision |
| `access_review_attestations` | defined review period, reviewer outcome/notes, and a count-only snapshot of active access controls and decisions |
| `outbox_consumer_checkpoints` | one tenant/consumer/event processing checkpoint with outbox identity, payload hash, and processing time |
| `outbox_reconciliation_runs` | trigger, processed/checkpoint/receipt counts, exception count, outcome, detail, and run timestamps |
| `retention_disposition_reviews` | policy snapshot, hold state, evaluator outcome/reason, human conclusion/notes, reviewer, and time; never a deletion command |
| `matters`, `claims`, `injuries`, `adjudication_cases` | separate tenant-scoped identities for the live golden matter graph; claims, injuries, and WCAB cases are never convenience fields on Matter |
| `source_record_links` | entity-level source system/record identity, provider mode, and import time for provenance and idempotent reconciliation |
| `matter_relationships` | typed graph edges whose endpoints and source provenance are validated before persistence |
| `intake_candidates` | preserved referral identity, proposed matter scope, extracted core identifiers, missing-field ledger, lifecycle status, and optimistic revision |
| `intake_match_candidates`, `conflict_findings` | explainable possible-duplicate evidence and separately resolved, source-referenced conflict findings |
| `intake_review_decisions` | immutable reviewer action, transition, reason, actor, event, and idempotency evidence |
| `persons`, `organizations`, `party_aliases`, `matter_parties` | canonical people/organization identities, normalized alias lookup, role-compatible matter assignments, claim/injury/ADJ scope, and source-link provenance |

## Object keys

R2 keys begin with the tenant ID. Original uploads use `<tenant>/<matter-or-unassigned>/<document>/original.pdf`. Exports use `<tenant>/exports/<matter>/<export>/matter-archive.tar`. Authorization is checked before metadata lookup and download; object keys are never accepted from the browser.

## Migration rule

Every D1 schema change is generated through Drizzle, inspected for backward compatibility, committed, packaged, and applied by Sites. Indexes follow actual tenant/matter/run query predicates and each migration ends with `PRAGMA optimize` after index changes.

## Export completeness

`export_jobs` records the tenant, matter, run, object identity, checksum, byte size, archive entry count, format, manifest version, creator, restoration verification timestamp, and immutable completeness assessment. `completeness=complete` is permitted only when every required category is bundled and every included original passes a read-back checksum. `missing_items` and the manifest coverage ledger make omissions machine-readable; a downloadable partial export is never labeled complete.

The deterministic QME processor creates a valid synthetic PDF with a pinned SHA-256 and `trusted_synthetic_fixture` storage metadata. This generated fixture may enter `ready` without a malware provider because it contains fixed source-controlled text and no user bytes. User uploads remain `awaiting_scan` and are not given the same trust path.
