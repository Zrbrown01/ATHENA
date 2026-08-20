# Event Catalog

## Envelope

Every event contains event ID/type/version, tenant, aggregate type/ID, optional matter, actor, timestamp, correlation and optional causation IDs, idempotency key, source, visibility, retention policy, and typed payload. Business state and its outbox record are written in one D1 batch for the pilot.

## Implemented events

| Event | Trigger | Material payload |
|---|---|---|
| `document.intake_received` | authorized PDF quarantine | title, size, MIME, checksum, classification, scan status |
| `fact.verified` / `fact.rejected` | human fact review | decision, edit/reason, human authorization |
| `intake.*` | intake decision | action, reason, human authorization |
| `authority.*` | authority decision | action, reason, human authorization |
| `time.*` | time decision | action, reason, human authorization |
| `report.*` | report decision | action, reason, human authorization |
| `filing.*` | packet decision | action, reason, human authorization |
| `matter.imported` | deterministic companion import | from/to stage and sandbox provider mode |
| `medical.analysis_ready` | deterministic QME processor | from/to stage and sandbox provider mode |
| `work_product.draft_created` | Verbatim-shaped deterministic draft | from/to stage and sandbox provider mode |
| `report.approved` | attorney approval | human authorization and stage transition |
| `email.handoff_blocked` | Microsoft delivery handoff | disabled-provider mode; never “sent” |
| `time.confirmed` | attorney time confirmation | human authorization and stage transition |
| `export.ready` | checksummed matter export | human authorization and stage transition |

## Delivery guarantees and gaps

Event and outbox uniqueness is enforced per tenant/idempotency key. Consumer idempotency, retry/dead-letter processing, reconciliation dashboards, and provider-event replay remain incomplete and are tracked as platform risks. The timeline must ultimately project this ledger rather than maintain separate manual history.
