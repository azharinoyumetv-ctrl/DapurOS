# Shared account-closure write fence

29 October 2026. DapurOS and GerainaOS share identities/database state. The identical `backend/erasure_guard.py` on both backends fences each application mutation in the same transaction as its store/account/module/membership guard. Request context also fences an already authenticated staff request after staff-only deletion. Nested helpers share the transaction; guards are touched once per transaction.

The database adapter and authentication hooks honor closure state without extra normal menu-read queries. Geraina-only erasure preserves a shared identity, its DapurOS entitlement and legitimate DapurOS writes. A closed module returns an explicit closed-access response. Store plan cleanup is scoped to the request module.

Deploy this with the matching Geraina backend and finish draining old unfenced deployments before operating erasure. `GET /api/system/erasure-capabilities` reports the module, protocol and normalized implementation fingerprint with `Cache-Control: no-store`. The support CLI checks both official backends and its local fingerprint before destructive work. No destructive HTTP endpoint exists.

The support workflow, policy/deadline requirements, minimum financial/time retention, retries, cancellation and restore procedure are documented in GerainaOS `docs/ACCOUNT-ERASURE-RUNBOOK.md`. No actual customer erasure, provider purge, bank payment or printer output was performed by the local checks.
