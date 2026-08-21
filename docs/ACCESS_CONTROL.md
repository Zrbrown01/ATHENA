# Access Control

## Enforcement order

Athena authorizes the tenant, ordinary matter membership, and then persisted matter restrictions before reading metadata or object bytes. An active `deny` always wins. Expired or formally released policies no longer deny access, but their placement/release evidence remains in the immutable event ledger and transactional outbox.

## Ethical-wall administration

Only a partner or firm administrator with existing matter access may place or release a wall. Commands require a target user, documented reason, idempotency key, and optimistic revision on release. Administrators cannot wall their own active session. The current policy row retains placement/release actors, timestamps, reasons, status, expiry, and revision; the immutable events preserve every transition.

## Data-plane contract

The shared isolation boundary covers API reads/writes, object bytes, exports, jobs, events, search, AI retrieval, caches, and support. Search, AI retrieval, and cache products are not active; their adapters must call this boundary before lookup when implemented. Support additionally requires a current, partner-approved, matter-scoped grant.

The synthetic support identity is denied ordinary pilot matter membership. A partner or firm administrator can grant 15–240 minutes for one matter, one purpose, and one ticket reference. Expiry is mandatory; revocation is immediate and revision-guarded. An active ethical wall still overrides the grant. The support endpoint returns scope metadata only—never matter facts, documents, work product, export bytes, or client information—and Sites remains owner-only.

Access-review attestations snapshot counts of active walls, unexpired support grants, and allowed/denied decisions for a defined review period. The reviewer records a certified or exceptions-noted outcome and notes. This is control evidence, not proof that an external directory or customer roster was reviewed; directory integration is not connected.

Every persisted matter authorization records an immutable decision containing tenant, actor, matter, data plane, allowed/denied outcome, reason code, request ID, and timestamp. It does not copy document text, medical facts, work product, or other matter content into the control record.

Authenticated write routes use durable, atomic, per-actor/per-action fixed windows. Ordinary commands permit 30 requests per 60 seconds; document intake and owner operations use a tighter 10-per-minute policy. Rejections return HTTP 429 with `Retry-After` and do not pretend the command was processed. Window rows expire logically and are indexed for later controlled cleanup.

## Pilot proof

The administration UI uses synthetic reviewer and support identities. Tests prove deny-overrides-membership across every defined data plane, cross-tenant cache/job rejection, no-grant/wrong-matter/expired/revoked/walled support denial, self-wall prevention, stale-release rejection, and terminal placement/release state. This is software control evidence, not an independent penetration test.
