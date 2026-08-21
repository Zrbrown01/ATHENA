# Integrations and Activation

All providers implement health, backfill, reconciliation, revocation, provider event ID, tenant idempotency, retry, and audit contracts. Missing approval or credentials produces `not_connected`; it never produces simulated live success.

| Provider | Current mode | Activation evidence required |
|---|---|---|
| Microsoft 365 | Not connected; native communication and calendar records persist without claiming provider IDs, scopes, cursors, subscriptions, sync timestamps, transmission, or calendar writes | app registration, tenant consent, least-privileged mail/calendar scopes, mailbox authorization, attachment sync, subscriptions/delta recovery, revocation, sending/calendar writes, and delivery reconciliation |
| MerusCase | Not connected; deterministic shaped import only | provider relationship, endpoint documentation, OAuth, export samples, source-ID mapping, verified read/write behavior, reconciliation |
| Malware scanning | Not connected; every upload remains quarantined | approved provider, contract/BAA as applicable, signature/version evidence, release and failure policy |
| OCR/AI | Production disabled; deterministic fixed QME processor only | approved providers, security/privacy review, BAA/DPA where applicable, model/data-retention controls, source-grounding evaluation |
| EAMS/JET | Not connected | approved manual/provider workflow or JET authority, versioned forms/titles, packet validation, status/rejection reconciliation |
| Noted | Not connected | vendor/service agreement, client governance, booking/status/transcript/billing contract |
| Verbatim | Not connected; deterministic work-product draft only | transcription/reviewer workflow, vocabulary/template controls, audio consent/retention, attachment and delivery reconciliation |
| Telephony/SMS | Not connected; recording disabled | number/provider, consent and HELP/STOP policy, delivery status, recording approval, retention |

## Failure rules

Provider calls must be idempotent, persist attempt state before transmission, use bounded retry/backoff, dead-letter after policy exhaustion, reconcile missed events/cursors, preserve source provider IDs, support user/tenant revocation, and expose operator health. The current Microsoft handoff intentionally stops before transmission.
