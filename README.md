# Athena

**The Workers’ Compensation Defense OS**
*Know the file. See what comes next.*

Athena is a California-first, matter-centered case management platform for workers’ compensation defense firms. This repository is an isolated greenfield build and does not share code or history with the owner’s other applications.

**Canonical production domain:** [www.athenacms.app](https://www.athenacms.app)

## Current build status

The current private pilot includes:

- A desktop-first work queue, matter inventory, and matter workspace.
- Referral/conflict intake, California docket control, evidence, communications, billing, reporting, clients, authority, and operations views.
- A canonical tenant-aware PostgreSQL model plus a deployment-local D1 persistence model.
- Separate Matter, Claim, Injury, and ADJ records.
- Original-document metadata and provenance-bearing fact observations.
- A QME fact-review workflow with source page, excerpt, confidence, and downstream impact.
- Authenticated, persisted human gates for fact review, intake, authority, time, reports, and filing packets.
- PDF content validation, checksum, tenant-scoped R2 storage, and quarantine metadata. No document is released because malware scanning is not connected.
- Immutable business-event envelopes and transactional D1 outbox writes.
- Provider-neutral integration contracts with honest disabled states.
- Synthetic golden-matter data and authorization tests.

It is **not production ready**. The hosted pilot is owner-only and uses the hosting platform’s authenticated identity headers. Microsoft 365, MerusCase, EAMS, malware scanning, OCR, AI execution, court reporting, and client access are not connected.

## Local development

Requirements: Node.js 22+ and npm 11+.

```bash
cp .env.example .env.local
npm install
npm run db:migrate:local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the complete local check:

```bash
npm run check
```

Install the pinned Chromium runtime once, then run the browser behavior and visual-regression gate:

```bash
npx playwright install chromium
npm run test:e2e
```

Use `npm run test:e2e:update` only for intentional UI changes and visually inspect the regenerated baselines before committing them.

Local and preview environments must contain synthetic data only.

## Repository map

```text
src/app/                 Next.js routes and API boundary
src/components/          Accessible product UI
src/db/schema.ts         Canonical PostgreSQL schema
db/schema.ts             Hosted pilot D1 schema
drizzle/                 Hosted pilot SQLite migrations
db/postgres-migrations/  Canonical PostgreSQL migrations
src/domain/              Matter data and domain commands
src/integrations/        External-provider contracts
src/platform/            Tenant authorization and events
docs/                    Product, architecture, security, and status records
```

The deterministic Release 1 workflow is available at `/pilot/release-one`. It persists each stage, approval, audit record, event, outbox item, billing validation, provider failure state, and export. Its sandbox results prove workflow behavior only; they do not represent connected providers.

Local backup command:

```bash
npm run db:backup:local
```

Repeatable disposable restore verification:

```bash
npm run db:recovery:verify
```

The verification command exports only the local D1 database, restores it into a temporary SQLite database, checks the full expected application-table and migration counts, verifies event/outbox parity and single-tenant scope, runs SQLite integrity and foreign-key checks, prints a checksum-pinned JSON manifest, and removes the temporary files. Production/provider backup and restore evidence is still a launch gate.

## Product loop

Sources create evidence → evidence creates candidate facts → verified facts update the Matter Graph → changes create events → events activate rules → rules create work → work produces communications, documents, filings, decisions, and billing → outputs return as evidence and events.

## Data and compliance notice

Use synthetic data only until the production environment, contracts, authorization model, security controls, and provider configurations have been independently reviewed. Athena is not represented as HIPAA compliant, SOC 2 attested, EAMS connected, MerusCase connected, malware-scanned, or production ready.
