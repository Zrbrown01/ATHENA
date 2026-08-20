# Build Status

Updated: 2026-08-20

## Current slice

**Objective:** Deliver a private, synthetic-data operational pilot with honest external boundaries and persisted human approvals.

| Capability | Status | Evidence / limitation |
|---|---|---|
| Application shell and Matter Workspace | Functional | Desktop-first shell, sticky matter header, overview, work queue, timeline, responsive mode |
| Operational modules | Functional pilot | Intake, conflicts, docket, documents, communications, billing, reports, clients, California operations, and resolution views |
| Matter Graph kernel | Foundation | Typed PostgreSQL tables keep Matter, Claim, Injury, and ADJ separate; pilot fixtures exercise the graph |
| Evidence and provenance | Foundation | Documents and fact observations include original identity, page/excerpt, method, confidence, review, conflicts, and supersession |
| Human fact review | Functional | Confirm/reject command is authenticated, validated, persisted with actor/event/outbox, and has a visible failure state |
| Human workflow gates | Functional pilot | Intake, authority, time, report, and filing decisions are validated and persisted with immutable event context |
| Event Ledger | Foundation | Canonical immutable event table and envelope |
| Reliable event delivery | Foundation | Transactional outbox writes exist in D1; publisher/retry/reconciliation worker is not implemented |
| Tenant isolation | Pilot boundary | Owner-only site identity is required; keys and queries are tenant-scoped. Multi-tenant production policy/RLS remains |
| Document ingestion | Quarantined pilot | PDF MIME/signature/size checks, SHA-256, R2 originals, D1 metadata, compensating delete, and quarantine state. Malware scanning/OCR remain disconnected |
| Microsoft 365 | Externally blocked | Adapter foundation only; app registration, credentials, consent, scopes, and verification required |
| MerusCase | Externally blocked | Provider relationship, documentation, credentials, export samples, and endpoint verification required |
| OCR | Externally blocked | Provider selection, security review, BAA, and credentials required |
| AI extraction | Externally blocked | Production use disabled pending provider approval; deterministic golden candidates are UI fixtures |
| Governance Engine | Pilot gates | Explicit human-approval commands cover legally/financially consequential pilot workflows; configurable rule engine remains |
| Billing | Functional pilot | Human time-confirmation gate and synthetic pre-bill view; no accounting export or connected ledger |
| Audit | Foundation | Business events exist; separate security/access audit persistence remains |
| Export | Not started | Complete tenant export is required before any production pilot |

## Security risks requiring resolution

1. Local development uses an explicit synthetic identity; hosted production-mode requests require platform-authenticated identity headers.
2. D1 does not provide PostgreSQL RLS; multi-tenant production policy enforcement and isolation testing remain required.
3. Uploaded PDFs remain quarantined because malware scanning and OCR are not connected.
4. Rate limiting, support access, formal access review, retention automation, and complete export are not implemented.
5. AI and external integrations are disabled and must remain so until approved.

## Next implementation slice

1. Independent security review and production authorization model.
2. Multi-tenant policy enforcement, negative integration tests, access review, and support controls.
3. Approved malware scanning/OCR pipeline with quarantine release workflow.
4. Outbox publisher with retries, dead letters, reconciliation, and operational alerting.
5. Complete tenant export, retention/hold automation, backup/restore evidence, and disaster-recovery exercises.
