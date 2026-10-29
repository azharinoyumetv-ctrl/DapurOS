package com.example.dapurospos

import org.junit.Assert.*
import org.junit.Test

class BarcodeScanPolicyTest {
    @Test fun productAndCashierResultsReturnOnlyToTheirOriginatingScreen() {
        assertTrue(BarcodeScanPolicy.canDeliver("product", "/dapuros/app/products", "/dapuros/app/products", "8991234567890"))
        assertTrue(BarcodeScanPolicy.canDeliver("pos", "/dapuros/app/pos", "/dapuros/app/pos", "5901234123457"))
        assertFalse(BarcodeScanPolicy.canDeliver("pos", "/dapuros/app/pos", "/dapuros/app/products", "5901234123457"))
        assertFalse(BarcodeScanPolicy.canDeliver("product", "/dapuros/app/pos", "/dapuros/app/pos", "5901234123457"))
    }
    @Test fun unrelatedRoutesAndInvalidResultsAreRejected() {
        assertFalse(BarcodeScanPolicy.allows("product", "/dapuros/app/products/categories"))
        assertFalse(BarcodeScanPolicy.allows("other", "/dapuros/app/products"))
        for (value in listOf(null, "", " ", "x".repeat(257))) assertFalse(BarcodeScanPolicy.canDeliver("product", "/dapuros/app/products", "/dapuros/app/products", value))
    }
}
