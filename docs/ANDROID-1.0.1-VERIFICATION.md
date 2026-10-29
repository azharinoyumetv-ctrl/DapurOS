# DapurOS 1.0.1 — theme and subscription isolation correction

Version **1.0.1 / build 3 is published** and corrects the issues missed in 1.0.0. [Download the signed APK](https://dagangos.com/downloads/dapuros/DapurOS-POS-1.0.1.apk) or open the existing [Android download page](https://dagangos.com/dapuros/android). It keeps DapurOS's application ID and signing certificate, so it installs over the existing app.

The original release retained Geraina's hardcoded green native presentation while DapurOS used an orange/brown brand. It also left a free-trial card in the public pricing page reached by the app's upgrade link. Backend subscription lookup already separated paid subscription records, but its legacy fallback reused the shared account's global plan and trial expiry when a product had no paid record. Unlabelled legacy stores could also resolve as either product. Those fallbacks caused the cross-product access risk reproduced by the new tests.

## Corrections

- DapurOS now uses its own colors for native controls, system bar background, forms, navigation and billing UI while retaining Geraina's mobile layouts and recovery behavior.
- Trial users upgrading see only **Starter, Pro and Business**. DapurOS retains its own prices and restaurant capacities. The authenticated pricing navigation no longer offers another trial registration.
- Shared credentials remain valid, but each product resolves its own subscription, paid expiry and store. A new product's trial starts once on activation. Existing product trials use that product's stored expiry or original activation date rather than another product's account-level date.
- Expiry checks do not overwrite the shared account's global plan. The legacy upgrade endpoint cannot reset a trial or rewrite shared entitlements.
- An unlabelled store needs a verified primary-product binding. Ambiguous records fail closed for product verification; no customer records are automatically rewritten to guess ownership.
- Cached account details are reused only for their verified product. Old unstamped sessions require online revalidation once after the update. Pending cash sales remain in IndexedDB.

## Verified results

| Verification | Result |
| --- | --- |
| DapurOS backend contracts, including cross-product cases | 237 passed |
| Isolation cases against Geraina's actual backend source | 22 passed |
| Real MongoDB restaurant transaction checks | 12 passed |
| Browser checks across phone and two tablet layouts | 33 passed, no failures or flaky results |
| Android release unit tests | 27 passed |
| Signed APK on phone and both tablet profiles | 21 core groups plus 6 theme/trial-upgrade groups passed |
| Packaged frontend | 92 manifest entries verified in APK and AAB |
| Signing and package checks | Pinned DapurOS certificate, private-credential exclusion and 16 KB native alignment passed |
| Pending-sale retention | Receipt `OFF-86F13D299EAD44CD`, created in released 1.0.0, remains pending with its exact UUID, store and Rp11,000 total in the final signed update |

See [machine-readable verification](ANDROID-1.0.1-VERIFICATION.json) for exact checksums, native evidence and publication status. Device screenshots are in `android-app/app/build/reports/1.0.1-native/`; browser results are in `tmp/1.0.1-browser.json`.

Both matching backends deployed successfully before the portal. [The website deployment](https://github.com/azharinoyumetv-ctrl/DagangOS/actions/runs/40866733794) passed deployment, zone audit and public accessibility checks. Six live download checks passed, including downloading the exact signed bytes, and 58 portal unit tests passed. Four additional checks used the live pricing assets with isolated trial API responses to verify each product's own prices, three paid plans and absence of a second trial action on phone and desktop. No live customer account or payment was used for those UI checks. Both live backends remain healthy with the original erasure write fence enabled.

The tests use isolated accounts, databases and transports. No real charge, email, customer erasure or physical print was performed. Phone/tablet sizes are AOSP emulator profiles rather than vendor hardware. The published account-erasure guard and database adapter remain unchanged. The pre-existing public guest QR ordering service is outside this correction.

The upgrade test originally relied on a missing localStorage test marker. Inspection confirmed the cash records survived; the final check matches the actual receipt from the pre-upgrade screenshot to the exact UUID and amount in the final app's IndexedDB. Native test timing and frame-capture issues were repaired without substituting failed or earlier-candidate results for the final installed APK checksum.
