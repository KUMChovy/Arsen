package com.kumchovy.arsen.codex.backup

import com.kumchovy.arsen.codex.account.*
import javax.crypto.KeyGenerator
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class PendingBackupRetryTest {
    @get:Rule val temp = TemporaryFolder()
    @Test fun `only schedules a pending copy belonging to the expected active account`() = runBlocking {
        val store = PendingSnapshotStore(temp.root, KeyGenerator.getInstance("AES").apply { init(256) }.generateKey(), 1024)
        val source = object : NativeSessionSource {
            override suspend fun waitUntilReady() = true
            override fun currentIdentity() = SessionIdentity("user_abc", "session_a")
            override suspend fun refreshToken() = "token"
        }
        var scheduled = 0
        val retry = PendingBackupRetry(store, NativeSessionProvider(source)) { scheduled++ }
        assertEquals(BackupRetryResult.NOTHING_PENDING, retry.run("user_abc"))
        store.write("user_abc", 2, byteArrayOf(1))
        assertEquals(BackupRetryResult.OTHER_ACCOUNT, retry.run("user_other"))
        assertEquals(0, scheduled)
        assertEquals(BackupRetryResult.QUEUED, retry.run("user_abc"))
        assertEquals(1, scheduled); assertNotNull(store.read())
    }
}
