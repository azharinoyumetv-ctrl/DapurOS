# DapurOS Android release verification

**DapurOS 1.0.0, build 2 is a signed, locally verified release candidate.** The matching restaurant backend, web interface and download listing are prepared locally. They have not been deployed, committed or pushed. Publish the matching backend before distributing this APK.

Verified on 29 October 2026. The starting DapurOS revision was `b5059b4`. Changes were made in the existing checkout without creating another project copy. The machine-readable evidence is [ANDROID-RELEASE-VERIFICATION.json](ANDROID-RELEASE-VERIFICATION.json); the reference-file audit is [ANDROID-PARITY-AUDIT.json](ANDROID-PARITY-AUDIT.json).

## Download and identity

- [Signed website APK](../android-app/releases/DapurOS-POS-1.0.0.apk)
- [Website Android App Bundle](../android-app/releases/DapurOS-POS-1.0.0.aab)
- [Separate Play App Bundle](../android-app/releases/play/DapurOS-POS-1.0.0.aab), prepared for review and not submitted to Google Play
- [Build and operation instructions](../android-app/README.md)

| Property | Verified value |
| --- | --- |
| Application ID | `com.dagangos.dapuros` |
| Version / Android version code | `1.0.0` / `2` |
| Minimum Android | Android 14, API 34 |
| Architectures | ARM64 and x86-64 |
| Website APK size | 19,201,066 bytes |
| Website APK SHA-256 | `42361087c60939d3f8733e3ccf3b41af6e19b9d90b57619be1a2937d11b2fc58` |
| Signing certificate SHA-256 | `fced7b77d88c3477bd991d97e4a224567e775a633c2e16a280ad03991f2c914a` |

The release has its own DapurOS signing identity, icon, package and update path. The checkout's older Android prototype used `com.example.gerainapos` and an obsolete preview address; no previously published DapurOS release or signing key was present. The new key and its password file are private, ignored files. Future signed updates must retain this key.

## Changes included

Applicable Geraina 1.2.16/build 21 foundations were adapted to DapurOS: bundled frontend for offline startup; native Back, keyboard and rotation behavior; barcode camera integration; Bluetooth Classic ESC/POS and USB OTG printer setup; account roles and staff handoff; complete paged catalogues and metadata; subscription, support and version information; and distribution-specific update behavior.

The DapurOS restaurant POS, floor/table layout, kitchen and bar tickets, QR menu interface, recipe products, ingredient inventory and spoilage remain restaurant implementations. Recipe deductions and kitchen effects now share the sale transaction. Voids restore saved ingredient quantities even after recipe edits. Table splits preserve proportional discount, service, PB1 and ingredient effects, with retries kept idempotent and unpaid splits blocking closure.

Cash takeaway can be saved on the device and replayed with the same sale identifier after connectivity returns. A successful server replay cannot duplicate the sale, counter, stock deduction or kitchen effects. Pending sales remain tied to the originating device/account. A queued recipe sale applies the recipe available when it synchronizes and records a review warning. Tables and electronic payments require connectivity.

Payment visibility follows the restaurant's settings and configured Xendit, Midtrans or DOKU merchant gateway. Bank-issued static QRIS requires staff confirmation of payment receipt. Whole-table settlement supports configured cash or confirmed bank QRIS; individual split portions settle in cash. Platform subscription purchases remain separate from merchant payment configuration. DapurOS's outlet add-on remains Rp199,000 with 8 devices and 25 staff; its existing base plan prices remain unchanged.

The QR menu's authenticated preview now sends validated table orders and displays server failures. Ingredient and floor/table reads no longer silently create demo records, and failed ingredient writes no longer report simulated success.

The website build has a DapurOS updater. The separate Play build excludes the APK installer permission and website updater, and disables web subscription purchase links while showing existing access. Play billing integration and store approval are outside the verified scope.

## Verification results

| Check | Result and scope |
| --- | --- |
| Backend contracts | **215 passed**: auth, subscriptions, payment settings/workflows, bank QRIS, support, attendance, add-ons and restaurant receipts |
| Real database/HTTP transactions | **12 passed** against a new loopback MongoDB replica database: restaurant effects, replay/idempotency, role restrictions, splits, stock restoration and related sale invariants |
| Android unit tests | **27 passed** in the release variant |
| Android lint | **0 errors, 56 warnings** |
| Frontend Playwright | **24 passed**, no failures, retries, flaky results or skips; phone and two large landscape layouts |
| Installed signed website APK | **21 check groups passed**, seven each on phone, Xiaomi-size and Samsung-size emulator profiles; installed APK hashes equal the final download APK |
| Installed signed Play APK | **7 check groups passed**, with the separate distribution identity/behavior checks |
| Signed upgrade retention | Passed from unpublished fixture 0.9.0/build 1 to 1.0.0/build 2; account, preference and actual IndexedDB pending cash sale retained |
| Back and rotation | **4 additional groups passed** on the signed website APK: draft/document retention, keyboard/dialog Back, confirmed exit and account retention after restart |
| Offline barcode decoder | Bundled EAN-13 decode passed at 0° and 90° with emulator networks disabled in a separate debug APK; release camera permission recovery and preview passed separately |
| Packaged frontend | **92 manifest entries verified** against both distributions' APK/AAB contents |
| Package integrity | Signature/certificate, private-credential exclusion and distribution checks passed; **8 native libraries** passed 16 KB ELF/ZIP alignment checks |
| Portal unit tests | **58 passed**, including existing Geraina behavior and DapurOS pricing/download routes |
| Download website Playwright | **6 passed**: 1440, 768, 393 and 320 pixel layouts, exact downloaded APK bytes/hash, and disabled download when metadata is unavailable |
| Portal production build | Passed; generated `DagangOS/dist` includes the DapurOS release assets |

The signed website APK checks covered login/password visibility, restaurant navigation, cash takeaway saved before its receipt, recipe/barcode draft retention, version/subscription/support identity, camera denial/grant recovery and native printer setup. The release WebView has debugging disabled. Test interception and fixture logic reside in a separate instrumentation APK, not in the customer APK.

Phone tests used Android 14 at 1080 × 2400 pixels/density 420. Landscape screen profiles used 2032 × 3048/density 320 and 1848 × 2960/density 240, rotated to landscape. These are AOSP emulator screen profiles, not tests on physical Xiaomi/Samsung devices or their vendor firmware.

## Evidence locations and reproduction

Raw evidence remains in the local checkout:

- `tmp/backend-contracts.xml` and `tmp/restaurant-transactions.xml`
- `tmp/browser-parity.json`
- `android-app/app/build/test-results/testReleaseUnitTest/` and `android-app/app/build/reports/lint-results-release.xml`
- `android-app/app/build/reports/final-native/{phone,xiaomi-landscape,samsung-landscape}/verification.json` with seven screenshots per profile
- `android-app/app/build/reports/final-native-play/phone/verification.json`
- `tmp/upgrade-seed.json`, `tmp/upgrade-retention.json` and `tmp/back-rotation-final.json`
- `tmp/offline-barcode-decoder-debug.log`, `tmp/package-website-final.log` and `tmp/package-play-final.log`
- `tmp/portal-unit.log` and `tmp/portal-build.log`
- Parent portal: `tmp/dapuros-android-website/verification.json` and responsive page screenshots

The build/test entry points are described in the Android README. `android-app/scripts/record-release.cjs` validates the final evidence and writes the machine-readable report. The portal's `scripts/stage-dapuros-android.mjs` refuses to replace versioned APK bytes with a different checksum. The published-release guard requires later version codes to increase; do not replace this immutable version with rebuilt bytes.

## Limits and publication status

**The matching backend and portal have not been deployed.** DapurOS now follows Geraina's existing public-site structure: an Android navigation link and platform section on `/dapuros` lead to `/dapuros/android`, where download buttons use the signed release under `/downloads/dapuros/`. The Android page uses the Geraina layout adapted to DapurOS branding, restaurant copy and screenshots. The original DapurOS homepage hero remains intact. The portal deployment checks out product repositories from their published branches, so the matching DapurOS backend/frontend must land before the portal/download release. Publishing is awaiting explicit approval after automatic approval review rejected the attempted live publication.

The pre-existing public guest URL `/dapuros/qr-order` has no verified unauthenticated ordering service. This release verifies authenticated QR menu preview orders; it does not certify public guest self-ordering.

Physical printer paper output, optical scanning on real cameras, live merchant settlement, email/support message delivery and Google Play acceptance were not performed. Printer setup and generated ESC/POS/PDF receipts were tested without sending a physical print job. The first release's upgrade test uses Android's signed install-over mechanism; a website update from a prior publicly distributed DapurOS APK cannot be claimed because no such baseline was present.

No real payment, email, customer erasure or production data write was used. The published account-erasure write fence and database adapter were retained unchanged. Geraina's existing unrelated changes and public APK were preserved.

Intermediate harness issues were repaired before the final checks: an incomplete recipe fixture, an asset-generation/browser overlap and release optimization of decoder runtime classes. The direct decoder assertion therefore uses a debug bench with the same pinned bundled ML Kit version; the release's camera path is tested separately. The MongoDB fixture logs `ECONNRESET` during shutdown after passing tests; pytest exits successfully and its disposable databases are removed.
