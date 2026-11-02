# DapurOS 1.0.5 verification

DapurOS 1.0.5 (build 7) ports the saved category dropdown, gallery/direct-camera capture and saved unit dropdown from the listed Geraina implementations into DapurOS's restaurant product editor. The APK/AAB use DapurOS's existing package and signing key. The matching website and APK download are published and live-verified.

Categories include unused saved records and legacy product values. Units display full name and symbol and save the symbol, with existing custom/full-name strings preserved. Both support explicit custom input, paging, refresh and failure/retry without clearing the draft. Starter owners can select product units independently of Pro ingredient controls.

Photo selection supports replacement/retake, denial and cancellation recovery, processing feedback and the existing resized JPEG contract. Android image selection uses its system photo picker; capture opens its camera. CSV/Excel retains DocumentsUI. A separate private FileProvider owns only generated camera captures, which are released after reading or cancellation and pruned after abandonment. No broad storage/photo permission was added.

DapurOS's recipe quantities, ingredient creation, stock checks, named Business reservations, kitchen, amber branding and independent product sessions are preserved. The remaining 420 ms full-screen route animation was removed. See the focused [comparison and port notes](GERAINA-PORT-1.0.5.md).

| DapurOS verification | Result |
|---|---|
| Product-editor browser cases against real local API/MongoDB | 54 passed across phone and two tablet sizes |
| Restaurant regression flows | 30 passed, covering 58 canonical screens |
| Backend contracts and real transactions | 249 passed (237 + 12) |
| Socket/integrity regression | 21 passed |
| Android browser layouts | 39 passed |
| Browser companion sessions | 16 passed |
| Android unit tests | 33 passed; no release lint errors |
| Exact signed APK core, theme and reservation groups | 33 passed across three screen profiles |
| Actual Android picker/camera and document import | 10 passed, including denial, cancellation, capture/save/reopen and empty capture cache |
| Installed category/unit choices | Five checks per profile on phone and two tablet profiles; phone used the actual native popup |
| Signed upgrade from 1.0.4 | Recorded pending cash sale, login and preference retained |
| Native companion sessions | Six round trips passed with Geraina 1.2.20, plus startup/missing-app recovery |
| Bundled frontend integrity | All 93 files verified in APK and AAB |
| Portal checks | 65 passed |

Package: `com.dagangos.dapuros`\
Minimum Android: 14/API 34; ABIs: ARM64 and x86-64\
APK size: 19,230,163 bytes\
APK SHA-256: `06a7679606905340039d17be6404f55f8e3a0ff466e38ebc38cc2efa00944f64`\
Signing certificate SHA-256: `fced7b77d88c3477bd991d97e4a224567e775a633c2e16a280ad03991f2c914a`

These are DapurOS test results. Geraina's passing results were not counted as DapurOS verification. Tests used disposable local data or owned emulator fixtures. Production customer writes, real merchant charges, provider messages and customer erasure were not used. The existing erasure fence is preserved.

The native camera is AOSP's real camera application on an emulator with a virtual camera. Phone/tablet profiles do not certify physical vendor camera firmware, printer output or merchant settlement. Google Play submission/declarations/approval remain separate. Inspection is enabled through a test-only APK on the owned emulator; production WebView debugging remains disabled.

Machine-readable package, source and publication evidence: [ANDROID-1.0.5-VERIFICATION.json](ANDROID-1.0.5-VERIFICATION.json).

Download: [DapurOS 1.0.5 APK](https://dagangos.com/downloads/dapuros/DapurOS-POS-1.0.5.apk), also on the existing [Android download page](https://dagangos.com/dapuros/android). [Deployment workflow](https://github.com/azharinoyumetv-ctrl/DagangOS/actions/runs/41483886303) passed.

All six live download checks passed, including exact downloaded bytes and metadata-outage recovery. Six live product-editor cases checked the deployed assets with explicit API fixtures for Starter and Business across phone and two tablet widths; no product was saved on production. Six live reservation/pricing regressions also passed. The deployed backend revision, authenticated registry boundaries, absence of fixture routes and both erasure fences were verified.
