# Access Control

## Enforcement order

Athena authorizes the tenant, ordinary matter membership, and then persisted matter restrictions before reading metadata or object bytes. An active `deny` always wins. Expired or formally released policies no longer deny access, but their placement/release evidence remains in the immutable event ledger and transactional outbox.

Hosted authentication is necessary but not sufficient for application access. Production maps only account IDs in the secret `ATHENA_PILOT_PARTNER_USER_IDS` runtime value to the pilot attorney/partner role and golden-matter membership. Unknown authenticated identities receive an empty role set and no matter membership. Support identities use the separate `ATHENA_PILOT_SUPPORT_USER_IDS` mapping and still require a current persisted support grant. The deterministic `user-maya-chen` partner fixture exists only outside production.

## Ethical-wall administration

Only a partner or firm administrator with existing matter access may place or release a wall. Commands require a target user, documented reason, idempotency key, and optimistic revision on release. Administrators cannot wall their own active session. The current policy row retains placement/release actors, timestamps, reasons, status, expiry, and revision; the immutable events preserve every transition.

## Data-plane contract

The shared isolation boundary covers API reads/writes, object bytes, exports, jobs, events, search, AI retrieval, caches, and support. Search, AI retrieval, and cache products are not active; their adapters must call this boundary before lookup when implemented. Support additionally requires a current, partner-approved, matter-scoped grant.

## Classification boundary

Resource classification is a second, subordinate decision after tenant and matter authorization. The approved policy models access, search, AI, sharing, download, printing, retention, export, and logging. Search currently redacts or omits classified document results; export creation and archive download call the shared boundary. The administration proof records all nine outcomes for one synthetic document. Unclassified resources currently preserve legacy allow behavior, so firmwide mandatory labeling and remaining adapter coverage are required before production.

The synthetic support identity is denied ordinary pilot matter membership. A partner or firm administrator can grant 15–240 minutes for one matter, one purpose, and one ticket reference. Expiry is mandatory; revocation is immediate and revision-guarded. An active ethical wall still overrides the grant. The support endpoint returns scope metadata only—never matter facts, documents, work product, export bytes, or client information—and Sites remains owner-only.

Access-review attestations snapshot counts of active walls, unexpired support grants, and allowed/denied decisions for a defined review period. The reviewer records a certified or exceptions-noted outcome and notes. Athena also persists an immutable built-in permission catalog, normalized local-fixture identities, scoped role assignments, suspension, assignment revocation, offboarding decisions, and checksum-pinned deterministic directory drift reviews. This remains control evidence, not proof that an external directory or customer roster was reviewed; Microsoft Entra SSO/SCIM, live MFA claims, delta synchronization, and automatic session revocation are not connected.

Every persisted matter authorization records an immutable decision containing tenant, actor, matter, data plane, allowed/denied outcome, reason code, request ID, and timestamp. It does not copy document text, medical facts, work product, or other matter content into the control record.

Authenticated write routes use durable, atomic, per-actor/per-action fixed windows. Ordinary commands permit 30 requests per 60 seconds; document intake and owner operations use a tighter 10-per-minute policy. Rejections return HTTP 429 with `Retry-After` and do not pretend the command was processed. Window rows expire logically and are indexed for later controlled cleanup.

## Pilot proof

The administration UI uses synthetic reviewer and support identities. Tests prove fail-closed production identity mapping, distinct partner/support principals, deny-overrides-membership across every defined data plane, cross-tenant cache/job rejection, no-grant/wrong-matter/expired/revoked/walled support denial, self-wall prevention, stale-release rejection, and terminal placement/release state. A source-level contract discovers all 88 handlers in 47 API routes and requires authenticated identity plus an authorization boundary on each; every mutation must also invoke same-origin enforcement and durable rate limiting. This is software control evidence, not an independent penetration test.
