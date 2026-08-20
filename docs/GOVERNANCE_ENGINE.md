# Governance Engine

## Precedence

Platform baseline → California jurisdiction pack → firm policy → client/carrier/TPA policy → matter type → matter exception.

## Obligation contract

Every generated obligation must identify what is required, why, rule/version, due date, owner, completion evidence, exception availability, and exception approver. Rules are immutable once used; corrections create a new effective version.

## Implemented pilot gates

- Intake opening: attorney, partner, or paralegal may approve a conflict-cleared candidate.
- Material fact review: attorney, partner, or paralegal with matter access.
- Authority: attorney or partner with matter access.
- Report approval and Microsoft handoff: attorney or partner.
- Candidate time confirmation: attorney or partner; a versioned synthetic Summit billing profile evaluates narrative, allowed task/activity codes, and maximum duration.
- Filing packet approval: attorney, partner, or docketing specialist.
- Export: attorney, partner, or firm administrator with matter access.

Every accepted command records authenticated actor, event, audit record, idempotency key, and retention policy. Cross-tenant and unauthorized-matter commands fail before persistence.

## Required next engine layer

Persisted rule definitions, effective dates, obligation instances, business-day deadline calculation, exception/waiver workflow, escalation, completion evidence, client/matter overrides, rule simulation, version diff, and deterministic rebuild tests remain to be implemented.
