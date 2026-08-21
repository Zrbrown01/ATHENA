# Deployment Runbook

## Canonical address

- Production application: `https://www.athenacms.app`
- Canonical host: `www.athenacms.app`
- Apex behavior: `https://athenacms.app` redirects permanently to the canonical `www` host.

The application is deployed as an owner-only Sites pilot at `https://athena-cms.new-reign-ca-8518.chatgpt.site` and `https://www.athenacms.app`. The custom host, provider routing, and TLS certificate are active. It contains synthetic data only and is not a production authorization. The apex redirect is not yet configured.

## Required production configuration

```text
NEXT_PUBLIC_APP_URL=https://www.athenacms.app
AUTH_MODE=platform_headers
ATHENA_PILOT_PARTNER_USER_IDS=<secret comma-separated Sites account user IDs>
ATHENA_PILOT_SUPPORT_USER_IDS=<optional secret comma-separated support account user IDs>
ATHENA_APP_VERSION=<exact deployed Git commit SHA>
D1_BINDING=DB
R2_BINDING=DOCUMENTS
OCR_PROVIDER=<approved provider or disabled>
AI_PROVIDER=<approved provider or disabled>
```

Never commit production values or credentials. Use the selected cloud’s managed secret service.

The private Sites pilot stores `ATHENA_PILOT_PARTNER_USER_IDS` as a secret runtime value containing the sole allowed owner. Deploy a saved version after changing it so the new environment revision becomes active. Never infer an Athena role from the presence of platform authentication headers alone.

Set `ATHENA_APP_VERSION` to the exact source commit before deploying that saved version. Smoke responses must include `x-athena-request-id`, `x-athena-trace-id`, and `server-timing`. Worker request records must use the same version and must not contain URL queries, bodies, tokens, raw identity headers, medical facts, email bodies, or settlement strategy.

## Domain activation checklist

Current Sites records for the `www` host:

```text
CNAME www -> custom-domains.chatgpt.site (DNS only)
TXT _openai-site-verification.www -> openai-site-verification=JNWRykv3X6kW5n2AMnTCud8jAumBO2QyerQLSYJcpwU
TXT _cf-custom-hostname.www -> 62406762-1264-4515-b2b8-b8fe5874a50e
```

1. Verify domain ownership and identify the authoritative DNS provider.
2. Configure the hosting provider’s required DNS records for `www`.
3. Redirect the apex domain to `https://www.athenacms.app`.
4. Issue and automatically renew TLS certificates for the canonical and apex hosts.
5. Configure HSTS only after HTTPS, redirects, subdomains, and recovery procedures have been verified.
6. Add the exact production callback and logout URLs to the identity provider.
7. Add exact Microsoft Graph notification URLs only after webhook verification is implemented.
8. Restrict CORS and state-changing request origins to the canonical production origin.
9. Generate a production content-security policy from an explicit provider allowlist.
10. Verify secure, HTTP-only, same-site cookie behavior on the final host.
11. Test DNS, TLS, redirect, callback, webhook, health, backup, rollback, and complete export flows.

## Release procedure

1. Confirm CI is green and the release commit is reviewed.
2. Confirm migrations are backward compatible and a recovery point exists.
3. Deploy to restricted staging with synthetic data.
4. Run golden workflow, rendered accessibility/contrast, Playwright E2E/desktop-phone visual/device-overflow, authorization, isolation, migration, and security checks.
   For any changed revisioned aggregate, include a real concurrent two-command probe and require one committed batch plus one `409 Conflict`; checking two stale commands sequentially is insufficient.
5. Obtain named release and security approval.
6. Deploy application code with external integrations disabled by default.
7. Run migrations through the controlled release job.
8. Execute production smoke tests without placing sensitive content in logs.
9. Enable approved integrations individually and verify health/reconciliation.
10. Monitor correlated errors, job queues, outbox lag, integration health, and access anomalies.

## Rollback

- Application releases must be independently reversible.
- Destructive schema changes require a staged expand/migrate/contract sequence.
- Disable affected integrations before replaying or repairing provider events.
- Preserve originals, audit evidence, events, and failed work throughout recovery.
- Do not restore one tenant’s data into a shared environment without verified isolation controls.

## Backup and restore evidence

- Local D1: `npm run db:backup:local` writes an ignored SQL export beneath `.wrangler/`. Restore only into a disposable local database, reapply migrations, and compare table counts, event IDs, export checksums, and workflow stages.
- Target PostgreSQL: use an encrypted managed snapshot plus `pg_dump --format=custom`; restore into an isolated recovery environment and run tenant/isolation, checksum, event/outbox, and export reconciliation.
- R2/object storage: require provider versioning/replication or approved backup, inventory/checksum manifests, tenant-scoped restore, and periodic sample recovery.
- A backup configuration is not evidence. Record restore date, operator, source point, recovery environment, duration, checks, exceptions, and approval.

### Matter archive verification

- Complete golden exports use `application/x-tar` and contain `manifest.json` plus `documents/<document-id>/original.pdf` entries.
- Before an export job becomes ready, Athena parses the TAR, rejects unsafe/duplicate paths or invalid header checksums, and recomputes every original SHA-256 against document metadata.
- `restoration_verified_at` is written only after that read-back succeeds. Missing or mismatched bytes preserve a partial classification and machine-readable `missing_items`.
- Tenant portability reads tables in 500-row pages and stops above 50,000 total rows or a 64 MiB estimated/final TAR, preserving a non-downloadable failed job and immutable limit evidence. This still verifies synthetic archives, not full-environment disaster recovery; streaming TAR construction, encryption policy, key recovery, and sampled restore exercises remain required.

## Production launch checklist

1. Security architecture, threat model, privacy/legal, vendor, BAA/DPA, and subprocessor reviews approved.
2. Verified identity/MFA/session policy, role/context authorization, ethical walls, support access, access review, and break-glass audit tested.
3. Application rate-limit counters, 429/`Retry-After` behavior, access-decision evidence, and edge/WAF throttling validated under representative load.
4. Tenant isolation proven across API, objects, search, cache, jobs, events, export, logs, and AI.
5. Malware scanning, retention/legal hold, deletion, complete export, backup/restore, incident response, monitoring, rate limiting, CSP/origin controls, secrets, and vulnerability gates proven.
6. Provider credentials/scopes/subscriptions/recovery/reconciliation verified individually; disabled integrations remain disabled.
7. California content versions and client governance/billing profiles receive named legal/operational approval.
8. Migration dry run, counts/checksums/exceptions, user acceptance, cutover, rollback, and legacy archive approved.
9. Accessibility, performance, load, golden workflows, disaster recovery, and incident tabletop pass with recorded evidence.
10. DNS/TLS/canonical redirects/callbacks/webhooks verified; production data is introduced only after named launch approval.

## Event-delivery operations

- Open `/admin/platform` as a partner or firm administrator and load tenant-scoped health.
- Confirm a recent `cron:*/5 * * * *` reconciliation timestamp after deployment. The current Sites deployment produced no row after the next tick and exposes no cron configuration status; treat automation as not connected. Use the owner-only manual cycle only as a fallback. Production activation requires a runtime with Worker cron enabled, then a new `cron:` row with `matched` outcome and zero exceptions.
- `pending` messages may be published only to the Athena-native internal sink in this pilot. The receipt text explicitly disclaims external delivery.
- A lease expires after 30 seconds so another worker can recover abandoned work. Retry policy uses capped exponential backoff and dead-letters at five attempts.
- Investigate the last error before replay. Replay resets attempt state but does not alter the immutable source event or prior delivery receipts.
- Do not label Microsoft, EAMS, MerusCase, OCR, AI, or other provider activity delivered without provider-native confirmation and reconciliation.
