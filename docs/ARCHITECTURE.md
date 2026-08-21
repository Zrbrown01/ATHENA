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

Tenant portability archives are assembled server-side by discovering every Drizzle table and requiring its tenant column, stored under `<tenant>/exports/tenant/<export>/`, and committed to D1 only after R2 creation and archive read-back verification. Database failure triggers compensating object deletion. Schema-table and original-object coverage are machine-readable completeness gates.

## Current state plus history

Athena does not use full event sourcing. The application writes queryable relational current state while also preserving immutable business events, fact observations, audit events, and historical ledgers. Business updates and outgoing events will commit together through the outbox pattern.

## Tenant isolation

Every tenant-owned record carries `tenant_id`. Production queries must receive tenant context from verified identity claims, include tenant predicates, and use PostgreSQL row-level security as defense in depth. Isolation also applies to object keys, cache keys, jobs, search documents, events, logs, exports, and AI retrieval.

After tenant/matter authorization, the resource-classification boundary evaluates a versioned label set against the requested data plane. The pilot persists policy versions, active resource labels, bounded overrides, and immutable decisions. Search, export creation, and archive download are representative wired adapters; remaining planes are proven in the governed fixture but not yet globally intercepted.

Hosted pilot requests require platform-authenticated identity headers and the site is owner-only. Local development uses an explicit synthetic identity. Neither is the final multi-tenant identity/RLS design, and the distinction is intentionally called out in build status.

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
