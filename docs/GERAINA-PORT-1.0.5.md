# DapurOS 1.0.5 product editor port

Source baseline: DapurOS `161b1328158c0a9ea2c913e490b4150cbaf1c050` (published 1.0.4/build 6). Geraina implementations were compared from `321392c` (categories), `87c410d` (gallery/camera) and `b7fad97` (units). Geraina's verification is reference evidence; all DapurOS results are recorded separately in [Android 1.0.5 verification](ANDROID-1.0.5-VERIFICATION.json).

The product form keeps DapurOS's recipe/BOM controls, ingredient creation, recipe quantities, optimistic stock check and amber styling. Saved and unused categories are combined with legacy product names. Product units show name and symbol, save the symbol and retain older free-text values. Both dropdowns allow custom entries, refresh on opening, read all registry pages, and show recoverable failures without clearing the draft. Product units load independently of Pro ingredient access; opening the ordinary product list does not request them.

The photo actions allow gallery selection, direct camera capture and replacement. Cancellation, denied camera permission and invalid images preserve existing data. Processing blocks premature save. The existing JPEG contract remains maximum dimension 320 pixels at quality 0.72. Desktop file selection and CSV/Excel document picking are retained.

Android uses `PickVisualMedia` and `TakePicture`, with a separate non-exported `${applicationId}.productphotos` provider restricted to `cache/product-photos/`. Completed reads, cancelled captures and abandoned expired files release only owned camera captures. Gallery originals are never deleted. The updater's separate `.updates` provider and website/Play controls are preserved. No broad storage/photo permission was added. Privileged bridge activation checks remain; only the generated-capture release callback accepts asynchronous FileReader completion.

The form renders outside the animated route container so phone scrolling does not clip it. The remaining 420 ms whole-screen transition was removed, matching Geraina's earlier performance fix.

## Earlier shared changes compared

| Area | Existing DapurOS behavior and decision |
|---|---|
| Catalogue loading | Complete paginated catalogue and record readers already exist; retained instead of replacing them with Geraina's list loader. |
| Startup and recovery | Critical screens are imported at startup; secondary screens use the existing deferred loader with retry. Retained. |
| Screen transition | The 420 ms route animation remained; removed in this port. |
| Subscriptions | Existing product-scoped entitlements, compact tier notice, paid purchase choices and website/Play controls retained. No new trial or billing model. |
| Sessions and companion launch | Existing scoped credentials, fixed counterpart package and failed-validation recovery retained. |
| Payments and support | Existing cashier-method/integration separation and authenticated support Reply-To/idempotency flows retained. No merchant credential or provider changes. |
| Restaurant operations | No production backend changes to recipes, ingredients, stock, reservations, kitchen, modifiers or table billing. |
| Erasure | Existing transactional fence retained, including normalized fingerprint `b24297360d8862948a165252c0a18fa3726df8ef26a81245001b67524700d8e1`. |
| Identity | DapurOS package `com.dagangos.dapuros`, namespace/bridge/storage names, updater and certificate retained. Geraina release identifiers and credentials were not copied. |

## Verification scope

Ported category/photo/unit journeys use DapurOS's actual built frontend and real handlers with a disposable loopback MongoDB replica. Added DapurOS cases check Starter unit access without ingredient requests, recipe preservation, desktop file selection, and late responses after changing accounts. Pagination fixtures explicitly cover records beyond the first 500 and duplicate symbols.

The separate Android test APK can enable inspection only on the owned emulator. It does not change the signed production APK or enable production WebView debugging. Native checks use actual AOSP system picker/camera controls, saved/reopened products, generated-capture cleanup and a real signed upgrade. Recorded hashes identify the exact package tested. No production customer writes, real merchant charge or provider message is used for verification.

Physical camera/vendor firmware, printer paper output, merchant settlement and Google Play approval require their own external evidence. Publication and the final DapurOS results are recorded in the release report; this document does not turn Geraina's results into DapurOS results.
