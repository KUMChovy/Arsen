package com.kumchovy.arsen.codex.backup

import com.kumchovy.arsen.codex.account.*
import javax.crypto.KeyGenerator
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class PendingBackupStagerTest {
    @get:Rule val temp = TemporaryFolder()
    private class Source : NativeSessionSource {
        var identity: SessionIdentity? = SessionIdentity("user_abc", "session_a")
        override suspend fun waitUntilReady() = true
        override fun currentIdentity() = identity
        override suspend fun refreshToken() = "test.token"
    }
    private fun store() = PendingSnapshotStore(temp.root, KeyGenerator.getInstance("AES").apply { init(256) }.generateKey(), 4096)

    @Test fun `validates before writing and binds the snapshot to the native account`() = runBlocking {
        val store = store(); val source = Source(); var validationCalls = 0
        val stager = PendingBackupStager(store, NativeSessionProvider(source), 4096) { snapshot, _ ->
            validationCalls++; assertEquals("user_abc", snapshot.owner); assertEquals(3L, snapshot.revision)
        }
        assertEquals(BackupStageResult.STORED, stager.stage(3, byteArrayOf(1, 2)))
        assertEquals(1, validationCalls); assertEquals("user_abc", store.read()!!.owner)
        assertEquals(BackupStageResult.OTHER_ACCOUNT, stager.stage(3, byteArrayOf(1, 2), "user_other"))
        source.identity = SessionIdentity("user_other", "session_b")
        assertEquals(BackupStageResult.OTHER_ACCOUNT, stager.stage(4, byteArrayOf(3)))
        assertEquals(3L, store.read()!!.revision)
    }

    @Test fun `invalid data or an account change never overwrites pending bytes`() = runBlocking {
        val store = store(); val source = Source()
        store.write("user_abc", 2, byteArrayOf(7))
        val invalid = PendingBackupStager(store, NativeSessionProvider(source), 4096) { _, _ -> error("invalid") }
        assertEquals(BackupStageResult.INVALID, invalid.stage(3, byteArrayOf(1)))
        val changed = PendingBackupStager(store, NativeSessionProvider(source), 4096) { _, _ -> source.identity = SessionIdentity("user_other", "session_b") }
        assertEquals(BackupStageResult.OTHER_ACCOUNT, changed.stage(3, byteArrayOf(1)))
        assertArrayEquals(byteArrayOf(7), store.read()!!.payload)
        source.identity = null
        assertEquals(BackupStageResult.SIGN_IN_REQUIRED, changed.stage(3, byteArrayOf(1)))
    }
}
