# Architecture

## Direction

Athena begins as a modular monolith: one web application, one canonical PostgreSQL database, background workers, durable workflows, and separately scalable document processing when required. Domain boundaries are explicit even though deployment is initially unified.

## Runtime boundaries

1. **Web/API:** authenticated commands and permission-filtered queries.
2. **PostgreSQL:** relational current state, immutable business events, audit records, provenance, and the transactional outbox.
3. **Object storage:** encrypted originals and distinguishable derived objects.
4. **Workers:** scanning, OCR, extraction, event delivery, reconciliation, exports, and report generation.
5. **Durable workflows:** legal deadlines, approvals, QME cycles, filing, billing, migration, and other work that must survive restarts.
6. **Integration control plane:** provider connections, subscriptions, cursors, idempotency, retries, dead letters, backfill, reconciliation, and revocation.

## Current state plus history

Athena does not use full event sourcing. The application writes queryable relational current state while also preserving immutable business events, fact observations, audit events, and historical ledgers. Business updates and outgoing events will commit together through the outbox pattern.

## Tenant isolation

Every tenant-owned record carries `tenant_id`. Production queries must receive tenant context from verified identity claims, include tenant predicates, and use PostgreSQL row-level security as defense in depth. Isolation also applies to object keys, cache keys, jobs, search documents, events, logs, exports, and AI retrieval.

The current development identity adapter is not suitable for production and is intentionally called out in build status.

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
- PostgreSQL modeled through Drizzle ORM.
- Zod for untrusted command validation.
- Vitest and Testing Library for automated tests.
- Provider-neutral adapters for identity, object storage, OCR, AI, email, legacy import, filing, telephony, and deposition services.

Production cloud, identity provider, object storage, workflow engine, OCR provider, and AI provider remain open decisions pending security, cost, BAA, and design-partner review.
