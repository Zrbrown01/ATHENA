# Test Plan

## Required test layers

- Unit: domain state machines, authorization, billing/deadline calculations, obligation lifecycle/content-status/revision gates, upload validation, retention evaluation and legal-hold/review controls, provider retry, outbox reconciliation, source-grounding, and export manifests.
- Integration: D1 migrations, atomic state/event/outbox/audit writes, R2 compensation and downloads, idempotency, tenant predicates, and provider handoff recovery.
- End to end: ten synthetic golden workflows, keyboard navigation, error recovery, and critical performance targets.
- Security: cross-tenant API/object/export/job/event/search/AI/cache denials, persisted ethical walls, no-grant/wrong-matter/expired/revoked/walled support denials, review snapshots, immutable access-decision evidence, fixed-window 429/Retry-After behavior, origin/CSRF, injection/XSS/SSRF, content security, secrets, and dependency scanning.
- Accessibility: WCAG 2.2 AA semantics, focus, tables, errors, reduced motion, high contrast, and assistive-technology operation.
- Operations: backup/restore, export/import verification, dead-letter replay, incident evidence, and rollback.

## Current automated evidence

Obligation-governance tests prove business-day-relative dependency chains, blocking-predecessor completion, partner-decided exceptions/waivers, escalation windows and acknowledgements, tenant/role gates, and concurrent stale-write rejection. Rebuild tests prove exact-version replay, approved-exception override, dependency traversal, drift-without-mutation, fail-closed missing/pending/cycle evidence, durable findings, and a 200/409 single-winner partner review race.

Intake-opening tests prove that missing, pending, expired, or unacknowledged rules fail closed; the acknowledged bundle deterministically yields one-day assignment acknowledgment and ten-day initial-report deadlines across a synthetic closure; identities are retry-stable; matter opening or historical migration creates exactly two source-linked rule snapshots; and competing revisioned writes produce one complete winner and one 409 without a partial bundle.

Policy-simulation tests prove firm/client/matter-type/matter precedence, deterministic holiday-aware due dates, review/content/acknowledgement gates, false legal-approval rejection, sequential versioning, field-level diffs, immutable snapshots, and a real two-writer supersession race with exactly one committed version/event/outbox batch.

Vitest covers PDF MIME/size/signature/safe-name validation; fact review roles, matter access, cross-tenant/object denial and ethical-wall precedence; non-flattened matter graph identity, party role compatibility, alias normalization, entity/source-link provenance, endpoint and claim-link invariants; revisioned intake candidate transitions and duplicate/conflict/completeness opening gates; task dependency, terminal-state, evidence, revision, role, and tenant gates; record-request transition order, service/deadline chronology, deficiency, revision, and tenant gates; authority request-versus-grant classification, completeness, threshold, chronology, revision, terminal-state, and tenant gates; closure checklist completeness, blocking-work, closed-only reopening, history, revision, role, and tenant gates; settlement readiness category preservation, non-autonomy, missing authority, external block, review existence, and tenant gates; proceeding readiness critical blocks, client-decision/external-dependency/ready states, false native EAMS evidence rejection, and tenant isolation; filing packet required data/documents/order/signatures/checksums, approval gate, honest handoff block, correction identity, false provider mode, and tenant gates; billing increment/rate/expense integer arithmetic, unapproved-code/timekeeper hard stops, LEDES reconciliation, reduction/appeal collectible amount, overpayment prevention, manual provider mode, and tenant gates; structured-search case/accent/whitespace normalization, all-token matching, literal wildcards, ranking, result caps, and query bounds; workflow action/role/tenant/matter authorization; the ordered companion state machine and honest Microsoft failure; outbox lease/retry/dead-letter/replay policy; retention/hold decisions; business-day calculation; export provenance, coverage, and completeness enforcement; same-origin write protection; and accessible pilot workflow controls.

The route-security contract discovers all 94 exported handlers across 50 API route files and fails when any handler omits authenticated identity or an authorization boundary, or when any mutation omits trusted-origin enforcement or durable rate limiting. Pilot identity tests prove that an unknown production principal receives no roles or matter access, only an explicitly configured owner receives attorney/partner access, and a configured support principal remains outside ordinary matter membership. Axe-core runs every DOM-computable rule against the global shell and the initial client-portal, scale-evidence, tenant-export, and cost-governance surfaces; color contrast is excluded because jsdom has no rendered style/layout engine and remains a real-browser/manual gate.

Playwright's actual-request isolation matrix exercises owner, unknown, and configured-support identities across cost governance, document evidence, tenant exports, structured search, and the golden matter graph. The owner receives 200 while both non-owner principals receive 403 with error-only bodies. A separate support request proves the allowlisted support identity still requires a current matter-scoped persisted grant. A valid foreign-tenant rate-card command receives 403 and leaves the golden rate-card and decision counts unchanged.

Playwright also serves the compiled production bundle locally and measures the rendered home and cost-governance routes in Chromium. Each route must reach DOM content loaded within 2,500 ms and first contentful paint within 2,000 ms while staying below 2,500,000 encoded JavaScript bytes, 300,000 stylesheet bytes, and 1,500,000 image bytes. JSON attachments preserve the measured evidence. These are local production-bundle regression budgets, not representative deployed load or edge/network assurance.

Document-evidence lifecycle tests additionally prove immutable original checksum identity, bounded derivative page ranges, honest blocked OCR/AI state, privilege/confidentiality production gates, and tenant isolation. Communication lifecycle tests prove human matter-filing decisions, reversible undo, filed-thread draft gating, optimistic revisions, tenant isolation, and a blocked—not sent—Microsoft handoff with no provider delivery attempt. Native docket tests prove recurrence/provider truth, half-open interval overlap, preparation chronology, reminder/conflict state gates, optimistic revisions, and tenant isolation. Governed reporting tests prove required-section/order/source/recipient/conflict gates, approval ordering, optimistic revisions, tenant isolation, and blocked delivery without a provider attempt. Billing-planning tests prove exact phase reconciliation, integer-cent accrual/variance/realization/contribution math, approval gates, chronology, optimistic revisions, and tenant isolation. Migration tests prove count/checksum/exception reconciliation, strict freeze/cutover ordering, optimistic revisions, and tenant isolation. Security-operations tests prove strict incident ordering, role/tenant denial, evidence-validity chronology, residual-risk constraints, and explicit disconnected identity-revocation state; the API integration proof reached closure revision 7 and verified idempotent decisions/events/outbox across incident, control, and risk records.

Task-recurrence tests prove weekly anchors, end-of-month clamping, a 12-occurrence command ceiling, nominal/effective identity across move/skip exceptions, attorney-only activation, stale-revision rejection, idempotent replay, one-winner competing materialization, and cancellation that preserves already-created tasks. Report-recurrence tests separately prove complete six-section source templates, definition-content activation gates, a six-draft command ceiling, exceptions, idempotent single-winner materialization, generated-draft validation and attorney approval, honest blocked delivery, and cancellation that preserves created reports.

Recovery tests prove exact required-category verification, mismatched restore failure, verification-before-approval, and tenant denial. The repeatable `npm run db:recovery:verify` exercise exports local D1, restores into disposable SQLite, and currently matches 192 application tables, 52 migrations through `0051_tan_skrulls.sql`, 459 events, 459 outbox rows, the pinned export SHA-256 `2361c3a983420f8207ff20ec6929ad287bcf48a52566fe35195345eea291dbd5`, one tenant, integrity `ok`, and zero foreign-key violations without production mutation.

Directory tests prove firm/matter scope consistency, suspension-first offboarding, self-offboarding denial, foreign-tenant denial, and explicit non-completion when session revocation is disconnected. Reconciliation tests detect missing/unmanaged identities plus status, role, and MFA drift; reject clean certification while blocking findings exist; preserve a checksum-pinned deterministic provider snapshot; and prove concurrent partner reviews commit exactly one review/event/outbox batch while the stale request returns 409. The original lifecycle API proof persisted seven immutable roles with 17 permissions, a matter-scoped assignment, suspension, assignment revocation, six decisions/events/outbox records, and a `session_revocation_blocked` terminal pilot state.

Provider-compliance tests prove complete prerequisite evaluation, exact missing-requirement reporting, review expiry, executed-agreement effective dates, and tenant denial. The API proof preserved draft BAA/DPA status and produced a blocked assessment naming those two missing requirements while credential activation and provider connectivity remained false.

Disposition tests prove legal-hold blocking, synthetic-target enforcement, requester self-approval denial, distinct dual approval, execution gating, and tenant denial. One API proof deleted exactly one dual-approved synthetic record while preserving its checksum and immutable audit/event evidence; a second persisted-hold proof retained its target and recorded `blocked_by_hold` before the synthetic hold was formally released.

Classification tests table-drive all nine planes, search/download restrictions, legal-hold retention precedence, sensitive-log redaction, active override behavior, non-overridable labels, and tenant/matter denial. The API proof persisted one synthetic four-label resource and nine decisions with outcomes `allow`, `allow`, `deny`, `deny`, `allow`, `deny`, `retain`, `allow`, and `redact`; replay was idempotent, a foreign tenant received 403, and an immutable-label override received 400.

Tenant-portability tests prove that missing schema tables or original objects force `partial`, completeness requires full coverage, partner role and tenant isolation are enforced, and every declared archive entry is read back with exact byte-size/SHA-256 verification. The initial partial proof exposed the 118-table gap; the dynamic serializer then built a 1,034,752-byte TAR with 11 entries, 12 categories, all 150 current tables, zero available originals, no missing items, a matching archive SHA-256, idempotent replay, and a foreign-tenant 403.

Bounded tenant-portability tests prove inclusive 50,000-row and 64 MiB ceilings, the first over-limit value fails, TAR header/padding/end-block estimation is exact, and limit errors map to non-downloadable failed-job plus failed-decision/event evidence. The current serializer discovers all 192 tables in bounded pages and produces a complete archive with zero missing items. Archive byte size is fixture-dependent and is verified against the declared checksum and enforced 64 MiB ceiling rather than treated as a permanent constant.

Deposition tests prove governance approval, ordered lifecycle states, an honest Noted block with zero provider attempt, role/tenant/matter gates, and synthetic transcript return. The API proof reached closure revision 7 with seven decisions/events/outbox records, a human-verified calendar identity, and the pinned synthetic transcript SHA-256; subsequent migrations, including obligation governance, policy simulation, rebuild evidence, task recurrence, and report recurrence, automatically increased tenant-export coverage to all 192 tables.

Automation-health tests prove that absence remains `not_connected`, recent success becomes `healthy`, expired success becomes `stale`, and a recorded failure remains `failed`. The local Cloudflare scheduled-event route recorded a real `cron:*/5 * * * *` success heartbeat, delivered up to the bounded 100-message batch, and reconciled with zero exceptions. A manual trigger is stored separately and never satisfies the cron-health query. The release-54 production table remained empty through the observed 2026-08-21 05:50 UTC schedule boundary and processing window, so production automation remains explicitly not connected.

Cost-governance tests prove exact safe-integer micro-dollar arithmetic, unique category/unit pricing, partner-only rate approval, approved-card and matching-rate gates, tenant/matter isolation, and rejection of false provider verification. The local API proof approved one synthetic card and recorded three estimated entries across QME intake and Verbatim workflows for 2,515,000 micros, five decisions/events/outbox records, and zero provider-verified entries.

The cost-rate-card concurrency probe sends two approval commands concurrently after both can observe revision 1. The atomic persistence claim permits exactly one full batch, returns 409 for the other, leaves the card at revision 2, and persists exactly one approval decision/event/outbox. Unit tests separately prove only unique claim failures map to the public optimistic-concurrency error; unrelated database failures remain visible to the normal error path.

The matter-budget concurrency probe applies the same atomic claim at the financial approval boundary. Two concurrent attorney approvals carrying revision 1 must resolve to one success and one 409, leave the budget approved at revision 2, and persist exactly one approval decision/event/outbox batch.

Request-observability tests prove valid request/W3C trace correlation, query exclusion, dynamic export-route templating, pseudonymous actor references, a bounded operational record, and response correlation/server-timing headers. A local Worker request preserved an explicit request ID, generated a 32-hex trace ID, returned a measured server-timing value, and retained the existing CSP.

Playwright/Chromium E2E proves hydrated search-trigger operation, autofocus, Escape closure, focus restoration, the platform keyboard shortcut, and short-query status messaging. Approved full-page baselines cover the desktop My Work shell, initial cost-governance surface, and the 390-pixel phone shell with light theme, locale, and timezone pinned. The phone gate proves a hidden-by-default navigation drawer, keyboard Escape closure with trigger-focus restoration, contained wide-table scrolling, and zero page-level horizontal overflow; the tablet gate proves the same page boundary at 820 pixels. Rendered axe-core WCAG A/AA checks, including real color contrast, pass on My Work, cost governance, directory administration, tenant exports, and clients. These gates found and fixed desktop sidebar overflow, phone rail/content overflow, and insufficient contrast on the shortcut and eyebrow text tokens.

The local integration smoke executes all seven companion API transitions against migrated D1/R2, downloads the export, and verifies seven events plus limitations. The production build enumerates all application/API routes.

## Remaining gates

Broader browser E2E/visual/device coverage beyond the current desktop/phone/tablet critical surfaces, manual assistive-technology validation, adversarial database concurrency tests for every remaining revisioned aggregate, independently operated hosted multi-account isolation validation, a supported production scheduler, external-provider reconciliation, attorney-reviewed deadline content and sourced holiday operations, AI grounding evaluation, representative deployed performance/load validation, and provider/cross-region backup restore remain required before production.

## Standard checks

`npm run check` runs lint, TypeScript, Vitest, and the deployment build. `npm run test:e2e` runs the Chromium behavior and visual gate after `npx playwright install chromium`; intentional baseline changes use `npm run test:e2e:update` and require visual review. `npm audit --audit-level=high` is the dependency gate. Migration SQL is inspected and applied to a clean/local database before release.

## Export coverage evidence

- Manifest coverage tests prove that one missing original byte stream forces `completeness=partial` and that completeness is possible only when included byte-stream count covers every source document.
- TAR tests prove safe paths, unique entries, header checksums, manifest presence, exact original hashes, and rejection of incomplete restoration claims.
- The complete golden-archive test packages manifest v3 with the deterministic PDF, reads both entries back, and proves restoration evidence.
- Download responses expose the stored checksum, completeness classification, and restoration-verification state.

## Verbatim dictation lifecycle

- Prove acknowledged synthetic capture metadata and consent evidence without storing or transmitting audio bytes.
- Prove the disconnected Verbatim handoff records `providerConnected=false` and `providerCallAttempted=false`.
- Prove ordered transcript, template, review, approval, time-confirmation, and filing transitions with optimistic revision checks.
- Prove attorney-only approval/time/filing and tenant/matter isolation.
- Verify checksum-linked artifacts, immutable decisions/events/outbox, confirmed time evidence, and the approved matter work-product projection.

## Client portal control lifecycle

- Prove identity verification precedes attorney approval and that requests expire closed.
- Prove server-side sharing classification allows an internal summary and denies privileged/medical-sensitive content.
- Prove activation stops with external login, identity connection, and invitation delivery all false.
- Prove attorney role, tenant, matter, revision, expiry, and revocation gates.
- Verify seven persisted decisions/events/outbox records and revocation of every previously allowed share item.

## Telephony and SMS lifecycle

- Prove current SMS opt-in and voice consent, with recording disabled, before communication artifacts may advance.
- Prove attorney review precedes the honest disconnected SMS handoff and `deliveryAttempted` remains false.
- Prove human-recorded HELP and STOP evidence, immediate opt-out suppression, and no later SMS transition.
- Prove non-recorded call metadata, attorney matter association, and explicit time confirmation.
- Prove ordering, revision, role, tenant, and matter gates; verify eleven decisions/events/outbox records through closure.

## Structured authority approval

- Prove attorney approval precedes the secure-page handoff and no page, invitation, or delivery is claimed.
- Prove approved/modified responses require complete terms, valid dates and thresholds; declined responses cannot become authority.
- Prove final attorney confirmation creates the source candidate and active ledger, supersedes prior authority, emits readiness evidence, and creates an expiration-review task.
- Prove revision, expiry, role, tenant, and matter gates; verify five decisions/events/outbox records through confirmation.

## Scale evidence audit

- Measure local p95 search/filter/context/view algorithms across 25,000 synthetic matter rows and compare exact master targets.
- Preserve event availability and background-job acknowledgment as `not_measured`, never inferred from local algorithms.
- Prove partner-only review, tenant isolation, optimistic revision, explicit blocking gaps, and `productionReady=false` event evidence.
- Verify proposed page/outbox/archive ceilings are recorded as audit evidence, not misrepresented as globally enforced runtime controls.
