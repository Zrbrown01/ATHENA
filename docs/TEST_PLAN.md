# Test Plan

## Required test layers

- Unit: domain state machines, authorization, billing/deadline calculations, obligation lifecycle/content-status/revision gates, upload validation, retention/hold policy, provider retry, source-grounding, and export manifests.
- Integration: D1 migrations, atomic state/event/outbox/audit writes, R2 compensation and downloads, idempotency, tenant predicates, and provider handoff recovery.
- End to end: ten synthetic golden workflows, keyboard navigation, error recovery, and critical performance targets.
- Security: cross-tenant API/object/export/job/event/search/AI/cache denials, persisted ethical walls, support-grant scope/expiry, immutable access-decision evidence, fixed-window 429/Retry-After behavior, origin/CSRF, injection/XSS/SSRF, content security, secrets, and dependency scanning.
- Accessibility: WCAG 2.2 AA semantics, focus, tables, errors, reduced motion, high contrast, and assistive-technology operation.
- Operations: backup/restore, export/import verification, dead-letter replay, incident evidence, and rollback.

## Current automated evidence

Vitest covers PDF MIME/size/signature/safe-name validation; fact review roles, matter access, cross-tenant/object denial and ethical-wall precedence; workflow action/role/tenant/matter authorization; the ordered companion state machine and honest Microsoft failure; versioned billing pass/warning/hard-stop; outbox lease/retry/dead-letter/replay policy; retention/hold decisions; business-day calculation; export provenance, coverage, and completeness enforcement; same-origin write protection; and accessible pilot workflow controls.

The local integration smoke executes all seven companion API transitions against migrated D1/R2, downloads the export, and verifies seven events plus limitations. The production build enumerates all application/API routes.

## Remaining gates

Automated browser E2E/visual regression, adversarial database concurrency tests, independent multi-principal isolation validation, automated outbox scheduling, attorney-reviewed deadline content and sourced holiday operations, AI grounding evaluation, migration reconciliation, performance budgets, and backup restore remain required before production.

## Standard checks

`npm run check` runs lint, TypeScript, Vitest, and the deployment build. `npm audit --audit-level=high` is the dependency gate. Migration SQL is inspected and applied to a clean/local database before release.

## Export coverage evidence

- Manifest coverage tests prove that one missing original byte stream forces `completeness=partial` and that completeness is possible only when included byte-stream count covers every source document.
- TAR tests prove safe paths, unique entries, header checksums, manifest presence, exact original hashes, and rejection of incomplete restoration claims.
- The complete golden-archive test packages manifest v3 with the deterministic PDF, reads both entries back, and proves restoration evidence.
- Download responses expose the stored checksum, completeness classification, and restoration-verification state.
