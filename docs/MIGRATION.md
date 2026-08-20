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

The Release 1 pilot imports one synthetic MerusCase-shaped record with a stable source ID and emits `matter.imported`. This proves the adapter boundary and durable workflow stage only. It does not validate an actual MerusCase endpoint or historical package.

## Commands

Generate target PostgreSQL migrations with `npm run db:generate:postgres`. Generate D1 pilot migrations with `npm run db:generate`; apply locally with `npm run db:migrate:local`. Production D1 migrations are packaged and applied by Sites.
