package com.example.dapurospos

object BarcodeScanPolicy {
    fun allows(target: String, path: String): Boolean = when (target) {
        "pos" -> path.trimEnd('/') == "/dapuros/app/pos"
        "product" -> path.trimEnd('/') == "/dapuros/app/products"
        else -> false
    }
    fun canDeliver(target: String, sourcePath: String, currentPath: String, value: String?): Boolean =
        allows(target, sourcePath) && sourcePath == currentPath && !value.isNullOrBlank() && value.length <= 256
}
