package com.kumchovy.arsen.codex.backup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BackupBridgeRevisionTest {
    @Test fun `accepts integer and long representations within the JavaScript safe range`() {
        assertEquals(0L, backupBridgeRevision(0))
        assertEquals(27L, backupBridgeRevision(27))
        assertEquals(2147483648L, backupBridgeRevision(2147483648L))
        assertEquals(9007199254740991L, backupBridgeRevision(9007199254740991L))
        assertEquals(27L, backupBridgeRevision(27.0))
    }
    @Test fun `rejects malformed fractional negative and unsafe revisions`() {
        for (value in listOf(null, "27", -1, 1.5, Double.NaN, Double.POSITIVE_INFINITY, 9007199254740992L)) {
            assertNull(backupBridgeRevision(value))
        }
    }
}
