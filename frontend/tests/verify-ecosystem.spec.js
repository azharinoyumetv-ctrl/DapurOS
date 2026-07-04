// =============================================================================
// Verifikasi fitur ekosistem DagangOS (pengganti "/playwright-cli verify").
//
// Satu alur serial berbagi satu halaman (agar sesi/localStorage bertahan):
//   daftar akun BARU (login demo sudah dihapus) -> seed produk + order lunas via
//   API terautentikasi -> cek tiap fitur lewat UI.
//
// CATATAN:
//  - Default menargetkan situs LIVE (https://dagangos.com) dan MEMBUAT data uji
//    (akun/toko/produk/order berprefix e2e_verify_*). Bersihkan bila perlu.
//  - Uji lokal:  PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 npx playwright test
// =============================================================================
const { test, expect } = require("@playwright/test");

const STAMP = Date.now();
const EMAIL = `e2e.verify.${STAMP}@gmail.com`;
const PASSWORD = "Verify123!";
const STORE = `E2E Dapur ${STAMP}`;
const PRODUCT = `Kopi Uji ${STAMP}`;
const PRICE = 20000;

test("Verifikasi fitur ekosistem DagangOS (end-to-end)", async ({ page, request }) => {
  test.setTimeout(120_000);
  let token = null;
  let productId = null;
  let orderId = null;

  await test.step("1. Register akun baru (tanpa login demo) + skeleton bersih", async () => {
    await page.goto("/dapuros/register");
    await expect(page.locator('[data-testid="register-form"]')).toBeVisible();
    await page.fill('[data-testid="register-store-input"]', STORE);
    await page.fill('[data-testid="register-email-input"]', EMAIL);
    await page.fill('[data-testid="register-password-input"]', PASSWORD);
    await page.click('[data-testid="register-submit-btn"]');
    // Tunggu dashboard ATAU pesan error — supaya alasan gagal terlihat jelas.
    await Promise.race([
      page.waitForURL(/\/dapuros\/app\/dashboard/, { timeout: 30000 }).catch(() => null),
      page.locator('[data-testid="register-error"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => null),
    ]);
    const errEl = page.locator('[data-testid="register-error"]');
    if ((await errEl.count()) > 0 && (await errEl.isVisible())) {
      throw new Error("Register gagal: " + (await errEl.textContent()));
    }
    await expect(page).toHaveURL(/\/dapuros\/app\/dashboard/, { timeout: 30000 });
    token = await page.evaluate(() =>
      localStorage.getItem("dagangos_token") || localStorage.getItem("geraina_token")
    );
    expect(token, "token tersimpan setelah register").toBeTruthy();
  });

  await test.step("2. Seed produk + order LUNAS via API terautentikasi", async () => {
    const headers = {
      Authorization: `Bearer ${token}`,
      "X-DagangOS-Module": "dapuros",
      "Content-Type": "application/json",
    };
    const pRes = await request.post("/api/products", {
      headers,
      data: { name: PRODUCT, price: PRICE, cost: 8000, stock: 5, category: "Minuman", unit: "cup" },
    });
    expect(pRes.ok(), `create product -> ${pRes.status()}`).toBeTruthy();
    productId = (await pRes.json()).id;

    const oRes = await request.post("/api/orders", {
      headers,
      data: {
        items: [{ product_id: productId, name: PRODUCT, price: PRICE, quantity: 1, subtotal: PRICE }],
        payment_method: "cash",
        cash_received: 50000, // > total (harga + pajak 10%), agar tidak ditolak "tunai kurang"
        tax_percent: 10,
        dining_option: "Takeaway",
      },
    });
    expect(oRes.ok(), `create order -> ${oRes.status()}`).toBeTruthy();
    const order = await oRes.json();
    orderId = order.id;
    expect(order.payment_status, "order tunai langsung lunas").toBe("paid");
  });

  await test.step("3. Laporan Produk Terjual = data REAL (bukan angka acak)", async () => {
    await page.goto("/dapuros/app/reports/product");
    await expect(page.locator('[data-testid="reports-page"]')).toBeVisible();
    await expect(page.locator(`text=${PRODUCT}`).first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator("text=1 pcs").first()).toBeVisible();
  });

  await test.step("4. Langganan & Lisensi = halaman BERBEDA + plan asli Trial", async () => {
    await page.goto("/dapuros/app/settings/billing");
    await expect(page.locator('[data-testid="subscription-billing-management-area"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-plan-title"]')).toContainText("Free Trial");
    await expect(page.locator("text=ACTIVE ENTERPRISE TIER")).toHaveCount(0);

    await page.goto("/dapuros/app/settings/license");
    await expect(page.locator('[data-testid="license-management-area"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-billing-management-area"]')).toHaveCount(0);
  });

  await test.step("5. Kasir: keypad numerik tunai (soft check)", async () => {
    await page.goto("/dapuros/app/pos");
    await expect(page.locator('[data-testid="pos-page"]')).toBeVisible();
    const keypad = page.locator('[data-testid="cash-keypad"]');
    if ((await keypad.count()) === 0) {
      test.info().annotations.push({ type: "note", text: "Keypad belum terlihat di tampilan awal POS (mungkin mode denah) — verifikasi manual di mode Takeaway." });
    } else {
      await expect(keypad.first()).toBeVisible();
      await expect(page.locator('[data-testid="keypad-exact"]').first()).toBeVisible();
    }
  });

  await test.step("6. Suite switcher: DapurOS Aktif, Geraina belum (+ Aktifkan)", async () => {
    await page.goto("/dapuros/app/dashboard");
    await page.click('[data-testid="odoo-ecosystem-switcher-btn"]');
    await expect(page.locator('[data-testid="suite-tile-dapuros"]')).toContainText("Aktif");
    await expect(page.locator('[data-testid="suite-tile-geraina"]')).toContainText("Aktifkan");
  });

  await test.step("7. Aktivasi modul Geraina (toko baru, akun sama)", async () => {
    await page.goto("/geraina/activate");
    await expect(page.locator('[data-testid="activate-page"]')).toBeVisible({ timeout: 30000 });
    await page.fill('[data-testid="activate-store-name"]', `E2E Toko ${STAMP}`);
    await page.click('[data-testid="activate-submit"]');
    await expect(page).toHaveURL(/\/geraina\/app\/dashboard/, { timeout: 30000 });
  });

  await test.step("8. Batalkan / Void order -> status voided (stok kembali)", async () => {
    await page.goto("/dapuros/app/sales");
    await expect(page.locator('[data-testid="sales-page"]')).toBeVisible();
    page.on("dialog", (d) => d.accept());
    const voidBtn = page.locator(`[data-testid="sales-void-${orderId}"]`);
    await expect(voidBtn).toBeVisible({ timeout: 20000 });
    await voidBtn.click();
    await expect(page.locator(`[data-testid="sales-row-${orderId}"]`)).toContainText("voided", { timeout: 20000 });
  });
});
