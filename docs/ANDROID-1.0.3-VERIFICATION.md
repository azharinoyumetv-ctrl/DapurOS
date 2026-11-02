# DapurOS 1.0.3 verification

DapurOS 1.0.3 (build 5) is signed with the existing DapurOS certificate and verified for Android 14+. The matching backend, website and APK download are published and verified.

The demo sweep removed the duplicate QR order preview, unused sample database/catalogue, fake payment responses, unsigned simulated webhooks and the manual gateway-payment override. QR setup now manages actual table links and prints/downloads the enabled QR. Orders use the real guest page or cashier.

| Verification | Result |
|---|---|
| Real-backend browser flows | 23 passed, including all 58 canonical screens |
| Backend contracts and real transaction checks | 249 passed (237 contracts + 12 transaction checks) |
| Real ASGI socket and integrity checks | 21 passed, including disabled legacy demo flags |
| Android browser layouts | 33 passed across phone and two tablet sizes |
| Independent product sessions in browser | 16 passed |
| Android unit checks | 28 passed; no lint errors |
| Exact signed APK on Android | 27 groups passed across three screen profiles |
| Native companion switching | Six round trips passed, with both sessions and tiers retained |
| Startup failure and missing companion | Both products passed recovery and explicit fallback choices |
| Upgrade retention | Recorded pending cash receipt from 1.0.2 retained in the final APK |
| Bundled frontend integrity | All 93 files verified in APK and app bundle |
| Portal routing and download metadata | 65 checks passed |

Download: [DapurOS 1.0.3 APK](https://dagangos.com/downloads/dapuros/DapurOS-POS-1.0.3.apk). The existing [Android download page](https://dagangos.com/dapuros/android) serves the same verified file.

All six live download-page checks passed at 1440, 768, 393 and 320 pixels, including exact downloaded bytes and unavailable-metadata recovery. The published guest page rejects invalid QR codes without requesting an operator session; the live operator assets show the cleaned QR setup. [Deployment workflow](https://github.com/azharinoyumetv-ctrl/DagangOS/actions/runs/41430962775) passed.

Application: `com.dagangos.dapuros`  
APK size: 19,208,999 bytes  
APK SHA-256: `6651e3761b720c9caee4b94ca3f040e15749a5e3894ad9426ef50ab127a2d67a`  
Signing certificate SHA-256: `fced7b77d88c3477bd991d97e4a224567e775a633c2e16a280ad03991f2c914a`

Geraina 1.2.17 and its release bytes are unchanged. The erasure fence remains enabled and byte-equivalent to the prior implementation. Tests used disposable local databases or isolated emulator fixture accounts; no live merchant charge, provider message/email or customer deletion was performed.

Screen profiles use AOSP Android 14 and do not certify physical Xiaomi/Samsung firmware. Physical printer output and live payment settlement still require real hardware/provider verification. Legacy sales without saved costs are reported as unknown, and old stock movements are not fabricated.

Machine-readable evidence: [ANDROID-1.0.3-VERIFICATION.json](ANDROID-1.0.3-VERIFICATION.json). Reproduced gaps and fixes: [FULL-E2E-GAPS.md](FULL-E2E-GAPS.md).
