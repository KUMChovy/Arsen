package com.kumchovy.arsen.codex.backup

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BackupBridgeRevisionInstrumentedTest {
    @Test fun parsesTheSameJsonNumberUsedByCapacitor() {
        val small = PluginCall(null, "ArsenBackup", "test", "stage", JSObject("{\"revision\":27}"))
        assertNull(small.getLong("revision"))
        assertEquals(27L, backupBridgeRevision(small.data.opt("revision")))
        val large = PluginCall(null, "ArsenBackup", "test", "stage", JSObject("{\"revision\":2147483648}"))
        assertEquals(2147483648L, backupBridgeRevision(large.data.opt("revision")))
    }
}
