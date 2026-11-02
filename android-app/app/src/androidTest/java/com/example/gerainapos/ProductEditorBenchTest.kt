package com.example.dapurospos

import android.os.SystemClock
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Test-APK-only CDP access to the unmodified signed release on our isolated emulator. */
@RunWith(AndroidJUnit4::class)
class ProductEditorBenchTest {
    @Test fun serveWebView() {
        val instrumentation=InstrumentationRegistry.getInstrumentation()
        // Leave UiAutomation available to the external system-picker checks.
        fun property(name:String)=Runtime.getRuntime().exec(arrayOf("/system/bin/getprop",name)).inputStream.bufferedReader().use { it.readText().trim() }
        check(property("ro.kernel.qemu")=="1")
        check(property("ro.boot.qemu.avd_name")=="DagangOS_Companion_API_34")
        val directory=File(instrumentation.targetContext.getExternalFilesDir(null),"product-editor-bench").apply { mkdirs() }
        val stop=File(directory,"stop");val ready=File(directory,"ready")
        stop.delete();ready.delete()
        val scenario=ActivityScenario.launch(MainActivity::class.java)
        try {
            scenario.onActivity { WebView.setWebContentsDebuggingEnabled(true) }
            ready.writeText("isolated-test-bench")
            val deadline=SystemClock.elapsedRealtime()+15*60*1000
            while(!stop.exists() && SystemClock.elapsedRealtime()<deadline) SystemClock.sleep(100)
            check(stop.exists()) { "Editor bench exceeded its bounded lifetime" }
        } finally {
            scenario.onActivity { WebView.setWebContentsDebuggingEnabled(false) }
            scenario.close();ready.delete();stop.delete()
        }
    }
}
