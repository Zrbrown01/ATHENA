# Athena Implementation Plan

Updated: 2026-08-20

## Current-state finding

Athena is an isolated Vinext/React/TypeScript modular monolith deployed as an owner-only Sites pilot. It has a PostgreSQL target model, a smaller live D1 model, R2 quarantine storage, immutable event envelopes, an outbox, source-linked QME candidate facts, and persisted human decisions. The operational screens are useful product direction, but most are backed by synthetic read-only fixtures and do not yet satisfy the master specification's definition of a complete feature.

## Ordered delivery plan

1. Complete the deterministic Release 1 golden workflow as one persisted vertical slice: import → evidence → deterministic OCR/classification → source-linked analysis → Verbatim draft → attorney approval → Microsoft delivery handoff → matter activity → candidate time → billing validation → audit → export.
2. Enforce authenticated tenant and matter authorization at every command/query boundary in that slice, including ethical-wall denials and tenant-scoped object/export keys.
3. Add durable workflow state, outbox retry/dead-letter/reconciliation behavior, retention/legal-hold checks, and complete retry/idempotency semantics.
4. Prove the slice with unit, integration, migration, accessibility, tenant-isolation, upload-security, audit, export, billing, and golden-workflow tests.
5. Complete all documentation artifacts required by the master specification and maintain an evidence-based module status matrix.
6. Publish each verified increment to the isolated GitHub branch and owner-only Sites deployment. Keep Microsoft 365, MerusCase, EAMS/JET, OCR/AI production providers, Noted, Verbatim transcription, telephony, and client access visibly disconnected until activation evidence exists.

## Architecture risks

- The live D1 pilot and target PostgreSQL schema are currently different persistence surfaces; feature ownership and migration parity must stay explicit.
- Current authorization relies on one owner-only Sites policy plus a hard-coded pilot tenant/matter context. This is insufficient for multi-tenant production.
- Outbox rows are written but no delivery/reconciliation worker exists.
- Quarantined uploads cannot be released because malware scanning is not connected.
- Static operational fixtures can be mistaken for implemented records unless screens and status documentation label their scope precisely.
- Complete export, retention/legal-hold review, controlled migration, and a synthetic incident/control/risk operations slice are implemented. Backup restore evidence, automatic identity revocation/alerting/notification, complete tenant export, and provider recovery remain incomplete.

## Release gates

- No live provider is represented as connected without verified credentials, contractual approval, scopes, and reconciliation evidence.
- No uploaded document leaves quarantine without an approved scanner result.
- No substantive legal or financial action occurs without an authenticated, authorized human decision.
- No release is described as production ready until every applicable Definition of Done row has direct evidence.
