# Test Plan

## Required test layers

- Unit: domain state machines, authorization, billing/deadline calculations, obligation lifecycle/content-status/revision gates, upload validation, retention evaluation and legal-hold/review controls, provider retry, outbox reconciliation, source-grounding, and export manifests.
- Integration: D1 migrations, atomic state/event/outbox/audit writes, R2 compensation and downloads, idempotency, tenant predicates, and provider handoff recovery.
- End to end: ten synthetic golden workflows, keyboard navigation, error recovery, and critical performance targets.
- Security: cross-tenant API/object/export/job/event/search/AI/cache denials, persisted ethical walls, no-grant/wrong-matter/expired/revoked/walled support denials, review snapshots, immutable access-decision evidence, fixed-window 429/Retry-After behavior, origin/CSRF, injection/XSS/SSRF, content security, secrets, and dependency scanning.
- Accessibility: WCAG 2.2 AA semantics, focus, tables, errors, reduced motion, high contrast, and assistive-technology operation.
- Operations: backup/restore, export/import verification, dead-letter replay, incident evidence, and rollback.

## Current automated evidence

Vitest covers PDF MIME/size/signature/safe-name validation; fact review roles, matter access, cross-tenant/object denial and ethical-wall precedence; non-flattened matter graph identity, party role compatibility, alias normalization, entity/source-link provenance, endpoint and claim-link invariants; revisioned intake candidate transitions and duplicate/conflict/completeness opening gates; task dependency, terminal-state, evidence, revision, role, and tenant gates; record-request transition order, service/deadline chronology, deficiency, revision, and tenant gates; authority request-versus-grant classification, completeness, threshold, chronology, revision, terminal-state, and tenant gates; closure checklist completeness, blocking-work, closed-only reopening, history, revision, role, and tenant gates; settlement readiness category preservation, non-autonomy, missing authority, external block, review existence, and tenant gates; proceeding readiness critical blocks, client-decision/external-dependency/ready states, false native EAMS evidence rejection, and tenant isolation; filing packet required data/documents/order/signatures/checksums, approval gate, honest handoff block, correction identity, false provider mode, and tenant gates; billing increment/rate/expense integer arithmetic, unapproved-code/timekeeper hard stops, LEDES reconciliation, reduction/appeal collectible amount, overpayment prevention, manual provider mode, and tenant gates; structured-search case/accent/whitespace normalization, all-token matching, literal wildcards, ranking, result caps, and query bounds; workflow action/role/tenant/matter authorization; the ordered companion state machine and honest Microsoft failure; outbox lease/retry/dead-letter/replay policy; retention/hold decisions; business-day calculation; export provenance, coverage, and completeness enforcement; same-origin write protection; and accessible pilot workflow controls.

Document-evidence lifecycle tests additionally prove immutable original checksum identity, bounded derivative page ranges, honest blocked OCR/AI state, privilege/confidentiality production gates, and tenant isolation. Communication lifecycle tests prove human matter-filing decisions, reversible undo, filed-thread draft gating, optimistic revisions, tenant isolation, and a blocked—not sent—Microsoft handoff with no provider delivery attempt. Native docket tests prove recurrence/provider truth, half-open interval overlap, preparation chronology, reminder/conflict state gates, optimistic revisions, and tenant isolation. Governed reporting tests prove required-section/order/source/recipient/conflict gates, approval ordering, optimistic revisions, tenant isolation, and blocked delivery without a provider attempt. Billing-planning tests prove exact phase reconciliation, integer-cent accrual/variance/realization/contribution math, approval gates, chronology, optimistic revisions, and tenant isolation. Migration tests prove count/checksum/exception reconciliation, strict freeze/cutover ordering, optimistic revisions, and tenant isolation.

The local integration smoke executes all seven companion API transitions against migrated D1/R2, downloads the export, and verifies seven events plus limitations. The production build enumerates all application/API routes.

## Remaining gates

Automated browser E2E/visual regression, adversarial database concurrency tests, independent multi-principal isolation validation, production cron-timestamp verification, external-provider reconciliation, attorney-reviewed deadline content and sourced holiday operations, AI grounding evaluation, migration reconciliation, performance budgets, and backup restore remain required before production.

## Standard checks

`npm run check` runs lint, TypeScript, Vitest, and the deployment build. `npm audit --audit-level=high` is the dependency gate. Migration SQL is inspected and applied to a clean/local database before release.

## Export coverage evidence

- Manifest coverage tests prove that one missing original byte stream forces `completeness=partial` and that completeness is possible only when included byte-stream count covers every source document.
- TAR tests prove safe paths, unique entries, header checksums, manifest presence, exact original hashes, and rejection of incomplete restoration claims.
- The complete golden-archive test packages manifest v3 with the deterministic PDF, reads both entries back, and proves restoration evidence.
- Download responses expose the stored checksum, completeness classification, and restoration-verification state.
