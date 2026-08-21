# Access Control

## Enforcement order

Athena authorizes the tenant, ordinary matter membership, and then persisted matter restrictions before reading metadata or object bytes. An active `deny` always wins. Expired or formally released policies no longer deny access, but their placement/release evidence remains in the immutable event ledger and transactional outbox.

## Ethical-wall administration

Only a partner or firm administrator with existing matter access may place or release a wall. Commands require a target user, documented reason, idempotency key, and optimistic revision on release. Administrators cannot wall their own active session. The current policy row retains placement/release actors, timestamps, reasons, status, expiry, and revision; the immutable events preserve every transition.

## Data-plane contract

The shared isolation boundary covers API reads/writes, object bytes, exports, jobs, events, search, AI retrieval, caches, and support. Search, AI retrieval, cache, and support products are not active; their adapters must call this boundary before lookup when implemented. Support additionally requires a current, partner-approved, matter-scoped grant. No standing support or break-glass grant exists in the pilot.

Every persisted matter authorization records an immutable decision containing tenant, actor, matter, data plane, allowed/denied outcome, reason code, request ID, and timestamp. It does not copy document text, medical facts, work product, or other matter content into the control record.

Authenticated write routes use durable, atomic, per-actor/per-action fixed windows. Ordinary commands permit 30 requests per 60 seconds; document intake and owner operations use a tighter 10-per-minute policy. Rejections return HTTP 429 with `Retry-After` and do not pretend the command was processed. Window rows expire logically and are indexed for later controlled cleanup.

## Pilot proof

The administration UI uses a synthetic reviewer identity. Tests prove deny-overrides-membership across every defined data plane, cross-tenant cache/job rejection, support grant expiry/scope enforcement, self-wall prevention, stale-release rejection, and terminal placement/release state. This is software control evidence, not a completed access review or independent penetration test.
