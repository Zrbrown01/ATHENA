# Athena

**The Workers’ Compensation Defense OS**
*Know the file. See what comes next.*

Athena is a California-first, matter-centered case management platform for workers’ compensation defense firms. This repository is an isolated greenfield build and does not share code or history with the owner’s other applications.

**Canonical production domain:** [www.athenacms.app](https://www.athenacms.app)

## Current build status

This first foundation slice includes:

- A desktop-first, accessible matter workspace.
- A canonical tenant-aware relational schema.
- Separate Matter, Claim, Injury, and ADJ records.
- Original-document metadata and provenance-bearing fact observations.
- A QME fact-review workflow with source page, excerpt, confidence, and downstream impact.
- A server-side authorization boundary for fact review.
- Immutable business-event envelopes and transactional outbox schema.
- Provider-neutral integration contracts with honest disabled states.
- Synthetic golden-matter data and authorization tests.

It is **not production ready**. Authentication is a clearly marked development adapter; external providers are not connected; document upload, malware scanning, OCR, and AI execution are not yet implemented.

## Local development

Requirements: Node.js 22+ and npm 11+.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the complete local check:

```bash
npm run check
```

Local and preview environments must contain synthetic data only.

## Repository map

```text
src/app/                 Next.js routes and API boundary
src/components/          Accessible product UI
src/db/schema.ts         Canonical PostgreSQL schema
src/domain/              Matter data and domain commands
src/integrations/        External-provider contracts
src/platform/            Tenant authorization and events
docs/                    Product, architecture, security, and status records
```

## Product loop

Sources create evidence → evidence creates candidate facts → verified facts update the Matter Graph → changes create events → events activate rules → rules create work → work produces communications, documents, filings, decisions, and billing → outputs return as evidence and events.

## Data and compliance notice

Use synthetic data only until the production environment, contracts, authorization model, security controls, and provider configurations have been independently reviewed. Athena is not represented as HIPAA compliant, SOC 2 attested, EAMS connected, MerusCase connected, or production ready.
