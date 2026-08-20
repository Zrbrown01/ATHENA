# Architecture Decisions

## ADR-001 — Begin with a modular monolith

**Status:** Accepted
**Decision:** Use a single primary application and relational database with explicit domain modules, background workers, and durable workflows.
**Reason:** This minimizes operational complexity while preserving boundaries needed for later extraction.

## ADR-002 — Relational current state plus immutable history

**Status:** Accepted
**Decision:** Store queryable current state alongside immutable events, fact observations, audit records, and historical ledgers.
**Reason:** Common legal workflows need fast current-state queries and complete evidentiary history; full event sourcing is unnecessary.

## ADR-003 — Provenance is part of the fact model

**Status:** Accepted
**Decision:** A material fact cannot exist only as a current scalar value. Observations retain source document/message, exact page or excerpt, original and normalized values, extraction method, confidence, scope, verification, conflicts, and supersession.
**Reason:** Attorney trust, review, audit, reporting, and safe AI depend on traceable evidence.

## ADR-004 — External systems use adapters and honest health states

**Status:** Accepted
**Decision:** Microsoft 365, MerusCase, OCR, AI, EAMS/JET, telephony, Noted, and Verbatim are hidden behind provider-neutral contracts. A missing credential or contract yields `not_connected`, never simulated success.
**Reason:** Legal work must remain recoverable and operators must know what is actually connected.

## ADR-005 — Synthetic data only during foundation work

**Status:** Accepted
**Decision:** Local, CI, and ordinary preview environments use synthetic golden matters only.
**Reason:** Production data must not enter source control, coding tools, logs, or unapproved environments.

## ADR-006 — Sites pilot uses D1 and R2 without redefining the target architecture

**Status:** Accepted
**Decision:** Use Sites-managed D1 for the owner-only pilot's durable structured records and R2 for quarantined originals. Keep the normalized PostgreSQL schema and migrations as the target production relational model. Every pilot table and workflow must identify whether it is a deployment-local implementation or part of the canonical production model.
**Reason:** This permits a real persistent private pilot without claiming that D1 supplies PostgreSQL row-level security, production backup evidence, or the final multi-tenant control plane.

## ADR-007 — Deterministic providers prove workflow shape, not provider activation

**Status:** Accepted
**Decision:** Deterministic synthetic implementations may produce fixed OCR, classification, source-linked analysis, Verbatim drafts, billing validation, and delivery handoff results for automated golden workflows. Their records must carry `provider_mode: deterministic_sandbox`; user-facing health remains `not_connected`, and no external success event may be emitted.
**Reason:** The product can prove commands, state transitions, provenance, approvals, retries, audit, and export without misleading operators about Microsoft, OCR, AI, MerusCase, EAMS/JET, Noted, or Verbatim connectivity.
