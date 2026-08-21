# Security and Compliance Posture

## Current posture

This repository is a development foundation using synthetic data. It is not approved for production PHI, privileged client material, financial data, or live firm operations.

Athena is being designed to support HIPAA-regulated workflows and SOC 2 readiness. It must not be described as HIPAA certified, HHS certified, automatically HIPAA compliant, or SOC 2 certified without the corresponding legal and audit evidence.

## Non-negotiable controls

- Verified enterprise identity, MFA, session expiration, and SSO readiness.
- Server- and database-enforced tenant and contextual authorization.
- Matter restrictions, ethical walls, field restrictions, and audited break-glass access.
- Encryption in transit, at rest, and in backups; managed secret storage.
- Malware scanning, file type/size validation, quarantine, and SSRF-safe processing.
- Immutable audit evidence for access and material actions.
- Retention hierarchy, legal holds, export controls, and deletion workflows.
- Dependency, secret, static, and container scanning.
- Restore tests, incident response, access reviews, risk register, subprocessor and BAA registry.
- No sensitive content in logs; use identifiers and correlated telemetry.

## AI controls

Production AI processing of regulated data remains disabled until contractual and technical approval. Outputs must be permission-aware, source-grounded, labeled, reviewed, and audited. Documents are untrusted input and must be isolated from system instructions and tool authority.

AI may propose facts, drafts, tasks, time, and form fields. It may not autonomously send substantive advice, file, submit invoices, accept authority, change exposure, close a matter, delete originals, waive rules, or share privileged data.

## Required pre-pilot evidence

- Threat model and data-flow review.
- Tenant and ethical-wall isolation tests across API, files, jobs, search, events, export, and AI.
- Backup/restore and matter-export exercise.
- Independent penetration test remediation.
- Vendor security and contract review, including BAA where applicable.
- Support access, incident, retention, legal hold, and offboarding procedures.

## Implemented isolation slice

Persisted ethical walls now support partner-authorized placement and release with deny-overrides-allow enforcement, reasons, actors, expiry, revisions, immutable restricted events, and outbox records. The shared negative-test contract covers API, object, export, job, event, search, AI retrieval, cache, and support planes. Search/AI/support remain disabled; no standing or break-glass support access is implied. See `docs/ACCESS_CONTROL.md`.

Matter authorization decisions are recorded without matter content, and every current authenticated write route has a durable per-actor/per-action fixed-window limit. These controls reduce abuse risk but do not replace edge/WAF limits, independent penetration testing, anomaly detection, or a formal access-review program.

## Production origin

The canonical application origin is `https://www.athenacms.app`. Production authentication callbacks, CORS/origin validation, content-security policy, secure cookies, email links, and provider webhooks must use an explicit allowlist based on that origin. The apex domain should redirect to the canonical `www` host. Preview deployments must use separate identity callbacks and must never receive production data.
