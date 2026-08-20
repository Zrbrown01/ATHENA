# Deployment Runbook

## Canonical address

- Production application: `https://www.athenacms.app`
- Canonical host: `www.athenacms.app`
- Apex behavior: `https://athenacms.app` redirects permanently to the canonical `www` host.

The application is deployed as an owner-only Sites pilot at `https://athena-cms.new-reign-ca-8518.chatgpt.site`. It contains synthetic data only and is not a production authorization. The canonical custom domain remains pending DNS verification.

## Required production configuration

```text
NEXT_PUBLIC_APP_URL=https://www.athenacms.app
AUTH_MODE=platform_headers
D1_BINDING=DB
R2_BINDING=DOCUMENTS
OCR_PROVIDER=<approved provider or disabled>
AI_PROVIDER=<approved provider or disabled>
```

Never commit production values or credentials. Use the selected cloud’s managed secret service.

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
4. Run golden workflow, accessibility, authorization, isolation, migration, and security checks.
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
