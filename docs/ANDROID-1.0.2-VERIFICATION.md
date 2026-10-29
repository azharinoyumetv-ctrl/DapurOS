# DapurOS 1.0.2: companion switching and session recovery

Status: published and verified on the live website. [Download 1.0.2](https://dagangos.com/downloads/dapuros/DapurOS-POS-1.0.2.apk). Package com.dagangos.dapuros, build 4, Android 14 or newer.

- Open the installed companion app through its fixed Android package; no credential or entitlement handoff.
- Do not infer companion activation from an incomplete or cached store list.
- Keep product sessions independent during sign-in, sign-out and token expiry.
- Retry failed cold-start validation without discarding the saved token or granting unverified product access.

## Verification

- Exact signed APK: both app-switch directions on phone, Xiaomi-sized landscape and Samsung-sized landscape profiles; each app retains its account, tier and document.
- Missing companion: explicit download, browser and cancel choices.
- Cold-start validation failure: saved token retained, unverified access blocked, retry validates this product.
- Browser: 16 shared-session regression cases; 33 restaurant UI cases, 237 backend contracts, 12 MongoDB transaction assertions.
- 28 Android unit tests; release lint, unchanged signing certificate, APK/AAB structure, native alignment, bundled assets and private-credential exclusion verified.
- Existing erasure write fence unchanged: b24297360d8862948a165252c0a18fa3726df8ef26a81245001b67524700d8e1.

APK SHA-256: 5de138329347cb420103ff4abe198ab6a5538512350de9868e1f64d7c4d1f8d5

## Limits

- Actual customer-account Geraina logout was not reproduced.
- Tablet layouts use AOSP emulator profiles, not physical Xiaomi or Samsung firmware.
- No real payment, email, physical printer or customer erasure was performed.
- MongoDB fixture shutdown printed a connection-reset diagnostic after all 12 transaction assertions passed.

Machine-readable results: [ANDROID-1.0.2-VERIFICATION.json](ANDROID-1.0.2-VERIFICATION.json).
