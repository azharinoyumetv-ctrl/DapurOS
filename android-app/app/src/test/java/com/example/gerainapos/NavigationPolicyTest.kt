package com.example.dapurospos

import com.example.dapurospos.NavigationPolicy.Destination.*
import org.junit.Assert.assertEquals
import org.junit.Test

class NavigationPolicyTest {
    @Test fun productionRoutesStayInside() {
        for (path in listOf("/dapuros/login", "/dapuros/register", "/dapuros/app/pos", "/dapuros/app/payments/qris")) {
            assertEquals(path, INTERNAL, NavigationPolicy.classify("https://dagangos.com$path"))
        }
    }
    @Test fun otherOriginsCannotAccessNativeFeatures() {
        for (url in listOf("https://dagangos.com.evil.test/dapuros", "https://evil.test/dapuros", "https://dagangos.com:8443/dapuros", "https://dagangos.com/geraina")) {
            assertEquals(url, EXTERNAL, NavigationPolicy.classify(url))
        }
        for (url in listOf("javascript:alert(1)", "file:///sdcard/token", "intent://test", "http://dagangos.com/dapuros", "https://user@dagangos.com/dapuros", "invalid url")) {
            assertEquals(url, BLOCKED, NavigationPolicy.classify(url))
        }
    }
    @Test fun subscriptionPaymentsAreBlockedWithoutBlockingPhysicalSales() {
        for (path in listOf("/dapuros/pricing", "/dapuros/checkout", "/dapuros/app/settings/billing/checkout", "/dapuros/%63heckout", "/dapuros/app/../pricing")) {
            assertEquals(path, SUBSCRIPTION, NavigationPolicy.classify("https://dagangos.com$path", false))
        }
        assertEquals(INTERNAL, NavigationPolicy.classify("https://dagangos.com/dapuros/app/pos"))
    }
    @Test fun websiteBuildAllowsOnlyDapurOSSubscriptionPagesInside() {
        for (path in listOf("/dapuros/pricing", "/dapuros/checkout", "/dapuros/order?receipt=test", "/dapuros/%63heckout", "/dapuros/app/../pricing")) {
            assertEquals(path, INTERNAL, NavigationPolicy.classify("https://dagangos.com$path", true))
        }
        assertEquals(EXTERNAL, NavigationPolicy.classify("https://checkout.xendit.co/web/test", true))
        assertEquals(SUBSCRIPTION, NavigationPolicy.classify("https://dagangos.com/geraina/pricing", true))
        assertEquals(SUBSCRIPTION, NavigationPolicy.classify("https://dagangos.com/dapuros/app/settings/billing/checkout", true))
    }
    @Test fun accountStatusOverviewsRemainAvailable() {
        for (path in listOf("/dapuros/app/settings/billing", "/dapuros/app/settings/billing/", "/dapuros/app/billing", "/dapuros/app/settings/%62illing")) {
            assertEquals(path, INTERNAL, NavigationPolicy.classify("https://dagangos.com$path"))
        }
    }
    @Test fun exportNamesCannotEscapeTheSelectedDirectory() {
        assertEquals("invoice.pdf", NavigationPolicy.safeFilename("../../invoice.pdf"))
        assertEquals("invoice.pdf", NavigationPolicy.safeFilename("C:\\private\\invoice.pdf"))
        assertEquals("dapuros-export.pdf", NavigationPolicy.safeFilename("..."))
        assertEquals(120, NavigationPolicy.safeFilename("a".repeat(200)).length)
    }
    @Test fun onlySubscriptionCheckoutReturnsToBilling() {
        for (path in listOf("/dapuros/pricing", "/dapuros/checkout", "/dapuros/order?receipt=fixture")) {
            assertEquals(if (BuildConfig.WEB_SUBSCRIPTIONS_ENABLED) NavigationPolicy.BILLING_URL else null,
                NavigationPolicy.subscriptionReturnUrl("https://dagangos.com$path", "https://checkout.xendit.co/web/fixture"))
        }
        for (source in listOf("https://dagangos.com/dapuros/app/pos", "https://dagangos.com/dapuros/app/about", "https://evil.test/dapuros/checkout", "http://dagangos.com/dapuros/checkout")) {
            assertEquals(null, NavigationPolicy.subscriptionReturnUrl(source, "https://checkout.xendit.co/web/fixture"))
        }
        for (destination in listOf("https://checkout.xendit.co.evil.test/web/fixture", "https://evil.test/", "http://checkout.xendit.co/web/fixture", "https://user@checkout.xendit.co/web/fixture", "https://checkout.xendit.co:8443/web/fixture")) {
            assertEquals(null, NavigationPolicy.subscriptionReturnUrl("https://dagangos.com/dapuros/checkout", destination))
        }
    }
}
