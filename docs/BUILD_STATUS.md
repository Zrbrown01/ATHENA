# Build Status

Updated: 2026-08-20

## Current slice

**Objective:** Establish the isolated Athena repository and the first source-linked QME fact-review walking skeleton.

| Capability | Status | Evidence / limitation |
|---|---|---|
| Application shell and Matter Workspace | Functional | Desktop-first shell, sticky matter header, overview, work queue, timeline, responsive mode |
| Matter Graph kernel | Foundation | Typed PostgreSQL tables keep Matter, Claim, Injury, and ADJ separate |
| Evidence and provenance | Foundation | Documents and fact observations include original identity, page/excerpt, method, confidence, review, conflicts, and supersession |
| Human fact review | Functional | Confirm/reject command has validation, matter authorization, role authorization, event output, and visible failure state |
| Event Ledger | Foundation | Canonical immutable event table and envelope |
| Reliable event delivery | Foundation | Transactional outbox schema exists; publisher worker is not implemented |
| Tenant isolation | In progress | Tenant context and negative unit tests exist; production identity and database RLS remain |
| Document ingestion | Not started | Metadata schema exists; upload, storage, malware scanning, and OCR are not implemented |
| Microsoft 365 | Externally blocked | Adapter foundation only; app registration, credentials, consent, scopes, and verification required |
| MerusCase | Externally blocked | Provider relationship, documentation, credentials, export samples, and endpoint verification required |
| OCR | Externally blocked | Provider selection, security review, BAA, and credentials required |
| AI extraction | Externally blocked | Production use disabled pending provider approval; deterministic golden candidates are UI fixtures |
| Governance Engine | Not started | Required in a subsequent foundation slice |
| Billing | Not started | UI displays candidate total only; no calculations or records yet |
| Audit | Foundation | Business events exist; separate security/access audit persistence remains |
| Export | Not started | Must be completed before pilot |

## Security risks requiring resolution

1. The API currently uses an explicit development identity adapter.
2. Database row-level security policies and tenant-aware repository helpers are not yet implemented.
3. File upload, scanning, quarantine, content validation, and object isolation do not yet exist.
4. Rate limiting, production CSRF/origin strategy, support access, and access review are not implemented.
5. AI and external integrations are disabled and must remain so until approved.

## Next implementation slice

1. Production-shaped identity interface and database-backed authorization policies.
2. PostgreSQL migration tooling, row-level security, and integration tests.
3. Secure document upload session, storage adapter, checksum, quarantine, and deterministic test scanner.
4. Persist fact-review decisions and events atomically with the outbox.
5. Outbox worker with idempotent delivery, retries, dead letters, and reconciliation.
