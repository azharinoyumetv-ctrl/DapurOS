package com.example.dapurospos

import android.graphics.Bitmap
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Runs against the exact signed release; fixture transport exists only in this test APK. */
@RunWith(AndroidJUnit4::class)
class DapurOSReleaseFlowTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private lateinit var scenario: ActivityScenario<MainActivity>
    private lateinit var web: WebView
    private val checks = JSONArray()
    private val profile = InstrumentationRegistry.getArguments().getString("profile") ?: "phone"
    private val user = """{"id":"android-fixture-owner","store_id":"android-fixture-store","email":"android-fixture@example.invalid","role":"Owner","store_name":"DapurOS Test Restaurant","plan":"business","trial_ends_at":"2099-01-01T00:00:00Z","stores":[{"module":"dapuros","store_id":"android-fixture-store"}]}"""
    private val products = """[{"id":"coffee","name":"Kopi Resep Fixture","sku":"899TEST","price":10000,"stock":40,"category":"Minuman","unit":"pcs","recipe":[{"ingredient_id":"beans","quantity":15}]}]"""
    @Volatile private var replay: String? = null

    private fun findWeb(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) for (i in 0 until view.childCount) findWeb(view.getChildAt(i))?.let { return it }
        return null
    }

    private fun attach() {
        scenario.onActivity { activity ->
            web = findWeb(activity.window.decorView) ?: error("WebView missing")
            val original = web.webViewClient
            web.webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    if (request.url.host == "dagangos.com" && request.url.path.orEmpty().startsWith("/api/")) {
                        val path = request.url.path!!
                        val body = when {
                            path == "/api/auth/login" -> """{"access_token":"isolated-android-fixture-token","user":$user}"""
                            path == "/api/auth/me" -> user
                            path == "/api/products" -> products
                            path == "/api/products/catalogue" -> """{"items":$products,"total":1,"next_cursor":null}"""
                            path == "/api/products/category-names" -> """["Minuman"]"""
                            path == "/api/ingredients" -> """[{"id":"beans","name":"Biji kopi fixture","stock":2000,"unit":"g"}]"""
                            path == "/api/floors" -> """[{"id":"floor-test","name":"Lantai Fixture","level":1}]"""
                            path == "/api/tables" -> """[{"id":"table-test","label":"Meja Fixture","floor_id":"floor-test","capacity":4,"status":"Vacant"}]"""
                            path == "/api/payments/options" -> """{"methods":{"cash":{"enabled":true,"displayed":true},"qris_bank":{"enabled":false},"ewallet":{"enabled":false},"va":{"enabled":false},"credit_card":{"enabled":false},"doku":{"enabled":false}},"ewallet_channels":[]}"""
                            path == "/api/orders/stats" -> """{"today_sales":10000,"today_orders":1,"week_sales":10000,"month_sales":10000,"product_count":1}"""
                            path == "/api/support/context" -> """{"customer_email":"android-fixture@example.invalid","store_name":"DapurOS Test Restaurant","recipient":"contact@dagangos.com","delivery_ready":false}"""
                            path == "/api/subscriptions/current" -> """{"billing_model":"prepaid","auto_renew":false,"can_manage":true,"plan":"business","subscription":{"tier":"business","status":"active","active":true,"expires_at":"2099-01-01T00:00:00Z"},"addons":{"catalog":[],"items":[]}}"""
                            path == "/api/settings" -> """{"general":{"store_name":"DapurOS Test Restaurant","timezone":"Asia/Jakarta"},"receipt":{"footer_text":"Fixture only"},"printer":{"mode":"local","paper_size":"80mm"}}"""
                            path == "/api/offline/orders" && replay != null -> replay!!
                            path == "/api/offline/orders" -> """{"detail":"Isolated offline transport"}"""
                            else -> "[]"
                        }
                        val status = if (path == "/api/offline/orders" && replay == null) 503 else 200
                        return WebResourceResponse("application/json", "UTF-8", status, if (status == 200) "OK" else "Unavailable", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(body.toByteArray()))
                    }
                    // No network destination is used by the fixture: static UI comes from this APK.
                    return original.shouldInterceptRequest(view, request) ?: WebResourceResponse("text/plain", "UTF-8", 503, "Fixture network disabled", emptyMap(), ByteArrayInputStream(byteArrayOf()))
                }
                override fun onPageStarted(view: WebView, url: String, icon: Bitmap?) = original.onPageStarted(view, url, icon)
                override fun onPageFinished(view: WebView, url: String) = original.onPageFinished(view, url)
            }
        }
    }

    private fun js(expression: String): Any? {
        var result: Any? = null
        val latch = CountDownLatch(1)
        instrumentation.runOnMainSync { web.evaluateJavascript(expression) { raw -> result = runCatching { JSONTokener(raw).nextValue() }.getOrNull(); latch.countDown() } }
        check(latch.await(10, TimeUnit.SECONDS)) { "JavaScript callback timed out" }
        return result
    }

    private fun until(expression: String) {
        val end = SystemClock.elapsedRealtime() + 25000
        while (SystemClock.elapsedRealtime() < end) { if (js(expression) == true) return; SystemClock.sleep(100) }
        error("Condition failed: $expression; page=" + js("document.body.innerText.slice(0,1500)"))
    }

    private fun tap(selector: String) {
        val editable = js("document.querySelector(${JSONObject.quote(selector)}).matches('input,textarea')") == true
        if (!editable) {
            instrumentation.runOnMainSync {
                (web.context.getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager).hideSoftInputFromWindow(web.windowToken, 0)
            }
            SystemClock.sleep(300)
        }
        js("document.querySelector(${JSONObject.quote(selector)}).scrollIntoView({block:'center'});true")
        SystemClock.sleep(200)
        val point = JSONObject(js("JSON.stringify((()=>{const r=document.querySelector(${JSONObject.quote(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,dpr:devicePixelRatio}})())").toString())
        val location = IntArray(2)
        instrumentation.runOnMainSync { web.getLocationOnScreen(location) }
        val x = location[0] + point.getDouble("x").toFloat() * point.getDouble("dpr").toFloat()
        val y = location[1] + point.getDouble("y").toFloat() * point.getDouble("dpr").toFloat()
        val at = SystemClock.uptimeMillis()
        instrumentation.sendPointerSync(MotionEvent.obtain(at, at, MotionEvent.ACTION_DOWN, x, y, 0))
        instrumentation.sendPointerSync(MotionEvent.obtain(at, at + 60, MotionEvent.ACTION_UP, x, y, 0))
        SystemClock.sleep(250)
    }

    private fun fill(selector: String, value: String) { tap(selector); instrumentation.sendStringSync(value); until("document.querySelector(" + JSONObject.quote(selector) + ").value === " + JSONObject.quote(value)) }

    private fun go(route: String) { js("window.DapurOSRouter.navigate(location.origin+'/dapuros/app/$route')"); until("location.pathname.endsWith('/$route') && !document.querySelector('[data-testid=route-loading]')") }
    private fun checkStep(name: String) { checks.put(name); save("running"); screenshot(name.replace(Regex("[^a-zA-Z0-9]+"), "-").take(65)) }
    private fun output(): File = File(instrumentation.targetContext.getExternalFilesDir(null), "release-verification/$profile").apply { mkdirs() }
    private fun save(status: String) { File(output(), "verification.json").writeText(JSONObject().put("status",status).put("profile",profile).put("applicationId",instrumentation.targetContext.packageName).put("signedRelease",true).put("fixtureNetworkOnly",true).put("checks",checks).toString(2)) }
    private fun screenshot(name: String) { instrumentation.uiAutomation.takeScreenshot()?.let { image -> File(output(), "$name.png").outputStream().use { image.compress(Bitmap.CompressFormat.PNG,100,it) }; image.recycle() } }
    private fun systemText(): String {
        fun collect(node: android.view.accessibility.AccessibilityNodeInfo?): String {
            if (node == null) return ""
            return node.text?.toString().orEmpty() + " " + (0 until node.childCount).joinToString(" ") { collect(node.getChild(it)) }
        }
        return collect(instrumentation.uiAutomation.rootInActiveWindow)
    }
    private fun systemWait(text: String) {
        val end = SystemClock.elapsedRealtime() + 20000
        while (SystemClock.elapsedRealtime() < end) { if (systemText().contains(text, ignoreCase = true)) return; SystemClock.sleep(150) }
        error("System control missing: $text; screen=" + systemText())
    }
    private fun systemClick(text: String) {
        systemWait(text)
        val matches = instrumentation.uiAutomation.rootInActiveWindow.findAccessibilityNodeInfosByText(text.uppercase())
        check(matches.any { it.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK) })
        SystemClock.sleep(300)
    }
    private fun shell(command: String) {
        android.os.ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand(command)).use { it.readBytes() }
    }

    @Test fun restaurantReleaseFlow() {
        scenario = ActivityScenario.launch(MainActivity::class.java)
        try {
            attach()
            until("!!document.body")
            val saved = js("localStorage.getItem('dapuros_user')")
            check(saved == null || saved == JSONObject.NULL || saved.toString().contains("android-fixture@example.invalid")) { "Refusing to replace a non-fixture session" }
            js("localStorage.clear();sessionStorage.clear();true")
            scenario.onActivity { web.loadUrl(NavigationPolicy.START_URL) }
            until("!!document.querySelector('[data-testid=login-email-input]') && !!window.DapurOSDevice")
            fill("[data-testid=login-email-input]", "android-fixture@example.invalid")
            fill("[data-testid=login-password-input]", "fixturePassword123")
            tap("[data-testid=login-password-toggle]")
            assertEquals("text", js("document.querySelector('[data-testid=login-password-input]').type"))
            checkStep("Readable login and password visibility")
            tap("[data-testid=login-submit-btn]")
            until("!!document.querySelector('[data-testid=app-layout]')")
            until("!!window.DapurOSRouter && !!window.DapurOSDevice")
            go("pos")
            until("document.body.innerText.includes('Langsung Takeaway')")
            js("Array.from(document.querySelectorAll('button')).find(e=>e.innerText.includes('Langsung Takeaway')).click()")
            until("!!document.querySelector('[data-testid=pos-product-coffee]')")
            assertTrue(js("document.documentElement.scrollWidth <= innerWidth+2") == true)
            assertEquals(1, (js("document.querySelectorAll('[data-testid=pm-cash]').length") as Number).toInt())
            assertEquals(0, (js("document.querySelectorAll('[data-testid=pm-va],[data-testid=pm-ewallet],[data-testid=pm-credit_card]').length") as Number).toInt())
            checkStep("Restaurant catalogue responsive with configured cash only")
            js("document.querySelector('[data-testid=pos-product-coffee]').click()")
            until("!!document.querySelector('[data-testid=cart-total]') && document.querySelector('[data-testid=cart-total]').textContent.includes('11.000')")
            js("document.querySelector('[data-testid=mobile-cart-open]').click()")
            until("document.querySelector('[data-testid=pos-cart]').getBoundingClientRect().width>0")
            fill("[data-testid=cart-cash-received]", "20000")
            tap("[data-testid=checkout-btn]")
            until("!!document.querySelector('[data-testid=receipt-pending-sync]')")
            checkStep("Cash takeaway saved durably before receipt with tax")
            js("window.__localSale=null;let req=indexedDB.open('dapuros-pos-offline-v1',1);req.onsuccess=()=>{let r=req.result.transaction('sales').objectStore('sales').getAll();r.onsuccess=()=>window.__localSale=r.result.at(-1)};true")
            until("!!window.__localSale?.body?.client_order_id")
            replay = js("JSON.stringify({...window.__localSale.order,sync_status:'synced'})").toString()
            js("window.dispatchEvent(new Event('online'));true")
            until("!!document.querySelector('[data-testid=receipt-status]')")
            js("document.querySelector('[data-testid=receipt-done-btn]').click();localStorage.setItem('dapuros_upgrade_retention','retained-fixture');true")
            go("products")
            until("!!document.querySelector('[data-testid=new-product-btn]')")
            js("document.querySelector('[data-testid=new-product-btn]').click()")
            until("!!document.querySelector('[data-testid=pf-sku]')")
            js("window.dispatchEvent(new CustomEvent('dapuros-barcode',{detail:{target:'product',value:'899FIXTURE'}}))")
            until("document.querySelector('[data-testid=pf-sku]').value==='899FIXTURE'")
            assertTrue(js("document.body.innerText.includes('Resep') || document.body.innerText.includes('Bahan')") == true)
            checkStep("Product barcode fills recipe draft without saving")
            instrumentation.sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK)
            SystemClock.sleep(300)
            go("settings/billing")
            until("document.body.innerText.includes('Business') && document.body.innerText.includes('2099')")
            val distribution = InstrumentationRegistry.getArguments().getString("distribution") ?: "website"
            assertEquals(distribution, js("window.DapurOSDevice.appInfo.updateChannel"))
            if (distribution == "play") assertEquals(0, (js("document.querySelectorAll('a[href*=\"/dapuros/pricing\"]').length") as Number).toInt())
            go("about")
            until("document.body.innerText.includes('1.0.0') && document.body.innerText.includes('Business')")
            assertTrue(js("document.body.innerText.includes('DapurOS')") == true)
            checkStep("Installed identity subscription expiry and support entry agree")
            go("products")
            until("!!document.querySelector('[data-testid=new-product-btn]')")
            js("document.querySelector('[data-testid=new-product-btn]').click()")
            until("!!document.querySelector('[data-testid=pf-scan-barcode]')")
            tap("[data-testid=pf-scan-barcode]")
            SystemClock.sleep(700)
            val deny = instrumentation.uiAutomation.rootInActiveWindow.findAccessibilityNodeInfosByViewId("com.android.permissioncontroller:id/permission_deny_button")
            check(deny.any { it.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK) }) { "Camera permission denial was not exercised" }
            systemWait("Izin kamera ditolak")
            systemClick("Tutup pemindai")
            shell("pm grant com.dagangos.dapuros android.permission.CAMERA")
            tap("[data-testid=pf-scan-barcode]")
            systemWait("Kamera siap")
            checkStep("Camera denial recovery and offline model preview")
            systemClick("Tutup pemindai")
            go("settings/printer")
            until("!!window.DapurOSDevice")
            js("(()=>{let b=document.createElement('button');b.id='release-printer-fixture';b.textContent='Printer test control';b.onclick=()=>window.DapurOSDevice.configurePrinter();document.body.append(b);return true})()")
            tap("#release-printer-fixture")
            systemWait("Hubungkan printer struk")
            checkStep("Native Bluetooth and USB receipt setup available without sending print")
            instrumentation.sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK)
            assertEquals("retained-fixture",js("localStorage.getItem('dapuros_upgrade_retention')"))
            save("passed")
        } catch (error: Throwable) { screenshot("failure"); File(output(),"failure.txt").writeText(error.toString()); save("failed"); throw error }
        finally { scenario.close() }
    }

    @Test fun seedPendingSaleForUpgrade() {
        scenario = ActivityScenario.launch(MainActivity::class.java)
        try {
            attach(); until("!!window.DapurOSRouter && !!document.querySelector('[data-testid=app-layout]')")
            check(js("localStorage.getItem('dapuros_user')").toString().contains("android-fixture@example.invalid"))
            go("pos"); until("document.body.innerText.includes('Langsung Takeaway')")
            js("Array.from(document.querySelectorAll('button')).find(e=>e.innerText.includes('Langsung Takeaway')).click()")
            until("!!document.querySelector('[data-testid=pos-product-coffee]')")
            js("document.querySelector('[data-testid=pos-product-coffee]').click();document.querySelector('[data-testid=mobile-cart-open]').click()")
            fill("[data-testid=cart-cash-received]", "20000"); tap("[data-testid=checkout-btn]")
            until("!!document.querySelector('[data-testid=receipt-pending-sync]')")
            js("window.__upgradeSale=null;let r=indexedDB.open('dapuros-pos-offline-v1',1);r.onsuccess=()=>{let q=r.result.transaction('sales').objectStore('sales').getAll();q.onsuccess=()=>{let row=q.result.filter(x=>x.status!=='synced').at(-1);if(row){localStorage.setItem('dapuros_upgrade_sale',row.body.client_order_id);localStorage.setItem('dapuros_upgrade_retention','retained-fixture');window.__upgradeSale=row.body.client_order_id;}}};true")
            until("!!window.__upgradeSale")
            checkStep("Pending cash sale and preference committed before signed upgrade");save("passed")
        } finally { scenario.close() }
    }

    @Test fun verifyUpgradeRetention() {
        scenario = ActivityScenario.launch(MainActivity::class.java)
        try {
            attach(); until("!!window.DapurOSRouter && !!document.querySelector('[data-testid=app-layout]')")
            assertEquals("retained-fixture",js("localStorage.getItem('dapuros_upgrade_retention')"))
            assertTrue(js("localStorage.getItem('dapuros_user')").toString().contains("android-fixture@example.invalid"))
            js("window.__upgradeRetained=false;let r=indexedDB.open('dapuros-pos-offline-v1',1);r.onsuccess=()=>{let q=r.result.transaction('sales').objectStore('sales').getAll();q.onsuccess=()=>window.__upgradeRetained=q.result.some(x=>x.body.client_order_id===localStorage.getItem('dapuros_upgrade_sale')&&x.status!=='synced')};true")
            until("window.__upgradeRetained===true")
            assertEquals("1.0.0",js("window.DapurOSDevice.appInfo.versionName"))
            checkStep("Signed upgrade retains account preferences and pending cash sale");save("passed")
        } finally { scenario.close() }
    }

    @Test fun backAndRotationKeepDraftAndSession() {
        scenario = ActivityScenario.launch(MainActivity::class.java)
        try {
            attach(); until("!!window.DapurOSRouter && !!document.querySelector('[data-testid=app-layout]')")
            check(js("localStorage.getItem('dapuros_user')").toString().contains("android-fixture@example.invalid"))
            go("products"); until("!!document.querySelector('[data-testid=new-product-btn]')")
            js("document.querySelector('[data-testid=new-product-btn]').click()")
            until("!!document.querySelector('[data-testid=pf-name]')")
            fill("[data-testid=pf-name]", "Rotation fixture")
            js("window.__draftDocument='same-document';true")
            shell("settings put system accelerometer_rotation 0")
            shell("settings put system user_rotation 1")
            SystemClock.sleep(700)
            assertEquals("same-document",js("window.__draftDocument"))
            assertEquals("Rotation fixture",js("document.querySelector('[data-testid=pf-name]').value"))
            checkStep("Rotation preserves restaurant recipe draft and running document")
            tap("[data-testid=pf-name]")
            SystemClock.sleep(500)
            instrumentation.sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK)
            SystemClock.sleep(350)
            assertEquals("Rotation fixture",js("document.querySelector('[data-testid=pf-name]')?.value"))
            instrumentation.sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK)
            until("!document.querySelector('[data-testid=product-form]')")
            assertEquals("/dapuros/app/products",js("location.pathname"))
            checkStep("Back dismisses keyboard then recipe dialog before navigation")
            go("dashboard")
            instrumentation.sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK)
            SystemClock.sleep(250)
            instrumentation.sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK)
            SystemClock.sleep(400)
            assertEquals(androidx.lifecycle.Lifecycle.State.DESTROYED,scenario.state)
            checks.put("Double Back exits the app")
            scenario = ActivityScenario.launch(MainActivity::class.java)
            attach(); until("!!document.querySelector('[data-testid=app-layout]')")
            assertTrue(js("localStorage.getItem('dapuros_user')").toString().contains("android-fixture@example.invalid"))
            checkStep("Restart retains the fixture account after confirmed exit");save("passed")
        } finally { shell("settings put system user_rotation 0"); scenario.close() }
    }
}
