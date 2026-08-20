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

## Implemented platform layer

- Versioned D1 governance-rule and obligation schemas.
- Deterministic calendar/business-day calculation with supplied holiday sets, weekend skipping, next-business-day roll, rule/version/citation output, and calculation trace.
- A persisted synthetic firm-policy rule demonstrates the engine without presenting an unreviewed legal deadline as authoritative.
- Versioned retention policies, matter legal-hold schema, and a disposition evaluator that never deletes automatically and requires human review after the retention window.
- Persisted matter-access policy schema; explicit denies and ethical walls override ordinary matter membership.

## Required next engine layer

Attorney-reviewed California source content, holiday data operations, obligation creation/completion, exception/waiver workflow, escalation, completion evidence, client/matter overrides, rule simulation, version diff, and deterministic rebuild tests remain to be implemented.
