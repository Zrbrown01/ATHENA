# Test Plan

## Required test layers

- Unit: domain state machines, authorization, billing/deadline calculations, upload validation, retention/hold policy, provider retry, source-grounding, and export manifests.
- Integration: D1 migrations, atomic state/event/outbox/audit writes, R2 compensation and downloads, idempotency, tenant predicates, and provider handoff recovery.
- End to end: ten synthetic golden workflows, keyboard navigation, error recovery, and critical performance targets.
- Security: cross-tenant UI/API/object/export/job/event/search/AI denials, ethical walls, origin/CSRF, injection/XSS/SSRF, rate limit, content security, secrets, and dependency scanning.
- Accessibility: WCAG 2.2 AA semantics, focus, tables, errors, reduced motion, high contrast, and assistive-technology operation.
- Operations: backup/restore, export/import verification, dead-letter replay, incident evidence, and rollback.

## Current automated evidence

Vitest covers PDF MIME/size/signature/safe-name validation; fact review roles, matter access, and cross-tenant denial; workflow action/role/tenant/matter authorization; the ordered companion state machine and honest Microsoft failure; versioned billing pass/warning/hard-stop; export provenance and limitation manifest; same-origin write protection; and accessible pilot workflow controls.

The local integration smoke executes all seven companion API transitions against migrated D1/R2, downloads the export, and verifies seven events plus limitations. The production build enumerates all application/API routes.

## Remaining gates

Automated browser E2E/visual regression, database concurrency/idempotency integration, ethical-wall fixtures, outbox retry/replay, direct-object cross-tenant tests, full export with original bytes, retention/legal hold, deadline/business-day rules, AI grounding evaluation, migration reconciliation, performance budgets, and backup restore remain required before production.

## Standard checks

`npm run check` runs lint, TypeScript, Vitest, and the deployment build. `npm audit --audit-level=high` is the dependency gate. Migration SQL is inspected and applied to a clean/local database before release.
