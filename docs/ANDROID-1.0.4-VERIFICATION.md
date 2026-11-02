# DapurOS 1.0.4 verification

DapurOS 1.0.4 (build 6) adds named table reservations to the Business plan. The matching backend, website pricing and APK download are published and verified. The signed release uses the existing DapurOS identity and certificate and requires Android 14+.

In **Kasir**, select an empty table and choose **Reservasi meja**. Save the guest's name and party size, with optional contact, arrival time and notes. Staff can edit, seat or cancel the reservation. The table is held immediately, and the dining bill opens only when staff seat the guest. This is one active hold per table, without future time-slot scheduling or automatic expiry. See [Business reservations](BUSINESS-RESERVATIONS.md).

Creation and editing require the restaurant's own DapurOS Business access. Starter and Pro are blocked in the app and server. Existing bookings can still be honored or cancelled after a paid downgrade. The established trial policy and independent product subscriptions are unchanged.

| Verification | Result |
|---|---|
| Whole-app flows with real local backend | 30 passed, including 58 canonical screens |
| Backend contracts and real transactions | 249 passed (237 contracts + 12 transaction checks) |
| Socket and integrity checks | 21 passed |
| Android browser layouts | 39 passed |
| Independent browser product sessions | 16 passed |
| Additional cross-store reservation check | Passed; foreign bookings remain unchanged |
| Android unit checks | 28 passed; no lint errors |
| Exact signed APK | 33 groups across phone and two tablet profiles, including six reservation checks |
| Native companion switching | Six round trips preserve both sessions and running documents |
| Startup and missing companion recovery | Passed for both products |
| Signed upgrade from 1.0.3 | Account preferences and externally recorded pending cash sale retained |
| Packaged frontend | All 93 files verified in APK and app bundle |
| Portal routing and pricing checks | 65 passed |

APK: `DapurOS-POS-1.0.4.apk`  
Application: `com.dagangos.dapuros`  
Size: 19,211,175 bytes  
SHA-256: `30d84e4e8e37f6f29682a277b6472f8266bedf680727d3c790a0793533e34da3`  
Signing certificate SHA-256: `fced7b77d88c3477bd991d97e4a224567e775a633c2e16a280ad03991f2c914a`

Tests used disposable local databases or isolated Android fixture accounts. They included competing cashiers, lost-response retry, stale seating/cancellation, capacity and role checks, persistence, and Business/Starter/Pro access. No live customer booking, merchant charge, customer notification or customer deletion was performed. The existing erasure fence is preserved.

Android screen profiles use AOSP Android 14; physical Xiaomi/Samsung firmware, physical printer output and live payment settlement are not certified by these checks. The companion release tested is recorded in the machine-readable report, independently of later Geraina releases.

Machine-readable package, test and publication evidence: [ANDROID-1.0.4-VERIFICATION.json](ANDROID-1.0.4-VERIFICATION.json). [Deployment workflow](https://github.com/azharinoyumetv-ctrl/DagangOS/actions/runs/41476021504) passed. All six public download checks passed, including the exact downloaded bytes. Six additional checks verified the live app assets with isolated Business/Starter/Pro API fixtures at phone and desktop widths, without saving a production booking. The live backend revision, anonymous reservation rejection and both erasure fences were verified.

Download: [DapurOS 1.0.4 APK](https://dagangos.com/downloads/dapuros/DapurOS-POS-1.0.4.apk), also available on the existing [Android download page](https://dagangos.com/dapuros/android).

The final visual review also reproduced a phone website dialog heading clipped after scrolling, caused by the animated route container. The website dialog now renders outside that container. Eight affected flows and all 39 Android browser layout checks passed after this correction. The signed APK already disables the route transforms and remains the exact immutable package verified above. Separate APK and web source commits are recorded in the JSON evidence.

The corrected live website passed all six Business/Starter/Pro viewport checks, including visible dialog heading and save action after scrolling. The public download was reverified against the signed APK hash, and the deployed backend revision and both write fences passed.
