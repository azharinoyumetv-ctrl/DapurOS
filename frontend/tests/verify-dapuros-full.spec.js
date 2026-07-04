// Verifikasi menyeluruh DapurOS — setiap halaman/modul harus render.
// expect.soft: satu run melaporkan SEMUA halaman yang gagal sekaligus.
const { test, expect } = require("@playwright/test");

const STAMP = Date.now();
const EMAIL = `e2e.dapur.${STAMP}@gmail.com`;
const PASSWORD = "Verify123!";
const STORE = `E2E Dapur Full ${STAMP}`;

const ROUTES = [
  ["/dapuros/app/dashboard", "dashboard-page"],
  ["/dapuros/app/pos", "pos-page"],
  ["/dapuros/app/kds", "kds-page"],
  ["/dapuros/app/qr-menu", "qr-menu-page"],
  ["/dapuros/app/products", "products-page"],
  ["/dapuros/app/products/ingredients", "ingredients-page"],
  ["/dapuros/app/products/categories", "categories-page"],
  ["/dapuros/app/products/brands", "brands-page"],
  ["/dapuros/app/products/units", "units-page"],
  ["/dapuros/app/products/stock-adjustment", "stock-adjustment-page"],
  ["/dapuros/app/products/stock-transfer", "stock-transfer-page"],
  ["/dapuros/app/inventory/overview", "stock-overview-page"],
  ["/dapuros/app/inventory/movement", "stock-movement-page"],
  ["/dapuros/app/inventory/valuation", "inventory-valuation-page"],
  ["/dapuros/app/inventory/low-stock", "low-stock-page"],
  ["/dapuros/app/inventory/dead-stock", "dead-stock-page"],
  ["/dapuros/app/purchase/orders", "purchase-orders-page"],
  ["/dapuros/app/purchase/receiving", "goods-receiving-page"],
  ["/dapuros/app/purchase/invoices", "supplier-invoice-page"],
  ["/dapuros/app/suppliers", "suppliers-page"],
  ["/dapuros/app/customers", "customers-page"],
  ["/dapuros/app/customers/membership", "membership-page"],
  ["/dapuros/app/customers/loyalty", "loyalty-page"],
  ["/dapuros/app/debt/receivable", "receivables-page"],
  ["/dapuros/app/debt/payable", "payables-page"],
  ["/dapuros/app/payments/cash", "payment-config-page"],
  ["/dapuros/app/reports/sales", "reports-page"],
  ["/dapuros/app/reports/product", "reports-page"],
  ["/dapuros/app/reports/inventory", "reports-page"],
  ["/dapuros/app/reports/profit", "reports-page"],
  ["/dapuros/app/reports/cashflow", "reports-page"],
  ["/dapuros/app/reports/tax", "reports-page"],
  ["/dapuros/app/staff/management", "staff-page"],
  ["/dapuros/app/staff/roles", "roles-page"],
  ["/dapuros/app/staff/permissions", "permissions-page"],
  ["/dapuros/app/staff/attendance", "attendance-page"],
  ["/dapuros/app/branches", "branches-page"],
  ["/dapuros/app/integrations/xendit", "integrations-page"],
  ["/dapuros/app/settings/general", "settings-page"],
  ["/dapuros/app/settings/license", "license-management-area"],
  ["/dapuros/app/sales", "sales-page"],
  ["/dapuros/app/license", "license-page"],
  ["/dapuros/app/about", "about-page"],
];

test("DapurOS — semua halaman/modul render", async ({ page }) => {
  test.setTimeout(240_000);

  await test.step("Register akun DapurOS baru", async () => {
    await page.goto("/dapuros/register");
    await page.fill('[data-testid="register-store-input"]', STORE);
    await page.fill('[data-testid="register-email-input"]', EMAIL);
    await page.fill('[data-testid="register-password-input"]', PASSWORD);
    await page.click('[data-testid="register-submit-btn"]');
    const errEl = page.locator('[data-testid="register-error"]');
    await Promise.race([
      page.waitForURL(/\/dapuros\/app\/dashboard/, { timeout: 30000 }).catch(() => null),
      errEl.waitFor({ state: "visible", timeout: 30000 }).catch(() => null),
    ]);
    if ((await errEl.count()) > 0 && (await errEl.isVisible())) {
      throw new Error("Register gagal: " + (await errEl.textContent()));
    }
    await expect(page).toHaveURL(/\/dapuros\/app\/dashboard/, { timeout: 30000 });
  });

  for (const [path, tid] of ROUTES) {
    await page.goto(path);
    await expect
      .soft(page.locator(`[data-testid="${tid}"]`).first(), `${path} -> [data-testid=${tid}]`)
      .toBeVisible({ timeout: 15000 });
  }
});
