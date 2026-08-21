# Migration Center

## Pipeline

Source inventory → immutable export package → source-record registration → mapping/version → validation → staged import → exceptions → counts/checksums/reconciliation → user acceptance → delta freeze → cutover → read-only legacy archive.

## Non-negotiable controls

- Preserve source system and record IDs on every imported record.
- Keep raw export packages immutable and checksummed.
- Separate Matter, Claim, Injury, and ADJ during mapping; do not flatten legacy convenience fields.
- Make batches resumable and idempotent; a retry cannot duplicate matters, documents, events, or billing.
- Quarantine all imported files until scanning policy passes.
- Record transformations, rejected rows, manual corrections, approver, and reconciliation evidence.
- Test tenant boundaries and ethical walls before user acceptance.
- Produce a complete exception report and rollback/cutover decision record.

## Current deterministic adapter

The Release 1 pilot imports one synthetic MerusCase-shaped record with stable entity-level source IDs and emits `matter.imported`. A separate authenticated graph command now persists Matter, Claim, Injury, and ADJ rows plus typed, provenanced relationships and emits `matter.graph_materialized`. Repeating an idempotency key cannot duplicate the event/outbox write. This proves the normalized adapter boundary only; it does not validate an actual MerusCase endpoint, historical package, transformation ledger, or source-to-target reconciliation.

The native intake path is separate from legacy import: a preserved deterministic referral first becomes an Intake Candidate. Explainable duplicate-match evidence, source-referenced conflict findings, and a missing-field ledger are revisioned gates; approval cannot create/open the Matter row until all three are resolved. Provider-backed matching and conflict indexes remain unavailable.

## Commands

Generate target PostgreSQL migrations with `npm run db:generate:postgres`. Generate D1 pilot migrations with `npm run db:generate`; apply locally with `npm run db:migrate:local`. Production D1 migrations are packaged and applied by Sites.
