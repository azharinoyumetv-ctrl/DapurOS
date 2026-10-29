package com.example.dapurospos

import java.net.URI
import java.util.Locale

object NavigationPolicy {
    const val ORIGIN = "https://dagangos.com"
    const val START_URL = "$ORIGIN/dapuros/login"
    const val MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024
    const val BILLING_URL = "$ORIGIN/dapuros/app/settings/billing"
    enum class Destination { INTERNAL, EXTERNAL, SUBSCRIPTION, BLOCKED }

    fun subscriptionReturnUrl(source: String, destination: String): String? {
        val from = runCatching { URI(source) }.getOrNull() ?: return null
        val to = runCatching { URI(destination) }.getOrNull() ?: return null
        val path = from.normalize().path.orEmpty().trimEnd('/').lowercase(Locale.ROOT)
        if (classify(source) != Destination.INTERNAL || path !in setOf("/dapuros/pricing", "/dapuros/checkout", "/dapuros/order")) return null
        if (to.scheme?.lowercase(Locale.ROOT) != "https" || to.rawUserInfo != null || to.port !in setOf(-1, 443)) return null
        if (to.host?.lowercase(Locale.ROOT) !in setOf("checkout.xendit.co", "checkout-staging.xendit.co")) return null
        return BILLING_URL
    }

    fun classify(url: String, allowSubscriptions: Boolean = BuildConfig.WEB_SUBSCRIPTIONS_ENABLED): Destination {
        val uri = runCatching { URI(url) }.getOrNull() ?: return Destination.BLOCKED
        val scheme = uri.scheme?.lowercase(Locale.ROOT)
        if (scheme in setOf("mailto", "tel")) return Destination.EXTERNAL
        if (scheme != "https" || uri.rawUserInfo != null) return Destination.BLOCKED
        if (uri.host?.lowercase(Locale.ROOT) != "dagangos.com" || uri.port !in setOf(-1, 443)) {
            return if (uri.host.isNullOrBlank()) Destination.BLOCKED else Destination.EXTERNAL
        }
        val path = uri.normalize().path.orEmpty().trimEnd('/').lowercase(Locale.ROOT)
        if (allowSubscriptions && path in setOf("/dapuros/pricing", "/dapuros/checkout", "/dapuros/order")) return Destination.INTERNAL
        if (path in setOf("/dapuros/app/settings/billing", "/dapuros/app/billing")) return Destination.INTERNAL
        if (path.split('/').any { it in setOf("pricing", "checkout", "order", "billing") }) return Destination.SUBSCRIPTION
        return if (path == "/dapuros" || path.startsWith("/dapuros/")) Destination.INTERNAL else Destination.EXTERNAL
    }

    fun safeFilename(name: String): String = name.substringAfterLast('/').substringAfterLast('\\')
        .replace(Regex("[^\\p{L}\\p{N} ._()-]"), "_")
        .trim().trimStart('.').take(120).ifBlank { "dapuros-export.pdf" }
}
