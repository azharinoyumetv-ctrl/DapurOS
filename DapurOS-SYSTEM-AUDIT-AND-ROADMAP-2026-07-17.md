# DapurOS — Fresh System Audit & Product Roadmap
Date: 2026-07-17 · Scope: DapurOS only (backend + frontend) · Method: full re-read of all 15 backend route files + models/auth/database, and all 44 frontend pages + router/nav config, cross-checked against the 2026-07-10 audits and the 2026-07-10 PRD, then spot-verified against the live source.

This picks up exactly one week after `PRODUCTION-READINESS-AUDIT-2026-07-10.md`, `NONFUNCTIONAL-BUTTONS-AUDIT-2026-07-10.md`, and `BACKEND-PRD-PRODUCTION-GAPS-2026-07-10.md`. Short version: **none of the seven frontend bugs from the 07-10 audit have been fixed**, the PRD's "build reporting/printer/EDC on GerainaOS first, then port to DapurOS" plan has not reached DapurOS at all, and this fresh pass found a more serious problem the prior audits missed — a staff privilege-escalation bug that lets any logged-in employee grant themselves Owner access.

## 1. Critical — fix before this touches more real merchants

**1.1 Any staff account can promote itself to Owner.** `routes_staff.py`'s `create_staff` (line 19), `update_staff` (line 57), and `delete_staff` (line 83) are gated only by `get_current_user` — there is no `require_admin` dependency on any of them, and `StaffBase.role` (`models.py:329`) is a free-text string with no allowed-values check. `require_admin` (`auth.py:107-110`) grants admin rights to any user whose `role` is exactly `"admin"` or `"Owner"`. Put those two facts together: a Waiter or Kasir login can call `PUT /api/staff/{their_own_id}` with `{"role": "Owner"}` and immediately gain access to every admin-gated action in the system — order void, mark-paid, plan upgrade, subscription changes — with nothing anywhere blocking it. This defeats the owner/staff separation the whole platform is designed around. Fix: add `require_admin` to all three staff-mutation endpoints, and constrain `role` to a `Literal` enum server-side (not just in the UI).

**1.2 New staff accounts get a hardcoded, shared default password.** `routes_staff.py:41-51` sets every auto-created login to the literal string `"geraina123"` — copy-pasted verbatim from GerainaOS (`GerainaOS/backend/routes_staff.py:43` is byte-identical) — with no forced change on first login. Combined with 1.1, anyone who can see a staff email (any logged-in staff can list `GET /api/staff`) has a plausible path to an unchanged default password. Fix: generate a random per-account password (or a magic-link/invite flow) and force a change on first login.

**1.3 Payment-gateway secrets are writable by any staff login.** `save_settings`, `save_payments_config`, and `save_integrations` (`routes_settings.py:25,69,105`) are only `get_current_user`-gated, not `require_admin` — but they store real secrets (`xendit.secret_key`, `stripe.secret_key`, `midtrans.server_key`, WhatsApp `api_token`). That's inconsistent with the admin-gating already applied to billing/subscription/void/mark-paid, and a materially more sensitive surface than typical POS staff duties. Fix: require admin for all three.

**1.4 A same-day order-number collision between two different stores can mark the wrong store's order as paid.** `next_order_no()` (`database.py:39-51`) formats the public `order_no` as `GR-{date}-{seq}` — the per-store uniqueness only lives in the internal counter key, not in the visible string. Two unrelated stores' first order of the day both become `GR-20260717-0001`. The Xendit webhook handler (`routes_webhooks.py:47-48`, confirmed by direct read) matches purely on `db.orders.update_one({"xendit_reference_id": ref}, ...)` with **no `store_id` filter and no amount check** — so a payment webhook from Store B's own BYO Xendit account can flip Store A's identically-numbered order to `"paid"`. There's also no unique index on `order_no` to catch this at the database layer. Fix: include `store_id` in the public order number, add a `store_id` filter (and an amount-matches-total check) to the webhook handler, and add a unique compound index.

## 2. The "fake success" pattern is bigger than the 07-10 audit found

The prior audit flagged three places where a failed save shows a success message anyway. This pass confirms those three are **still unfixed**, and found the same failure mode in four more places — including one that's customer-facing:

| Location | What happens on failure | Status |
|---|---|---|
| `Settings.jsx:33-40` `handleSave` | Shows fake "(Local Mode)" success toast | Unfixed, confirmed unchanged |
| `PaymentConfig.jsx:404-416` `handleSave` | Same fake "(Local Mode)" success toast | Unfixed, confirmed unchanged |
| `Pricing.jsx:44-56` `handleUpgrade` | Sets plan client-side + fake success alert | Unfixed in code, but paid-tier purchases now route to a "Hubungi Sales" mailto link instead — only the trial-downgrade path can still trigger it |
| `products/QrMenu.jsx:84-94` self-order flow | Customer scans table QR, order POST fails, code does `console.log("Mock order sent")` and unconditionally shows "Pesanan Terkirim ke Dapur!" | **New finding.** A customer is told their order reached the kitchen when it didn't — worse blast radius than the staff-facing bugs, since the kitchen never sees the order and the customer has no reason to follow up |
| `products/Ingredients.jsx` `handleSave`/`handleDelete` (lines 102-147) | Optimistic local-state update happens first; failure is swallowed to `console.warn` only, form closes as if saved | **New finding.** A BOM/ingredient edit or delete can silently fail to persist; the UI shows success and the data quietly reverts on next reload |
| `Reports.jsx:266` "Unduh e-Faktur CSV" | Pure `alert()`, no file generated | Unfixed, confirmed unchanged |
| `Settings.jsx:185` "Kirim Test Print" | Pure `alert()`, no printer call | Unfixed, confirmed unchanged, despite the PRD specifically promising `window.print()`/ESC-POS here |

Separately, `products/QrMenu.jsx:151` ("Salin Tautan" / Copy Link) doesn't copy anything — it `alert()`s the raw URL text instead, mislabeled relative to what the button claims to do.

There's also a wider, lower-severity version of this same trust problem: about a dozen save handlers (`Membership.jsx`, `LoyaltyPoints.jsx`, `Attendance.jsx`, `StockAdjustment.jsx`, `StockTransfer.jsx`, `AccountsPayable.jsx`, `AccountsReceivable.jsx`, `GoodsReceiving.jsx`, `SupplierInvoice.jsx`, `PurchaseOrder.jsx`, `Categories.jsx`, `Brands.jsx`, `Units.jsx`) have **no `.catch()` at all** — not a fake success, just total silence if the backend rejects the request. Lower severity than the items above, but worth a sweep since it's the same root cause (no failure path was ever designed for these forms).

## 3. Fabricated numbers reach further than the Reports page

The 07-10 audit's "Laba Rugi"/"Arus Kas"/turnover findings in `Reports.jsx` are still exactly as reported (`profitData` at line 187, `cfData` at line 215, hardcoded `"4.2x / bulan"` at line 141 — all unchanged). This pass found the same problem on the **dashboard that loads immediately after login**, which the prior audit didn't check:

`Dashboard.jsx` has four fabricated chart datasets and one unlabeled fake stat, all presented next to genuinely real numbers on the same screen: `salesTrendData` (lines 71-79) invents a daily breakdown by multiplying real weekly totals by fixed percentages; `pmtData` (81-86) is a flat, never-updated payment-method split (Cash 45/QRIS 30/E-Wallet 15/Bank VA 10); `cashflowData` (88-93) duplicates the same hardcoded weekly figures as `Reports.jsx`; `branchData` (95-98) splits real monthly sales across branches using fixed ratios instead of real per-branch data; and the "Posisi Kas" (cash-in-hand) card (line 184) computes `today_sales * 0.6 + 500000` — literally commented `// Cash in hand mock` in the code — and shows it to the merchant with no indication it's synthetic, unlike the adjacent margin card which at least labels itself an estimate. `Reports.jsx`'s own "sales" tab (lines 39-47) uses the identical fake-daily-split technique for its weekly trend chart.

Net effect: a merchant's two main "how's my business doing" screens both mix real and invented numbers with no visual distinction between them. This is the single highest-value fix for trust in the product, and it's larger in scope than the original PRD's Section 2 (which only covered `Reports.jsx`'s P&L/cashflow/turnover tabs) — the fix needs to extend to `Dashboard.jsx` too.

## 4. The GerainaOS→DapurOS port from the 07-10 PRD hasn't happened

The PRD's sequencing was explicit: build reporting, printer, and EDC on GerainaOS first, then copy the same modules into DapurOS. Today, `GerainaOS/backend` has `routes_reports.py`, `routes_printer.py`, `routes_edc.py`, `escpos.py`, and `edc_provider.py`, plus `Expense`/`ExpenseCreate` models — none of which exist anywhere in `DapurOS/backend`. DapurOS still has **zero** backend support for P&L/cashflow/inventory-turnover reporting, network (ESC/POS) printing, or card-present payments. The only progress on DapurOS's side is `routes_pdf.py` (a from-scratch, fully-working receipt/invoice generator, unrelated to the reports engine) — and even that still prints "Geraina POS" / "Powered by Geraina POS" branding on every DapurOS receipt (`routes_pdf.py:64,68,140`) because the fallback string was never re-branded.

## 5. Missing CRUD / incomplete workflows (functional gaps, not bugs)

These aren't broken — they were never finished:

- **Debt receivables, debt payables, and supplier invoices are write-once.** All three models carry `status`/`paid_amount` fields meant for tracking partial payments over time, but there is no `PUT` endpoint anywhere for any of them (`routes_customers.py`, `routes_purchase.py`). Once logged, a debt record can never be updated — which defeats the point of a debt ledger. This is the single most impactful CRUD gap found.
- **Memberships have no edit or delete** (`routes_customers.py:71-93`) — a loyalty tier, once created, is permanent.
- **Purchase orders have no edit or cancel** — a PO can only ever silently become `"Received"` via Goods Receiving; there's no way to correct line items or mark one cancelled.
- **Stock transfers can never be marked "Received."** The model defines the state (`models.py:216-220`), but no endpoint ever transitions it.
- **KDS tickets can't track individual dish status.** `KdsItem.status` (`models.py:485-489`) is designed for per-dish tracking (Pending/Cooking/Ready/Served), but `update_ticket_status` (`routes_kds.py:68-73`) applies the new status to every item on the ticket at once — so a kitchen can't mark one dish ready while others are still cooking, even though the schema was clearly built for exactly that.
- **Dine-in checkout never actually charges anything.** `settle_session` (`routes_tables.py:207-242`) sets `payment_status: "paid"` unconditionally regardless of `payment_method` — unlike direct-order checkout, which calls Xendit for QRIS/e-wallet. For an F&B app, dine-in is the primary flow; it currently has no payment-gateway integration at all.
- **Two payment methods are advertised but don't exist.** `routes_settings.py`'s default `payments_config` (lines 44-66) shows Midtrans (VA) and Stripe (credit card) as `is_active: true` with plausible-looking merchant IDs, but `create_order` (`routes_orders.py:166-196`) only has real logic for `qris`/`ewallet`; there's no `midtrans_client.py` or `stripe_client.py` anywhere in the repo. An order paid via VA or credit card would sit at `pending` forever with no charge attempted and no error shown.
- **Deleting a floor or table doesn't protect active sessions.** `delete_floor` (`routes_floors.py:83-95`) cascades to delete tables correctly, but neither it nor `delete_table` checks for an `Active` dining session first — deleting mid-service can orphan a session with no table to reference.
- **Deleting an ingredient doesn't check product recipes.** `delete_ingredient` (`routes_ingredients.py:166-172`) has no guard against an ingredient still referenced by a product's BOM; stock deduction at order time will silently no-op once it's gone.

## 6. Smaller items

`/dapuros/app/pricing` is missing from `getAppSubRoutes()` (confirmed directly in `App.js`) — a separate `/dapuros/pricing` route exists and works, but the app-shell version doesn't, and `Dashboard.jsx:142`'s trial-upgrade banner links straight to the broken one. Every trial user sees this banner on login, so it's a live, frequently-hit dead link, not an edge case. `LicenseDevices.jsx` is 100% mocked (a `mockDevices` array plus static "Terhubung"/"Aktif" strings) with zero API integration. Two files import `Optional` without using it (`routes_ingredients.py:3`, `routes_floors.py:3`). No TODO/FIXME markers exist anywhere in the frontend — all "belum" (not-yet) hits are legitimate empty-state copy.

## 7. What DapurOS should be — beyond closing today's gaps

Everything above is about making the *existing* feature set honest and complete. Separately, here's what's structurally absent that a restaurant/F&B POS platform at this stage would typically need — not bugs, just unbuilt territory worth deciding on:

**Table & service operations.** No reservation/booking system (walk-in only today). No waitlist. No table-merge for large parties (split-bill exists, merge doesn't). No customer-facing kitchen-status display (a screen showing "your order is being prepared" for dine-in, distinct from the QR self-order flow that already exists).

**Delivery & online channels.** No integration with GoFood/GrabFood/ShopeeFood — Indonesian F&B merchants routinely run 30-50% of volume through these, and DapurOS currently has no ingestion path for orders placed there, meaning merchants operating on those platforms are almost certainly re-entering orders by hand into DapurOS today.

**Staff operations beyond clock-in/out.** `Attendance.jsx` covers clock-in/out only — no shift scheduling, no labor-cost-vs-sales reporting, no leave/time-off tracking. The `Roles.jsx`/`Permissions.jsx` pages are read-only reference displays, not an actual configurable permission system — combined with the privilege-escalation bug in Section 1, real role-based access control (assignable, backend-enforced, per-permission) is a gap, not just a nice-to-have.

**Financial completeness.** Once Section 5's debt-payment-tracking gap is closed and Section 4's reporting engine is ported from GerainaOS, the natural next step is export to accounting formats (a CSV/Excel export merchants can hand to a bookkeeper) and expense categorization beyond the flat `category` string already in the `expenses` model design. e-Faktur/PPN was explicitly descoped in the 07-10 PRD as low-priority (most stores aren't PKP-registered) — that call still looks right; revisit only if the merchant base shifts.

**Recipe costing.** `Ingredients.jsx` supports a BOM (bill of materials) per product, but there's no dashboard showing food-cost percentage per menu item, no recipe-costing-vs-actual-usage reconciliation, and no alert when an ingredient price change silently erodes a dish's margin. This is a natural extension of data that already exists in the model.

**Marketing/promotions.** No discount-code engine, no time-based promos (happy hour pricing), no combo/bundle pricing beyond whatever's hardcoded per product. `LoyaltyPoints.jsx` and `Membership.jsx` exist for point accrual, but there's no promotional-campaign layer on top of them.

**Offline resilience.** No indication anywhere in the frontend of offline-first behavior (service worker, local queue-and-sync) — for a POS terminal in a warung/restaurant with unreliable internet, a POS that hard-fails without connectivity is a real operational risk. Worth explicitly deciding whether this is in scope, since it's a genuinely different architecture, not a small add-on.

**Audit trail.** Beyond the append-only collections that already function as logs (stock adjustments, spoilage, attendance), there's no unified activity log showing "who changed what, when" across settings, pricing, and staff changes — which would also make the privilege-escalation bug in Section 1 detectable after the fact, not just preventable.

## 8. Suggested sequencing

1. **Section 1 (all four items)** — same day fix, these are security bugs, not features. Add `require_admin` to staff mutations and settings/payments/integrations saves; randomize the default staff password; scope the webhook order match by `store_id` plus an amount check.
2. **Section 2's fake-success bugs**, using `integrations/Integrations.jsx` as the template — it already does this correctly (real differentiated success/failure messages). Prioritize `QrMenu.jsx`'s customer-facing case first.
3. **Section 3 (Dashboard + Reports fabricated data)** — port the real reporting engine from GerainaOS (`routes_reports.py`, `Expense` model) per the original PRD, then rewire both `Dashboard.jsx` and `Reports.jsx` to it. This closes Section 3 and most of Section 4 together.
4. **Printer Mode A (local/USB via `window.print()`)** — no backend work, same-day fix once picked up, per the original PRD's own prioritization.
5. **Section 5's CRUD gaps**, ranked by impact: debt/invoice payment tracking first (highest merchant-visible impact), then PO edit/cancel, then stock-transfer receiving, then KDS per-item status, then the floor/table/ingredient delete-guards.
6. **Section 6 cleanup** (pricing route, LicenseDevices, dead imports, PDF re-branding) — low effort, do opportunistically alongside the above.
7. **Section 7 items** — these are roadmap decisions, not audit findings; worth a separate prioritization conversation once 1-6 are stable, since several (delivery-platform integration, offline mode) are meaningfully larger scopes of work than anything above.

## 9. Method and limits

This was a static code read across all 15 backend route files, `models.py`, `auth.py`, `database.py`, and all 44 frontend pages plus the router/nav config — cross-checked file-by-file against the 07-10 findings rather than assuming they still held. The four highest-severity claims (staff privilege escalation, webhook cross-tenant matching, Dashboard's fabricated datasets, the missing `/app/pricing` route) were independently re-verified by direct read after the initial pass, not taken solely on the first read. No live deploy access, no running dev server, no database — so anything that only manifests at runtime (state bugs, race conditions, actual webhook payload shapes from Xendit/Midtrans/Stripe in production) is outside what this method can catch. GerainaOS and the portal Worker were referenced only for parity comparisons, not independently re-audited in this pass — the 07-10 documents remain the most recent audit of those two.
