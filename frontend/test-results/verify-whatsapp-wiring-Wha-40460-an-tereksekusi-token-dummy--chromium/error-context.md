# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verify-whatsapp-wiring.spec.js >> WhatsApp engine — wiring aman & tereksekusi (token dummy)
- Location: tests\verify-whatsapp-wiring.spec.js:13:1

# Error details

```
Error: respons PO memuat hasil whatsapp (engine tereksekusi)

expect(received).toBeTruthy()

Received: undefined
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - link "DapurOS" [ref=e7] [cursor=pointer]:
            - /url: /dapuros/app/dashboard
            - img [ref=e8]
            - text: DapurOS
          - button "Suite" [ref=e11] [cursor=pointer]:
            - generic [ref=e13]: Suite
            - img [ref=e14]
        - paragraph [ref=e16]: E2E WA 1783180165450
      - navigation [ref=e17]:
        - link "Dasbor" [ref=e18] [cursor=pointer]:
          - /url: /dapuros/app/dashboard
          - img [ref=e19]
          - text: Dasbor
        - link "Kasir" [ref=e24] [cursor=pointer]:
          - /url: /dapuros/app/pos
          - img [ref=e25]
          - text: Kasir
        - link "Layar Dapur (KDS)" [ref=e29] [cursor=pointer]:
          - /url: /dapuros/app/kds
          - img [ref=e30]
          - text: Layar Dapur (KDS)
        - link "Menu QR Code" [ref=e32] [cursor=pointer]:
          - /url: /dapuros/app/qr-menu
          - img [ref=e33]
          - text: Menu QR Code
        - button "Produk" [ref=e40] [cursor=pointer]:
          - generic [ref=e41]:
            - img [ref=e42]
            - generic [ref=e46]: Produk
          - img [ref=e47]
        - button "Inventaris" [ref=e50] [cursor=pointer]:
          - generic [ref=e51]:
            - img [ref=e52]
            - generic [ref=e55]: Inventaris
          - img [ref=e56]
        - button "Pembelian" [ref=e59] [cursor=pointer]:
          - generic [ref=e60]:
            - img [ref=e61]
            - generic [ref=e64]: Pembelian
          - img [ref=e65]
        - link "Pemasok" [ref=e67] [cursor=pointer]:
          - /url: /dapuros/app/suppliers
          - img [ref=e68]
          - text: Pemasok
        - button "Pelanggan" [ref=e74] [cursor=pointer]:
          - generic [ref=e75]:
            - img [ref=e76]
            - generic [ref=e81]: Pelanggan
          - img [ref=e82]
        - button "Hutang Piutang" [ref=e85] [cursor=pointer]:
          - generic [ref=e86]:
            - img [ref=e87]
            - generic [ref=e89]: Hutang Piutang
          - img [ref=e90]
        - button "Pembayaran" [ref=e93] [cursor=pointer]:
          - generic [ref=e94]:
            - img [ref=e95]
            - generic [ref=e97]: Pembayaran
          - img [ref=e98]
        - button "Laporan" [ref=e101] [cursor=pointer]:
          - generic [ref=e102]:
            - img [ref=e103]
            - generic [ref=e105]: Laporan
          - img [ref=e106]
        - button "Staf & Karyawan" [ref=e109] [cursor=pointer]:
          - generic [ref=e110]:
            - img [ref=e111]
            - generic [ref=e115]: Staf & Karyawan
          - img [ref=e116]
        - link "Cabang" [ref=e118] [cursor=pointer]:
          - /url: /dapuros/app/branches
          - img [ref=e119]
          - text: Cabang
        - button "Integrasi" [ref=e124] [cursor=pointer]:
          - generic [ref=e125]:
            - img [ref=e126]
            - generic [ref=e129]: Integrasi
          - img [ref=e130]
        - button "Pengaturan" [ref=e133] [cursor=pointer]:
          - generic [ref=e134]:
            - img [ref=e135]
            - generic [ref=e138]: Pengaturan
          - img [ref=e139]
        - link "Tentang" [ref=e141] [cursor=pointer]:
          - /url: /dapuros/app/about
          - img [ref=e142]
          - text: Tentang
      - generic [ref=e144]:
        - generic [ref=e145]:
          - img [ref=e146]
          - paragraph [ref=e148]: Trial Aktif
        - paragraph [ref=e149]: 14 hari
        - paragraph [ref=e150]: tersisa
        - link "Upgrade Sekarang" [ref=e151] [cursor=pointer]:
          - /url: /dapuros/pricing
          - img [ref=e152]
          - text: Upgrade Sekarang
      - generic [ref=e154]:
        - generic [ref=e155]:
          - generic [ref=e156]:
            - paragraph [ref=e157]: Role Saat Ini
            - generic [ref=e158]: Owner
          - combobox [ref=e159] [cursor=pointer]:
            - option "Owner" [selected]
            - option "Manager"
            - option "Cashier"
            - option "Warehouse"
        - generic [ref=e160]:
          - paragraph [ref=e162]: e2e.wa.1783180165450@gmail.com
          - button "Keluar" [ref=e163] [cursor=pointer]:
            - img [ref=e164]
    - main [ref=e167]:
      - generic [ref=e168]:
        - generic [ref=e169]:
          - generic [ref=e170]:
            - text: POS Komersial & Restoran
            - 'heading "Dasbor: E2E WA 1783180165450." [level=1] [ref=e171]'
          - generic [ref=e172]:
            - generic [ref=e173]:
              - img [ref=e174]
              - text: "Peran: Owner"
            - link "Buka Kasir" [ref=e177] [cursor=pointer]:
              - /url: /dapuros/app/pos
              - img [ref=e178]
              - text: Buka Kasir
            - link "Layar Dapur (KDS)" [ref=e182] [cursor=pointer]:
              - /url: /dapuros/app/kds
              - img [ref=e183]
              - text: Layar Dapur (KDS)
            - link "Menu QR Code" [ref=e185] [cursor=pointer]:
              - /url: /dapuros/app/qr-menu
              - img [ref=e186]
              - text: Menu QR Code
        - generic [ref=e192]:
          - generic [ref=e193]:
            - generic [ref=e194]:
              - img [ref=e195]
              - text: Mode Uji Coba (Trial)
            - heading "14 hari tersisa di trial — upgrade untuk mengunci semua fitur." [level=2] [ref=e197]
            - paragraph [ref=e198]: Pilih paket Starter / Pro / Business sebelum trial berakhir agar operasional restoran tidak terputus.
          - link "Upgrade Paket" [ref=e199] [cursor=pointer]:
            - /url: /dapuros/app/pricing
            - img [ref=e200]
            - text: Upgrade Paket
        - generic [ref=e202]:
          - generic [ref=e203]:
            - generic [ref=e204]:
              - generic [ref=e205]: Pendapatan Hari Ini
              - img [ref=e207]
            - generic [ref=e210]:
              - paragraph [ref=e211]: Rp 0
              - paragraph [ref=e212]: 0 transaksi hari ini
          - generic [ref=e213]:
            - generic [ref=e214]:
              - generic [ref=e215]: Keuntungan Hari Ini
              - img [ref=e217]
            - generic [ref=e221]:
              - paragraph [ref=e222]: Rp 0
              - paragraph [ref=e223]: Est. Margin Kotor 40%
          - generic [ref=e224]:
            - generic [ref=e225]:
              - generic [ref=e226]: Transaksi Hari Ini
              - img [ref=e228]
            - generic [ref=e232]:
              - paragraph [ref=e233]: "0"
              - paragraph [ref=e234]: Total transaksi sukses
          - generic [ref=e235]:
            - generic [ref=e236]:
              - generic [ref=e237]: Rata-rata Keranjang
              - img [ref=e239]
            - generic [ref=e241]:
              - paragraph [ref=e242]: Rp 0
              - paragraph [ref=e243]: Rata-rata belanja
          - generic [ref=e244]:
            - generic [ref=e245]:
              - generic [ref=e246]: Posisi Kas
              - img [ref=e248]
            - generic [ref=e250]:
              - paragraph [ref=e251]: Rp 500.000
              - paragraph [ref=e252]: Kas dalam laci kasir
        - generic [ref=e253]:
          - generic [ref=e254]:
            - heading "Tren Grafik Penjualan Mingguan" [level=3] [ref=e255]
            - application [ref=e259]:
              - generic [ref=e269]:
                - generic [ref=e270]:
                  - generic [ref=e272]: Senin
                  - generic [ref=e274]: Selasa
                  - generic [ref=e276]: Rabu
                  - generic [ref=e278]: Kamis
                  - generic [ref=e280]: Jumat
                  - generic [ref=e282]: Sabtu
                  - generic [ref=e284]: Minggu
                - generic [ref=e285]:
                  - generic [ref=e287]: "0"
                  - generic [ref=e289]: 15k
                  - generic [ref=e291]: 30k
                  - generic [ref=e293]: 45k
                  - generic [ref=e295]: 60k
          - generic [ref=e296]:
            - heading "Metode Pembayaran (%)" [level=3] [ref=e297]
            - generic [ref=e300]:
              - list [ref=e302]:
                - listitem [ref=e303]:
                  - img "[object Object] legend icon" [ref=e304]
                  - generic [ref=e306]: Bank VA
                - listitem [ref=e307]:
                  - img "[object Object] legend icon" [ref=e308]
                  - generic [ref=e310]: Cash
                - listitem [ref=e311]:
                  - img "[object Object] legend icon" [ref=e312]
                  - generic [ref=e314]: E-Wallet
                - listitem [ref=e315]:
                  - img "[object Object] legend icon" [ref=e316]
                  - generic [ref=e318]: QRIS
              - application [ref=e319]
          - generic [ref=e331]:
            - heading "Top 5 Produk Terlaris" [level=3] [ref=e332]
            - table [ref=e334]:
              - rowgroup [ref=e335]:
                - row "Nama Produk Stok Fisik Harga Jual" [ref=e336]:
                  - columnheader "Nama Produk" [ref=e337]
                  - columnheader "Stok Fisik" [ref=e338]
                  - columnheader "Harga Jual" [ref=e339]
              - rowgroup
          - generic [ref=e340]:
            - generic [ref=e341]:
              - heading "Transaksi POS Terbaru" [level=3] [ref=e342]
              - link "Semua →" [ref=e343] [cursor=pointer]:
                - /url: /dapuros/app/sales
            - table [ref=e345]:
              - rowgroup [ref=e346]:
                - row "No. Pesanan Bayar Via Total" [ref=e347]:
                  - columnheader "No. Pesanan" [ref=e348]
                  - columnheader "Bayar Via" [ref=e349]
                  - columnheader "Total" [ref=e350]
              - rowgroup
          - generic [ref=e351]:
            - heading "Peringatan Stok Menipis" [level=3] [ref=e352]:
              - img [ref=e353]
              - text: Peringatan Stok Menipis
            - paragraph [ref=e356]: Semua stok aman dan mencukupi.
            - link "Kelola Stok Menipis (0)" [ref=e357] [cursor=pointer]:
              - /url: /dapuros/app/inventory/low-stock
          - generic [ref=e358]:
            - heading "Nilai Aset Persediaan" [level=3] [ref=e359]
            - generic [ref=e360]:
              - text: Total Nilai Persediaan (Harga Pokok)
              - paragraph [ref=e361]: Rp 0
              - paragraph [ref=e362]: Berdasarkan akumulasi harga pokok beli.
            - link "Detail Aset Persediaan" [ref=e363] [cursor=pointer]:
              - /url: /dapuros/app/inventory/valuation
          - generic [ref=e364]:
            - heading "Arus Kas Ringkas" [level=3] [ref=e365]
            - application [ref=e369]:
              - generic [ref=e403]:
                - generic [ref=e404]:
                  - generic [ref=e406]: Minggu 1
                  - generic [ref=e408]: Minggu 2
                  - generic [ref=e410]: Minggu 3
                  - generic [ref=e412]: Minggu 4
                - generic [ref=e413]:
                  - generic [ref=e415]: 0.0j
                  - generic [ref=e417]: 1.5j
                  - generic [ref=e419]: 3.0j
                  - generic [ref=e421]: 4.5j
                  - generic [ref=e423]: 6.0j
          - generic [ref=e424]:
            - heading "Hutang Piutang Dagang" [level=3] [ref=e425]:
              - img [ref=e426]
              - text: Hutang Piutang Dagang
            - generic [ref=e428]:
              - generic [ref=e429]:
                - generic [ref=e430]:
                  - text: Total Piutang
                  - paragraph [ref=e431]: Rp 0
                - link "Kelola" [ref=e432] [cursor=pointer]:
                  - /url: /dapuros/app/debt/receivable
              - generic [ref=e433]:
                - generic [ref=e434]:
                  - text: Total Utang
                  - paragraph [ref=e435]: Rp 0
                - link "Kelola" [ref=e436] [cursor=pointer]:
                  - /url: /dapuros/app/debt/payable
          - generic [ref=e437]:
            - heading "Keaktifan & Shift Staf" [level=3] [ref=e438]:
              - img [ref=e439]
              - text: Keaktifan & Shift Staf
            - paragraph [ref=e443]: Belum ada staf melakukan shift hari ini.
            - link "Kelola Karyawan & Peran" [ref=e444] [cursor=pointer]:
              - /url: /dapuros/app/staff/management
          - generic [ref=e445]:
            - heading "Perbandingan Penjualan Cabang" [level=3] [ref=e446]
            - application [ref=e450]
  - generic [ref=e455]: 0.0j
```

# Test source

```ts
  1  | // Verifikasi WIRING engine WhatsApp (bukan pengiriman nyata).
  2  | // Membuktikan: engine tereksekusi saat PO/penjualan, gagal dgn ANGGUN saat token invalid,
  3  | // dan TIDAK membatalkan transaksi. Pengiriman nyata harus diuji manual dgn token Fonnte asli.
  4  | //
  5  | // PENTING: jalankan SETELAH backend WhatsApp di-deploy (push GerainaOS/DapurOS).
  6  | const { test, expect } = require("@playwright/test");
  7  | 
  8  | const STAMP = Date.now();
  9  | const EMAIL = `e2e.wa.${STAMP}@gmail.com`;
  10 | const PASSWORD = "Verify123!";
  11 | const STORE = `E2E WA ${STAMP}`;
  12 | 
  13 | test("WhatsApp engine — wiring aman & tereksekusi (token dummy)", async ({ page, request }) => {
  14 |   test.setTimeout(120_000);
  15 | 
  16 |   await test.step("Register akun", async () => {
  17 |     await page.goto("/dapuros/register");
  18 |     await page.fill('[data-testid="register-store-input"]', STORE);
  19 |     await page.fill('[data-testid="register-email-input"]', EMAIL);
  20 |     await page.fill('[data-testid="register-password-input"]', PASSWORD);
  21 |     await page.click('[data-testid="register-submit-btn"]');
  22 |     await expect(page).toHaveURL(/\/dapuros\/app\/dashboard/, { timeout: 30000 });
  23 |   });
  24 | 
  25 |   const token = await page.evaluate(() =>
  26 |     localStorage.getItem("dagangos_token") || localStorage.getItem("geraina_token")
  27 |   );
  28 |   const headers = { Authorization: `Bearer ${token}`, "X-DagangOS-Module": "dapuros", "Content-Type": "application/json" };
  29 | 
  30 |   // Aktifkan WhatsApp dgn token DUMMY (invalid) -> engine akan mencoba kirim & gagal anggun.
  31 |   const cfg = await request.post("/api/integrations", {
  32 |     headers,
  33 |     data: { whatsapp: { is_active: true, provider: "fonnte", api_token: "E2E_DUMMY_TOKEN_INVALID" } },
  34 |   });
  35 |   expect(cfg.ok(), `simpan integrasi -> ${cfg.status()}`).toBeTruthy();
  36 | 
  37 |   // Supplier dgn nomor telepon (tujuan PO).
  38 |   const sup = await (await request.post("/api/suppliers", {
  39 |     headers, data: { name: `E2E Supplier ${STAMP}`, phone: "081234567890", email: "e2e@x.com", address: "-" },
  40 |   })).json();
  41 | 
  42 |   // PO -> harus SUKSES, dan respons memuat hasil whatsapp (engine jalan), sent=false (token dummy).
  43 |   const poRes = await request.post("/api/purchase/orders", {
  44 |     headers,
  45 |     data: { po_no: `E2E-PO-${STAMP}`, supplier_id: sup.id, supplier_name: sup.name, total: 50000, status: "Ordered" },
  46 |   });
  47 |   expect(poRes.ok(), `PO create -> ${poRes.status()}`).toBeTruthy();
  48 |   const po = await poRes.json();
> 49 |   expect(po.whatsapp, "respons PO memuat hasil whatsapp (engine tereksekusi)").toBeTruthy();
     |                                                                                ^ Error: respons PO memuat hasil whatsapp (engine tereksekusi)
  50 |   expect(po.whatsapp.sent, "kirim gagal dgn token dummy TAPI PO tetap tersimpan").toBe(false);
  51 | 
  52 |   // Penjualan dgn nomor pelanggan + WA aktif -> path struk otomatis jalan; order tetap SUKSES.
  53 |   const prod = await (await request.post("/api/products", {
  54 |     headers, data: { name: `E2E Prod ${STAMP}`, price: 20000, cost: 8000, stock: 5, category: "Umum", unit: "pcs" },
  55 |   })).json();
  56 |   const ordRes = await request.post("/api/orders", {
  57 |     headers,
  58 |     data: {
  59 |       items: [{ product_id: prod.id, name: prod.name, price: 20000, quantity: 1, subtotal: 20000 }],
  60 |       payment_method: "cash", cash_received: 50000, tax_percent: 10, dining_option: "Takeaway",
  61 |       customer_name: "E2E Cust", customer_phone: "081234567890",
  62 |     },
  63 |   });
  64 |   expect(ordRes.ok(), `order create -> ${ordRes.status()}`).toBeTruthy();
  65 |   const ord = await ordRes.json();
  66 |   expect(ord.payment_status, "order lunas meski WA best-effort").toBe("paid");
  67 | 
  68 |   console.log(`\nWA wiring OK — PO.whatsapp=${JSON.stringify(po.whatsapp)}\n`);
  69 | });
  70 | 
```