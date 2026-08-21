# Architecture

## Direction and deployment profile

Athena begins as a modular monolith: one web application, one canonical PostgreSQL database, background workers, durable workflows, and separately scalable document processing when required. Domain boundaries are explicit even though deployment is initially unified.

The current owner-only pilot runs on Sites with a Cloudflare Worker, D1, and R2. D1 is a deployment-local persistence implementation for the pilot; it does not replace the PostgreSQL target or provide PostgreSQL row-level security. R2 holds tenant-scoped quarantined originals and generated exports. Provider-shaped deterministic fixtures prove workflow orchestration without claiming that any external provider is connected.

## Runtime boundaries

1. **Web/API:** authenticated commands and permission-filtered queries.
2. **Relational persistence:** D1 in the Sites pilot; PostgreSQL remains the production target for relational current state, immutable business events, audit records, provenance, and the transactional outbox.
3. **Object storage:** encrypted originals and distinguishable derived objects.
4. **Workers:** scanning, OCR, extraction, event delivery, reconciliation, exports, and report generation.
5. **Durable workflows:** legal deadlines, approvals, QME cycles, filing, billing, migration, and other work that must survive restarts.
6. **Integration control plane:** provider connections, subscriptions, cursors, idempotency, retries, dead letters, backfill, reconciliation, and revocation.

Tenant portability archives are assembled server-side by discovering every Drizzle table and requiring its tenant column. Table reads use 500-row pages with global 50,000-row and 64 MiB estimated/final TAR ceilings. A ceiling stops before R2 persistence and writes durable failed-job/decision/event/outbox evidence; successful archives are stored under `<tenant>/exports/tenant/<export>/` and committed to D1 only after R2 creation and archive read-back verification. Database failure triggers compensating object deletion. Schema-table and original-object coverage are machine-readable completeness gates. TAR construction remains in-memory rather than streaming.

Cost governance uses versioned tenant rate cards and immutable usage entries. Rates and computed totals are stored as integer micro-dollars to prevent floating-point accounting errors; usage remains attributable to workflow and optional matter scope. `estimated`, `provider_verified`, and `not_billable` are distinct states. A synthetic rate card can never produce provider-verified cost, and the current pilot has no provider invoice, client charge, or accounting posting adapter.

Revision checks are enforced both before decision construction and inside the atomic persistence batch. For cost-rate-card approval, Athena first inserts a unique tenant/aggregate/expected-revision claim in the same D1 batch as the guarded current-state update, immutable decision, business event, and outbox write. Two commands may read the same revision, but only one can claim it; the other batch rolls back and returns `409 Conflict`. This closes the read-check/write race for this financial control. Other revisioned aggregates still require equivalent adversarial database-concurrency proof before production authorization.

## Current state plus history

Athena does not use full event sourcing. The application writes queryable relational current state while also preserving immutable business events, fact observations, audit events, and historical ledgers. Business updates and outgoing events will commit together through the outbox pattern.

## Request observability

The global Worker boundary creates or accepts a syntactically bounded request ID, extracts a W3C trace ID when present, and returns both plus `Server-Timing` on every response. One structured request record contains method, safe route template, status, duration, application version, outcome, and a truncated SHA-256 actor reference when authenticated. It never includes URL queries, request/response bodies, auth tokens, email addresses, medical facts, work product, or error messages. Dynamic export identities are replaced with `:id`. The current record goes only to Worker logs; a governed external sink, retention/access policy, metrics/tracing backend, anomaly rules, and alert delivery remain required.

## Tenant isolation

Every tenant-owned record carries `tenant_id`. Production queries must receive tenant context from verified identity claims, include tenant predicates, and use PostgreSQL row-level security as defense in depth. Isolation also applies to object keys, cache keys, jobs, search documents, events, logs, exports, and AI retrieval.

After tenant/matter authorization, the resource-classification boundary evaluates a versioned label set against the requested data plane. The pilot persists policy versions, active resource labels, bounded overrides, and immutable decisions. Search, export creation, and archive download are representative wired adapters; remaining planes are proven in the governed fixture but not yet globally intercepted.

Hosted pilot requests require platform-authenticated identity headers and the site is owner-only. A secret runtime allowlist maps only the configured Sites account ID to pilot attorney/partner privileges; authenticated identities without an explicit mapping receive no roles and no matter access. Support uses a separate allowlist and still requires a matter-scoped persisted grant. Local development uses an explicit synthetic identity. These controls are fail-closed pilot boundaries, not the final multi-tenant directory, session-revocation, or PostgreSQL RLS design.

The browser/API isolation gate sends explicit owner, unknown, and configured-support principals through representative finance, evidence, tenant-export, search, matter-graph, and support routes. Only the owner can read ordinary pilot data; support remains denied without a current matter-scoped grant. A valid foreign-tenant finance command is rejected before persistence and leaves the golden-tenant projection unchanged. This is repeatable local integration evidence; it is not independently operated hosted multi-account or PostgreSQL RLS assurance.

## Domain boundaries

- Identity & Access
- Matter Core
- Evidence
- Work
- Communications
- California WC
- Resolution
- Finance
- Reporting
- Integrations
- Platform Trust

Cross-domain activity uses typed commands and versioned events. A domain does not directly mutate another domain’s private state.

## Initial technology choices

- Next.js and React with strict TypeScript.
- D1 pilot tables and a PostgreSQL target schema modeled through Drizzle ORM.
- Zod for untrusted command validation.
- Vitest and Testing Library for automated tests.
- Provider-neutral adapters for identity, object storage, OCR, AI, email, legacy import, filing, telephony, and deposition services.

Production identity, PostgreSQL hosting, workflow engine, OCR provider, AI provider, and external integrations remain open decisions pending security, cost, BAA, and design-partner review. Sites, D1, and R2 are accepted for the private pilot only.
