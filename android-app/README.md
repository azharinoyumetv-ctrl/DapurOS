# DapurOS Android 1.0.2 (build 4)

This release opens the installed companion app, keeps product sessions independent, and offers retry when cold-start session validation is unavailable. See `../docs/ANDROID-1.0.2-VERIFICATION.md`. It preserves the 1.0.1 theme, paid-only upgrade and product entitlement corrections. Old unstamped sessions require online revalidation once; a failed check keeps the token saved without granting unverified access.

The release uses `com.dagangos.dapuros`, Android 14/API 34 or newer, and ARM64/x86-64. Its signing identity is pinned in `release-identity.json` and is distinct from Geraina. The older prototype used `com.example.gerainapos` and an obsolete preview URL; no published DapurOS Android release or signing key was present in this checkout.

Customer APK: `releases/DapurOS-POS-1.0.2.apk`. Website and Play packages use separate native update/purchase behavior. Only the website APK has the APK installer permission and its own `/downloads/dapuros/latest.json` updater. The historical 1.0.0 Play candidate is unpublished; this correction releases the website distribution. The Play source consumes existing entitlements and disables web subscription purchase links. No Play submission or approval is implied.

## Build and verify

Use the installed JDK 17, Android SDK and frontend dependencies. Run `scripts/Build-Release.ps1 -VersionCode 4 -VersionName 1.0.2 -Distribution website`. The script builds the actual DapurOS frontend into the APK, runs release unit tests/lint, builds the APK/AAB and separate instrumentation test APK, checks distribution permissions/code, signature, credentials and 16 KB native alignment. Use `-Distribution play` for the Play package. Later published versions require a higher version code; versioned public APK bytes must never be replaced.

`scripts/Verify-InstalledRelease.ps1` runs the exact signed website APK on an isolated emulator with phone, Xiaomi Pad 6S Pro-size and Samsung Ultra-size layouts. It compares the installed `base.apk` checksum with the release file before recording a pass. Its fixture transport lives only in the separately signed test APK; WebView debugging remains disabled in the customer release. Instrumentation and fixtures are never website assets.

Browser checks: `node frontend/node_modules/@playwright/test/cli.js test --config frontend/playwright.android-local.config.js` from the DapurOS root. The tests run the built frontend with blocked external traffic. `scripts/verify-restaurant-backend.cjs` runs real HTTP/transaction checks on a fresh, loopback-only MongoDB replica database and removes its disposable databases. The existing shared development Python/runtime is reused without copying the project.

## Restaurant behavior

The restaurant POS, floors/tables, kitchen/bar tickets, recipes, ingredients, spoilage and QR menu interface remain DapurOS implementations. Online checkout and offline replay deduct recipes and create kitchen tickets in the same transaction as the sale/counter. Voids restore the recorded recipe quantities even after a recipe edit. Splits retain their share of discounts, service/PB1 and ingredient deductions; retries keep one split, and unpaid splits block table closure.

Offline operation is for cash takeaway after the catalogue has been prepared online. Tables, recipe edits, spoilage and electronic payments require connectivity. A queued recipe sale applies the server recipe at synchronization and records an explicit `recipe_applied_at_sync` warning for review. Pending sales remain on the originating device/account until synchronization succeeds. Uninstalling or clearing app data can remove unsynchronized sales.

Payment settings select cashier visibility and each method's configured merchant gateway: Xendit, Midtrans or DOKU. They are separate from DagangOS subscription billing. Bank-issued static QRIS is configured in Integration and requires staff confirmation of receipt. Whole-table settlement supports configured cash or manually checked bank QRIS; separate split portions settle in cash. Unconfigured electronic methods are not enabled.

The authenticated QR menu preview now submits real, validated table orders and reports failures instead of simulated success. The pre-existing public guest URL `/dapuros/qr-order` has no verified unauthenticated ordering service; public guest self-ordering is not certified by this release.

## Release and operational limits

The full report is `../docs/ANDROID-1.0.1-VERIFICATION.json`, with a readable companion in `../docs/ANDROID-1.0.1-VERIFICATION.md`. Tests use isolated records/transports: no customer erasure, real payment, settlement, email/support delivery or physical printing was performed. Screen profiles run on AOSP emulators, not HyperOS/One UI. Native barcode decoding and permission recovery do not certify every physical camera/printer model.

The published account-closure write fence and database adapter were retained unchanged. See the existing shared-identity account-erasure runbook/evidence in GerainaOS; this release does not repeat or undo that work.

The matching DapurOS backend and portal/frontend/download changes are published. Open https://dagangos.com/dapuros and choose Android, or use https://dagangos.com/dapuros/android. The live download matches the exact signed APK checksum; publication evidence is in `../docs/ANDROID-PUBLICATION.json`. Future releases must deploy their matching backend before the portal because the portal build checks out product repositories from their published branches. Geraina's APK, signing key, customer state and unrelated working changes are preserved.

`signing/` and `keystore.properties` are private and ignored. Back them up securely; future updates must retain this key. Do not publish them, the test APK, test account settings or mapping files.
