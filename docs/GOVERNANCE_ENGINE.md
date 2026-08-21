# Governance Engine

## Precedence

Platform baseline → California jurisdiction pack → firm policy → client/carrier/TPA policy → matter type → matter exception.

## Obligation contract

Every generated obligation must identify what is required, why, rule/version, due date, owner, completion evidence, exception availability, and exception approver. Rules are immutable once used; corrections create a new effective version.

## Implemented pilot gates

- Intake opening: an attorney or partner may approve a conflict-cleared, duplicate-resolved, complete candidate. The same atomic decision creates the required exact-version synthetic opening-obligation bundle; a paralegal may prepare intake data but cannot open the matter.
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
- Client-instruction activation preserves an exact PDF source object, byte count, and SHA-256; requires separate source-integrity and instruction-scope approvals from two distinct authenticated reviewers; and activates an exact-version client layer through a partner-only optimistic claim. Deactivation preserves the source/review/decision history and supersedes the derived layer. The shipped source is explicitly deterministic sandbox evidence, so its layer remains `synthetic_sandbox` and its event declares that no verified external client instruction was activated.
- Full-matter rebuilds replay each obligation from its exact rule version, trigger, dependency chain, and approved exception/waiver. Immutable matched, drifted, and blocked findings require a single-winner partner review; rebuilds never mutate operational legal work.
- Matter opening fails closed unless both acknowledged synthetic opening rules are present, effective, within review, and deterministically calculated. The assignment-acknowledgment and initial-report obligations preserve the intake candidate as trigger provenance, rule/version/citation, owner, due date, trace, individual event/outbox evidence, and the atomic opening correlation.
- Versioned retention policies, matter legal-hold schema, and a disposition evaluator that never deletes automatically and requires human review after the retention window.
- Persisted matter-access policy schema; explicit denies and ethical walls override ordinary matter membership.

## Required next engine layer

Attorney-reviewed California source content, sourced holiday data operations, and ingestion of genuine checksum-verifiable external client instructions remain dependent on approved source material. Native task/report recurrence and the governed activation mechanism are implemented, but no statutory California content or real client instruction is approved in this environment.
