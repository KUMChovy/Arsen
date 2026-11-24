package com.kumchovy.arsen.codex.backup

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertArrayEquals
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class AndroidBackupKeyTest {
    @Test fun keyPersistsAcrossStoreInstances() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val directory = File(context.noBackupFilesDir, "backup-test-${UUID.randomUUID()}")
        try {
            val payload = "respaldo privado".toByteArray()
            PendingSnapshotStore(directory, AndroidBackupKey.getOrCreate(), 1024).write("user_test", 1, payload)
            val restored = PendingSnapshotStore(directory, AndroidBackupKey.getOrCreate(), 1024).read()
            assertArrayEquals(payload, restored!!.payload)
        } finally {
            directory.deleteRecursively()
        }
    }
}
