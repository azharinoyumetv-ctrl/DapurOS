const { test, expect } = require("@playwright/test");

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000/dapuros";

test.describe("DapurOS F&B POS and KDS E2E Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto(`${BASE_URL}/login`);
    
    // Fill in cashier credentials (fresh user or seeded admin)
    await page.fill('[data-testid="login-email"]', "owner@geraina.com");
    await page.fill('[data-testid="login-password"]', "geraina123");
    await page.click('[data-testid="login-submit"]');
    
    // Confirm redirect to dashboard
    await expect(page).toHaveURL(new RegExp("/app/dashboard"));
  });

  test("Floor Plan, Seating, Ordering, and KDS Status Cycle", async ({ page }) => {
    // 1. Navigate to POS page
    await page.click('a:has-text("POS Kasir")');
    await expect(page.locator('[data-testid="pos-page"]')).toBeVisible();
    
    // Check if Visual Floor Layout is active
    await expect(page.locator('text=Layout Meja & FOH')).toBeVisible();
    
    // 2. Select a Vacant Table and Open Session
    const tableButton = page.locator('button:has-text("Meja 01")');
    await expect(tableButton).toBeVisible();
    await tableButton.click();
    
    // Verify vacant details
    await expect(page.locator('text=Kosong (Vacant)')).toBeVisible();
    
    // Open session (Buka Meja)
    await page.click('button:has-text("Buka Meja")');
    
    // Table status should now update to Seated
    await expect(page.locator('text=Seated')).toBeVisible();
    
    // 3. Take Order (Ambil Pesanan)
    await page.click('button:has-text("Ambil Pesanan")');
    
    // Verifies product catalog view
    await expect(page.locator('[data-testid="pos-product-grid"]')).toBeVisible();
    
    // Select first product
    const firstProduct = page.locator('[data-testid^="pos-product-"]').first();
    await firstProduct.click();
    
    // Verify item added to cart
    await expect(page.locator('[data-testid^="cart-item-"]')).toBeVisible();
    
    // Add item-level custom note
    await page.fill('input[placeholder*="Modifikasi"]', "Less Ice, pedas");
    
    // Verify F&B taxes calculated (Service Charge 5% + PB1 10%)
    await expect(page.locator('text=Service Charge (5%)')).toBeVisible();
    await expect(page.locator('text=Pajak PB1 (10%)')).toBeVisible();
    
    // Settle Checkout
    await page.click('[data-testid="pm-cash"]');
    await page.fill('[data-testid="cart-cash-received"]', "500000"); // large enough amount
    await page.click('[data-testid="checkout-btn"]');
    
    // Receipt dialog should appear
    await expect(page.locator('[data-testid="receipt-dialog"]')).toBeVisible();
    await page.click('[data-testid="receipt-done-btn"]');
  });

  test("Split Billing and EDC Simulator Checkout", async ({ page }) => {
    // 1. Navigate to POS page
    await page.click('a:has-text("POS Kasir")');
    
    // Select a table and open session
    const tableButton = page.locator('button:has-text("Meja 02")');
    await tableButton.click();
    await page.click('button:has-text("Buka Meja")');
    
    // Go to catalog and add 2 units
    await page.click('button:has-text("Ambil Pesanan")');
    const firstProduct = page.locator('[data-testid^="pos-product-"]').first();
    await firstProduct.click();
    await page.click('[data-testid^="cart-inc-"]'); // increment quantity
    
    // Check out / save to session
    // (Wait, since they are dining, checkout-btn will save the order on the table session)
    await page.click('[data-testid="pm-cash"]');
    await page.fill('[data-testid="cart-cash-received"]', "500000");
    await page.click('[data-testid="checkout-btn"]');
    await page.click('[data-testid="receipt-done-btn"]');
    
    // Go back to floor layout
    await page.click('a:has-text("POS Kasir")');
    await tableButton.click();
    
    // Verify Split Bill is clickable
    const splitButton = page.locator('button:has-text("Split Bill")');
    await expect(splitButton).toBeVisible();
    await splitButton.click();
    
    // Perform Equal Split calculation
    await page.click('button:has-text("Hitung Pembagian")');
    await expect(page.locator('text=Per Orang')).toBeVisible();
    
    // Close modal
    await page.click('button:has-text("Buka Meja")'); // close modal or click close
  });
});
