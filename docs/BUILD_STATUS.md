# Build Status

Updated: 2026-08-20

## Current slice

**Objective:** Complete the master specification's first deterministic production-shaped vertical slice while preserving honest external boundaries.

## Repository inspection

- **Framework/runtime:** Vinext on Vite/Cloudflare Workers, React 19, strict TypeScript, Sites deployment.
- **Persistence:** Drizzle PostgreSQL target schema and migrations; Sites-managed D1 pilot schema; R2 original-object quarantine.
- **Identity:** owner-only Sites access plus authenticated-user headers in hosted mode; explicit synthetic identity only in local development.
- **Testing:** Vitest, Testing Library, ESLint, TypeScript, production build, npm audit. Tests cover fact and workflow authorization, write-origin checks, PDF upload validation, the seven-stage companion state machine, billing rules, export manifests, and pilot accessibility.
- **Architecture:** modular monolith with domain commands, provider-neutral adapters, immutable event envelopes, and transactional outbox writes.

## Existing-feature map and completion audit

| Requirement area | Current evidence | Audit result |
|---|---|---|
| Experience foundation | Semantic tokens, shell, queue/table floorplans, focus/reduced-motion styles, responsive layout | Functional foundation; density, command palette, context-panel focus management, and automated accessibility proof remain |
| Platform foundation | Authenticated headers, tenant-aware target schema, D1 events/outbox, R2 keys | Partial; contextual authorization, audit/access events, publisher/retries, rate limits, export, backup evidence remain |
| Domain foundation | Matter/Claim/Injury/ADJ separation, evidence facts, human decision records | Partial; live pilot data is narrower than canonical target model |
| Release 1 golden loop | Durable seven-stage companion, source-linked fixture analysis, draft approval, blocked delivery handoff, time/billing, audit/event/outbox writes, downloadable export | Complete as a deterministic owner-only pilot; live provider activation and production-scale controls remain explicitly outside this proof |
| Native core and California operations | Coherent screens and selected approval commands | Product-shaped foundation; most records are synthetic fixtures, not complete vertical slices |
| External providers | Disabled adapters and visible not-connected health | Correctly externally blocked; deterministic sandboxes still required for full golden tests |

## Dependency inventory

- Runtime: React, Next/Vinext, Drizzle ORM, Zod, CUID2, Lucide.
- Build/deployment: Vite, Cloudflare Worker/Vite plugin, Sites plugin, Wrangler.
- Quality: ESLint, TypeScript, Vitest, Testing Library, jsdom.
- No production OCR, AI, email, MerusCase, EAMS/JET, Noted, Verbatim, telephony, malware scanner, or billing provider SDK is installed.

| Capability | Status | Evidence / limitation |
|---|---|---|
| Application shell and Matter Workspace | Functional | Desktop-first shell, sticky matter header, overview, work queue, timeline, responsive mode |
| Operational modules | Functional pilot | Intake, conflicts, docket, documents, communications, billing, reports, clients, California operations, and resolution views |
| Matter Graph kernel | Foundation | Typed PostgreSQL tables keep Matter, Claim, Injury, and ADJ separate; pilot fixtures exercise the graph |
| Evidence and provenance | Foundation | Documents and fact observations include original identity, page/excerpt, method, confidence, review, conflicts, and supersession |
| Human fact review | Functional | Confirm/reject command is authenticated, validated, persisted with actor/event/outbox, and has a visible failure state |
| Human workflow gates | Functional pilot | Intake, authority, time, report, and filing decisions are validated and persisted with immutable event context |
| Release 1 companion workflow | Tested pilot | Seven-stage persistent deterministic workflow proves import, source-linked QME analysis, Verbatim-shaped draft, attorney approval, honest Microsoft block, confirmed time, billing validation, audit/event/outbox, and export |
| Event Ledger | Functional pilot | Canonical immutable event table/envelope plus tenant-scoped internal delivery receipts |
| Reliable event delivery | Tested pilot | Leases, recovery, exponential retry/dead-letter/replay policy, Athena-native publisher, and health projection; no external provider delivery is implied |
| Tenant isolation | Pilot boundary | Owner-only site identity is required; keys and queries are tenant-scoped. Multi-tenant production policy/RLS remains |
| Document ingestion | Quarantined pilot | PDF MIME/signature/size checks, SHA-256, R2 originals, D1 metadata, compensating delete, and quarantine state. Malware scanning/OCR remain disconnected |
| Microsoft 365 | Externally blocked | Adapter foundation only; app registration, credentials, consent, scopes, and verification required |
| MerusCase | Externally blocked | Provider relationship, documentation, credentials, export samples, and endpoint verification required |
| OCR | Externally blocked | Provider selection, security review, BAA, and credentials required |
| AI extraction | Externally blocked | Production use disabled pending provider approval; deterministic golden candidates are UI fixtures |
| Governance Engine | Pilot gates | Explicit human-approval commands cover legally/financially consequential pilot workflows; configurable rule engine remains |
| Billing | Functional pilot | Human time-confirmation gate and synthetic pre-bill view; no accounting export or connected ledger |
| Audit | Functional pilot | Material companion transitions create actor-attributed audit records plus immutable events; read/access audit and incident operations remain |
| Export | Tested partial-export control | Authorized tenant/matter-scoped, checksummed R2 manifest v2 includes record inventory, coverage ledger, audit/delivery/hold metadata, and an enforced partial label/header when original bytes are absent; complete archive packaging remains required |

## Module status matrix

| Module | Status | Test/evidence and remaining scope |
|---|---|---|
| Intake and conflicts | Functional pilot | Approval persists; extraction, duplicate/alias/relationship search, secured matters, and deadline generation remain fixture-only |
| Native Matter Graph | Foundation | Target schema separates Matter/Claim/Injury/ADJ; live D1 workflow does not yet persist the full graph |
| Medical and med-legal | Functional pilot | Exact-page QME candidates and review are tested; provider/OCR and full QME/AME cycle remain blocked/incomplete |
| Documents/evidence | Tested quarantine slice | PDF security tests, tenant R2 keys, checksums, metadata, and compensation; scanning/release, versions, preview, processing, and full export remain |
| Communications | Externally blocked | Retryable Microsoft handoff is persisted and never labeled sent; Graph connection/sync/delivery remain unavailable |
| Calendar/docketing | Product foundation | Docket view and filing gate; durable deadlines, business-day rules, recurrence, chains, and readiness records remain |
| Court/EAMS | Externally blocked | Packet approval and honest health; versioned forms/packet validation/status adapter remain |
| Proceedings/readiness | Product foundation | California queue view; structured readiness evaluator remains |
| Records/subpoenas | Not started | Domain and end-to-end lifecycle remain |
| Authority/settlement | Functional pilot | Matter-scoped human authority decision persists; full historical ledger/readiness/payment/closure effects remain |
| Billing | Tested pilot | Confirmed time and versioned rule pass/warning/hard-stop tests; rates, expenses, prebills, invoices, LEDES, rejections, appeals, payments remain |
| Reports | Functional pilot | Draft approval and source-linked companion work product; governed definitions, delivery, and automated schedules remain |
| Client portal | Externally blocked | Access intentionally disabled; authorization/data-sharing design required before any external user |
| Administration | Functional pilot | Integration truth plus owner-only outbox, retention, and deadline operations; full users/roles/holds/incidents/support/export/migration controls remain |
| Noted | Externally blocked | Adapter/lifecycle not implemented; no booking is claimed |
| Verbatim | Tested sandbox slice | Deterministic source-linked work product and approval; audio/transcription/review provider lifecycle remains unavailable |
| Search / Ask Athena | Not started / externally blocked | AI is disabled; secure structured/full-text search and source-grounded retrieval remain |
| Migration Center | Foundation | Deterministic source-ID import event and migration plan; historical adapter/reconciliation/cutover remain |
| Trust control plane | Foundation | Disabled adapter contract, health states, events/outbox; retries/dead letters/cursors/subscriptions/replay remain |
| Security/compliance | In progress | Auth headers, owner-only access, authorization tests, origin checks, CSP/secure headers; RLS/walls/rate limits/access review/restore/pen test remain |

## Security risks requiring resolution

1. Local development uses an explicit synthetic identity; hosted production-mode requests require platform-authenticated identity headers.
2. D1 does not provide PostgreSQL RLS; multi-tenant production policy enforcement and isolation testing remain required.
3. Uploaded PDFs remain quarantined because malware scanning and OCR are not connected; deterministic fixture processing never releases an uploaded file.
4. Rate limiting, ethical-wall persistence, support access, formal access review, retention/legal-hold enforcement, and complete tenant export are not implemented.
5. AI and external integrations are disabled and must remain so until approved.

## Next implementation slice

1. Complete archive packaging including original bytes and restoration verification; current manifests correctly block a complete label when bytes are absent.
2. Obligation creation/completion and attorney-reviewed California rule/holiday content.
3. Ethical-wall administration and negative end-to-end tests for search, AI retrieval, caches, jobs, and support access.
4. Automated outbox scheduling plus external consumer idempotency and reconciliation after provider approval.
5. Approved malware scanning/OCR pipeline with quarantine release; complete backup/restore and incident exercises.
