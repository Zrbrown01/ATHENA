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

- Versioned D1 governance-rule and obligation schemas. Obligations snapshot rule code/version/citation and calculation trace, retain trigger provenance and owner revision, and persist create, reassignment, completion-evidence, and cancellation-reason events through the transactional outbox.
- Deterministic calendar/business-day calculation with supplied holiday sets, weekend skipping, next-business-day roll, rule/version/citation output, and calculation trace.
- A persisted synthetic firm-policy rule demonstrates the engine without presenting an unreviewed legal deadline as authoritative. Content status distinguishes `synthetic_sandbox`, `pending_attorney_review`, and `attorney_approved`; pending content is blocked, and sandbox content requires explicit acknowledgement.
- Revisioned dependency edges, partner-decided due-date exceptions and waivers, business-day-relative dependent dates, blocking-predecessor completion, and attention/critical/breached escalation acknowledgements now persist atomically with event/outbox evidence. These controls remain explicitly synthetic until California content is attorney approved.
- Active policy layers resolve the documented firm → client → matter-type → matter precedence chain. Partner-only creation and supersession preserve immutable versions and field-level diffs; deterministic simulations snapshot every applicable layer, the selected layer, calculation trace, and due date. Pending, expired, unacknowledged synthetic, and falsely attorney-approved content fail closed.
- Versioned retention policies, matter legal-hold schema, and a disposition evaluator that never deletes automatically and requires human review after the retention window.
- Persisted matter-access policy schema; explicit denies and ethical walls override ordinary matter membership.

## Required next engine layer

Attorney-reviewed California source content, sourced holiday data operations, recurrence, activation of verified client instructions, and deterministic full-matter rebuild tests remain to be implemented. No statutory California content is approved in this environment.
