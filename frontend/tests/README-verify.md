# Verifikasi fitur DagangOS (Playwright)

Pengganti fungsional dari `/playwright-cli verify` — satu perintah untuk mengecek fitur
ekosistem lewat browser sungguhan.

## Prasyarat (sekali saja)
```
cd "D:\Fullstack Apps\DagangOS\DapurOS\frontend"
npm i -D @playwright/test
npx playwright install chromium
```

## Menjalankan
Target situs LIVE (default):
```
npx playwright test tests/verify-ecosystem.spec.js
```
Target lokal (dev server jalan di :3000):
```
set PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000
npx playwright test tests/verify-ecosystem.spec.js
```
Lihat langkah di browser (debug):
```
npx playwright test tests/verify-ecosystem.spec.js --headed --debug
```

## Yang diverifikasi (8 langkah, serial)
1. Register akun baru (login demo sudah dihapus) → dashboard.
2. Seed 1 produk + 1 order LUNAS via API terautentikasi.
3. **Laporan Produk Terjual** menampilkan data REAL (produk terjual "1 pcs"), bukan angka acak.
4. **Langganan** & **Lisensi** = dua halaman berbeda; billing menampilkan plan asli (Free Trial), tanpa data "Enterprise" palsu.
5. **Keypad numerik** tunai di Kasir (soft-check).
6. **Suite switcher**: DapurOS "Aktif", Geraina "+ Aktifkan".
7. **Aktivasi modul Geraina** (toko baru di akun yang sama) → dashboard Geraina.
8. **Batalkan/Void** order → status `voided` (stok dikembalikan).

## Catatan
- Menargetkan situs LIVE akan MEMBUAT data uji berprefix `e2e_verify_*`
  (akun, toko, produk, order). Order-nya di-void oleh langkah 8; akun/toko bisa
  dihapus lewat MongoDB bila ingin bersih total.
- Dine-in open-bill (Kirim ke Dapur → Bayar & Tutup Meja) butuh meja + menu, jadi
  diverifikasi manual atau via skenario terpisah — belum termasuk di sini agar tes tetap stabil.
- File spek lama `dapuros.spec.js` memakai login demo yang sudah dihapus, jadi tidak
  akan lulus lagi — gunakan `verify-ecosystem.spec.js`.
