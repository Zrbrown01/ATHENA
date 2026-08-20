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

## Object keys

R2 keys begin with the tenant ID. Original uploads use `<tenant>/<matter-or-unassigned>/<document>/original.pdf`. Exports use `<tenant>/exports/<matter>/<export>/manifest.json`. Authorization is checked before metadata lookup and download; object keys are never accepted from the browser.

## Migration rule

Every D1 schema change is generated through Drizzle, inspected for backward compatibility, committed, packaged, and applied by Sites. Indexes follow actual tenant/matter/run query predicates and each migration ends with `PRAGMA optimize` after index changes.
