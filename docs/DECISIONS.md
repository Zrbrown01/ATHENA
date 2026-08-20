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
