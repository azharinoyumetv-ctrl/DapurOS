# Verifikasi E2E DapurOS (Playwright)

Suite ini memverifikasi fitur-fitur PRD: login SSO + demo 1-klik, denah meja multi-lantai,
BOM + Spoilage Log, KDS, Menu QR, Simulator EDC, WebSocket real-time, dan crash-proof rendering.

## Menjalankan

1. Jalankan MongoDB lokal, lalu backend:
   `cd backend && uvicorn server:app --port 8000`
2. Build & sajikan frontend di port 3000 (mis. `npx serve -s build -l 3000`).
3. Jalankan suite:
   `node tests/e2e/dapuros-prd-suite.mjs`

Variabel lingkungan opsional: `BASE_URL`, `API_URL`, `PW_CHROME` (path chromium kustom).
Playwright: `npx playwright install chromium` terlebih dahulu.
