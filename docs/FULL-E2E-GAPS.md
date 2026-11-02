# DapurOS 1.0.3 end-to-end closure

The previous browser fixtures checked presentation and Android integration, but
did not prove business writes. This release adds real registration, JWT/store
resolution, production FastAPI handlers, the unchanged erasure fence and a real
disposable MongoDB replica. External network access is blocked in that backend.
No production customer records, live charges, mail delivery or erasure requests
are used by these tests.

| Flow | Reproduced gap | Verified behavior |
|---|---|---|
| Menu and recipes | Product creation failed; duplicate route definitions hid divergent behavior; CSV edits lost recipes | Real UI creation/import, preserved omitted fields and recipe, own-store ingredient validation, atomic stock writes |
| Catalogue and navigation | Fixed-size lists hid later records; large tables rendered every row | Complete 618-menu enumeration, search of the last item, 25 visible menu rows, failed later page rejected and retried; all 58 canonical screens load |
| Dashboard and reports | Missing charts, fabricated profit margin and current-cost rewrites | Recorded paid sales, saved sale costs, unknown legacy costs shown honestly, actual recorded tax and CSV export; plan-appropriate reads |
| Purchasing | PO input dropped items; receiving logged success without adding stock | Persisted item lines, real product/ingredient stock and ledger changes, partial receipt and fractional units, retry applied once |
| Adjustments and transfers | Orphan/partial adjustments; transfers changed logs only | Missing stock rejected, transactional rollback on injected failure, source/branch balances conserved through ship/receive/cancel |
| Table sessions | Concurrent staff could create multiple sessions; open bills could be deleted | Six concurrent opens share one session; occupied table/floor deletion blocked; stale checkout total rejected; empty session can close |
| Split bills and kitchen | Wrong quantity field; closing payment modal stranded split portions | Actual UI split, recovery after reload, both portions paid, exact stock/totals; cancellation removes only affected kitchen quantities |
| Public guest QR | Generated URL had no working public ordering route | Revocable public menu and anonymous order, authoritative price/session validation, KDS/table/counter settlement, lost-response recovery with the same request ID |
| Customers and loyalty | Point edits could overwrite newly earned points; cashier could change benefits | Pro form avoids Business-only reads, stale edits fail safely, name-only edits preserve points, management-only benefit changes; sale/void earn/reverse once |
| Supplier invoices and debt | Missing invoice entry and unsafe payment retries | Real invoice form, duplicate prevention, synchronized partial payable, bounded payments, same-ID recovery and stale different-payment rejection |
| Staff and devices | Concurrent registrations exceeded plan capacity | Actual temporary-password change, attendance/deactivation, server role checks; Starter remains at two devices and five employees |
| Configuration and payments | Page fixtures alone did not prove persistence or failure behavior | Settings persist/reload, unconfigured electronic methods leave no paid order or stock deduction; existing signed-payment regression checks remain green |
| Offline cash | Needed proof across storage, page restart and server replay | Actual IndexedDB receipt survives reopening, syncs once to real backend, repeated reconnect does not duplicate sale; ingredient shortage remains readable and correctable |
| Android and companion apps | Required verification of the exact new package | Signed installation on phone/two landscape profiles, theme and paid-tier checks, same-package app switching and startup recovery; upgrade retains the recorded pending receipt |

The full-stack suite is `frontend/tests/full-stack-local.spec.js`; real ASGI
socket and failure-injection checks are in `e2e/`. `e2e/run.cjs` creates only
random local test databases and never loads production `.env` credentials.
The test-only fixture endpoints are absent from the production app import path.

Reproduction from a completed frontend build:

```powershell
node e2e/run.cjs --with-sockets --with-contracts --with-transactions
```

The exact signed-package checks and final counts are recorded in
`ANDROID-1.0.3-VERIFICATION.json`. This scope covers real local business flows,
browser presentation and installed Android integration. Physical printer output,
live merchant settlement, provider email/message delivery, and physical OEM
firmware are not certified by these local/emulator checks. Legacy inventory
history is not fabricated, and old sales without saved costs remain unknown.

The demo sweep removes the QR menu's duplicate phone/order preview, unused sample
catalogue and mock database, fake payment-generation branches, unsigned webhook
simulation endpoints and the unrestricted manual mark-paid endpoint. QR setup now
prints/downloads the actual enabled table QR and opens the actual guest menu.
Public feature illustrations use installed-app screenshots. Historical simulated
WhatsApp messages are excluded from the customer view without deleting records.
Tests explicitly set the former development flags and verify they cannot produce
a fake payment or accept unsigned simulated events.
