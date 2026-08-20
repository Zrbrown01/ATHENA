# Athena Product Specification

## Product promise

Athena is the matter-centered operating system for California workers’ compensation defense firms: **Know the file. See what comes next.** It maintains verified current state while preserving the evidence and human decisions behind that state.

## Core operating loop

Sources create evidence → evidence creates candidate facts → verified facts update the Matter Graph → changes create events → rules create explainable work → work creates communications, documents, filings, decisions, and billing → outputs return as evidence and events.

## Primary users

Attorneys, supervising partners, legal assistants, paralegals, docketing/EAMS specialists, records and billing specialists, firm administrators, authorized claims professionals, employers/insureds, vendors, New Reign operations, Verbatim reviewers, and auditors.

## Product invariants

- Matter, Claim, Injury, and ADJ/WCAB Case remain separate records.
- Material facts carry source, excerpt/page, method, confidence, review, conflict, and supersession history.
- Legal and financial actions require authenticated, contextually authorized human decisions.
- External systems use recoverable, idempotent handoffs and visible health states.
- Originals and derivatives remain distinct.
- Tenant, matter, ethical-wall, classification, purpose, and external-user context constrain access.
- Synthetic or deterministic provider output is never represented as external success.

## Current private pilot

The owner-only pilot provides the application shell, work/matter views, quarantined PDF intake, source-linked QME fact review, human workflow gates, and a deterministic Release 1 control room. The control room persists matter import, QME analysis, Verbatim-shaped draft, attorney approval, blocked Microsoft handoff, confirmed time, billing validation, audit, event/outbox records, and an R2 export manifest.

## Explicit non-goals of the current release

The release does not process production PHI; send email; access MerusCase, EAMS/JET, Noted, Verbatim transcription, telephony, or OCR/AI providers; release quarantined uploads; expose a client portal; or claim HIPAA compliance, SOC 2 attestation, or production readiness.

## Release acceptance

A release is accepted only when commands, structured records, provenance, events, governance, authorization, accessible UX, audit, provider failure/recovery, export, retention, security, tests, metrics, and documentation have direct evidence for the delivered slice.
