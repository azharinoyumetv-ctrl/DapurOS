// Verifikasi WIRING engine WhatsApp (bukan pengiriman nyata).
// Membuktikan: engine tereksekusi saat PO/penjualan, gagal dgn ANGGUN saat token invalid,
// dan TIDAK membatalkan transaksi. Pengiriman nyata harus diuji manual dgn token Fonnte asli.
//
// PENTING: jalankan SETELAH backend WhatsApp di-deploy (push GerainaOS/DapurOS).
const { test, expect } = require("@playwright/test");

const STAMP = Date.now();
const EMAIL = `e2e.wa.${STAMP}@gmail.com`;
const PASSWORD = "Verify123!";
const STORE = `E2E WA ${STAMP}`;

test("WhatsApp engine — wiring aman & tereksekusi (token dummy)", async ({ page, request }) => {
  test.setTimeout(120_000);

  await test.step("Register akun", async () => {
    await page.goto("/dapuros/register");
    await page.fill('[data-testid="register-store-input"]', STORE);
    await page.fill('[data-testid="register-email-input"]', EMAIL);
    await page.fill('[data-testid="register-password-input"]', PASSWORD);
    await page.click('[data-testid="register-submit-btn"]');
    await expect(page).toHaveURL(/\/dapuros\/app\/dashboard/, { timeout: 30000 });
  });

  const token = await page.evaluate(() =>
    localStorage.getItem("dagangos_token") || localStorage.getItem("geraina_token")
  );
  const headers = { Authorization: `Bearer ${token}`, "X-DagangOS-Module": "dapuros", "Content-Type": "application/json" };

  // Aktifkan WhatsApp dgn token DUMMY (invalid) -> engine akan mencoba kirim & gagal anggun.
  const cfg = await request.post("/api/integrations", {
    headers,
    data: { whatsapp: { is_active: true, provider: "fonnte", api_token: "E2E_DUMMY_TOKEN_INVALID" } },
  });
  expect(cfg.ok(), `simpan integrasi -> ${cfg.status()}`).toBeTruthy();

  // Supplier dgn nomor telepon (tujuan PO).
  const sup = await (await request.post("/api/suppliers", {
    headers, data: { name: `E2E Supplier ${STAMP}`, phone: "081234567890", email: "e2e@x.com", address: "-" },
  })).json();

  // PO -> harus SUKSES, dan respons memuat hasil whatsapp (engine jalan), sent=false (token dummy).
  const poRes = await request.post("/api/purchase/orders", {
    headers,
    data: { po_no: `E2E-PO-${STAMP}`, supplier_id: sup.id, supplier_name: sup.name, total: 50000, status: "Ordered" },
  });
  expect(poRes.ok(), `PO create -> ${poRes.status()}`).toBeTruthy();
  const po = await poRes.json();
  expect(po.whatsapp, "respons PO memuat hasil whatsapp (engine tereksekusi)").toBeTruthy();
  expect(po.whatsapp.sent, "kirim gagal dgn token dummy TAPI PO tetap tersimpan").toBe(false);

  // Penjualan dgn nomor pelanggan + WA aktif -> path struk otomatis jalan; order tetap SUKSES.
  const prod = await (await request.post("/api/products", {
    headers, data: { name: `E2E Prod ${STAMP}`, price: 20000, cost: 8000, stock: 5, category: "Umum", unit: "pcs" },
  })).json();
  const ordRes = await request.post("/api/orders", {
    headers,
    data: {
      items: [{ product_id: prod.id, name: prod.name, price: 20000, quantity: 1, subtotal: 20000 }],
      payment_method: "cash", cash_received: 50000, tax_percent: 10, dining_option: "Takeaway",
      customer_name: "E2E Cust", customer_phone: "081234567890",
    },
  });
  expect(ordRes.ok(), `order create -> ${ordRes.status()}`).toBeTruthy();
  const ord = await ordRes.json();
  expect(ord.payment_status, "order lunas meski WA best-effort").toBe("paid");

  console.log(`\nWA wiring OK — PO.whatsapp=${JSON.stringify(po.whatsapp)}\n`);
});
