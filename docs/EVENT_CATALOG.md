# Event Catalog

## Envelope

Every event contains event ID/type/version, tenant, aggregate type/ID, optional matter, actor, timestamp, correlation and optional causation IDs, idempotency key, source, visibility, retention policy, and typed payload. Business state and its outbox record are written in one D1 batch for the pilot.

## Implemented events

| Event | Trigger | Material payload |
|---|---|---|
| `document.intake_received` | authorized PDF quarantine | title, size, MIME, checksum, classification, scan status |
| `fact.verified` / `fact.rejected` | human fact review | decision, edit/reason, human authorization |
| `intake.*` | intake decision | action, reason, human authorization |
| `intake.candidate_created` / `intake.match_resolved` / `intake.conflict_cleared` / `intake.information_supplied` / `intake.matter_opened` | durable intake lifecycle | content-free transition, gate counts, human authorization, and deterministic provider mode |
| `authority.*` | authority decision | action, reason, human authorization |
| `time.*` | time decision | action, reason, human authorization |
| `report.*` | report decision | action, reason, human authorization |
| `filing.*` | packet decision | action, reason, human authorization |
| `matter.imported` | deterministic companion import | from/to stage and sandbox provider mode |
| `matter.graph_materialized` | authorized normalized graph write | entity counts, deterministic provider mode, and explicit non-flattened state; no matter content |
| `matter.party_roster_materialized` | authorized party graph write | person, organization, alias, role, and source-link counts only |
| `task.*` | authorized task lifecycle | transition, incomplete-dependency count, and human authorization |
| `records.*` | records/subpoena lifecycle | transition and human authorization; explicitly no external provider operation |
| `authority.*` | candidate and historical ledger lifecycle | classification, human authorization, and historical-ledger marker; source content remains in the scoped candidate record |
| `closure.*` / `matter.closed` / `matter.reopened` | closure checklist and status lifecycle | checklist item, blocking-work count, human authorization, and history-preservation marker |
| `medical.analysis_ready` | deterministic QME processor | from/to stage and sandbox provider mode |
| `work_product.draft_created` | Verbatim-shaped deterministic draft | from/to stage and sandbox provider mode |
| `report.approved` | attorney approval | human authorization and stage transition |
| `email.handoff_blocked` | Microsoft delivery handoff | disabled-provider mode; never “sent” |
| `time.confirmed` | attorney time confirmation | human authorization and stage transition |
| `export.ready` | checksummed matter export | human authorization and stage transition |

## Delivery guarantees

Event and outbox uniqueness is enforced per tenant/event/topic. The pilot outbox has explicit pending, leased, processed, and dead-letter states; expiring leases; exponential retry policy; a five-attempt ceiling; operator replay; tenant health projection; immutable delivery receipts; and per-consumer event checkpoints. The implemented sink is `athena_internal_event_bus` only and never represents Microsoft, EAMS, MerusCase, OCR, AI, or another external provider as delivered.

A Worker scheduled handler is configured every five minutes to drain only the Athena-native sink and record a count reconciliation across processed outbox rows, consumer checkpoints, and delivery receipts. The same cycle is available to owner operators as a tested fallback. The handler passes Cloudflare's local scheduled-event route, but the Sites production deployment produced no reconciliation row after the next cron tick and exposes no cron-status control. Automated activation is therefore **not connected** on Sites. Activation requires a hosting runtime that enables the declared Worker cron (or Sites cron support), followed by a fresh `cron:` reconciliation timestamp with zero exceptions. Provider-specific checkpoints, signed webhook delivery, high-volume partitioning, and reconciliation against external systems remain production work.
