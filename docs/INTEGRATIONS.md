# Integrations and Activation

All providers implement health, backfill, reconciliation, revocation, provider event ID, tenant idempotency, retry, and audit contracts. Missing approval or credentials produces `not_connected`; it never produces simulated live success.

| Provider | Current mode | Activation evidence required |
|---|---|---|
| Microsoft 365 | Not connected; native communication and calendar records persist without claiming provider IDs, scopes, cursors, subscriptions, sync timestamps, transmission, or calendar writes | app registration, tenant consent, least-privileged mail/calendar scopes, mailbox authorization, attachment sync, subscriptions/delta recovery, revocation, sending/calendar writes, and delivery reconciliation |
| MerusCase | Not connected; deterministic shaped import only | provider relationship, endpoint documentation, OAuth, export samples, source-ID mapping, verified read/write behavior, reconciliation |
| Malware scanning | Not connected; every upload remains quarantined | approved provider, contract/BAA as applicable, signature/version evidence, release and failure policy |
| OCR/AI | Production disabled; deterministic fixed QME processor only | approved providers, security/privacy review, BAA/DPA where applicable, model/data-retention controls, source-grounding evaluation |

Provider activation is also gated by the durable compliance registry. A current passing security review, executed BAA and DPA (or documented approved not-required bases), complete data-category authority, and prohibited training use may establish contractual eligibility only. Credentials, scopes, technical health, and reconciliation must still be verified separately before any connection is represented as live.
| EAMS/JET | Not connected | approved manual/provider workflow or JET authority, versioned forms/titles, packet validation, status/rejection reconciliation |
| Noted | Native lifecycle functional; provider not connected | Athena persists request/governance/handoff/scheduling/calendar/completion/transcript-metadata/closure truth. Activation still requires vendor/service agreement, approved data use, credentials, verified booking/status/transcript/invoice contract, idempotency, and reconciliation. |
| Verbatim | Not connected; deterministic work-product draft only | transcription/reviewer workflow, vocabulary/template controls, audio consent/retention, attachment and delivery reconciliation |
| Telephony/SMS | Not connected; recording disabled | number/provider, consent and HELP/STOP policy, delivery status, recording approval, retention |

## Failure rules

Provider calls must be idempotent, persist attempt state before transmission, use bounded retry/backoff, dead-letter after policy exhaustion, reconcile missed events/cursors, preserve source provider IDs, support user/tenant revocation, and expose operator health. The current Microsoft handoff intentionally stops before transmission.
