package com.kumchovy.arsen.codex.backup

import com.kumchovy.arsen.codex.account.NativeSessionProvider
import com.kumchovy.arsen.codex.account.NativeSessionSource
import com.kumchovy.arsen.codex.account.SessionIdentity
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import javax.crypto.KeyGenerator

class BackupWorkerEngineTest {
    @get:Rule val temp = TemporaryFolder()
    private fun store() = PendingSnapshotStore(temp.root, KeyGenerator.getInstance("AES").apply { init(256) }.generateKey(), 1024)
    private class Source : NativeSessionSource {
        var identity: SessionIdentity? = SessionIdentity("user_abc", "sess_a")
        var ready = true
        var calls = 0
        override suspend fun waitUntilReady(): Boolean { calls++; return ready }
        override fun currentIdentity() = identity
        override suspend fun refreshToken() = "test.token"
    }

    @Test fun `does not request a session when nothing is pending`() = runBlocking {
        val source = Source()
        val result = BackupWorkerEngine(store(), NativeSessionProvider(source)).run { _, _ -> fail("unexpected upload"); BackupTransportResult.CONFIRMED }
        assertEquals(BackupWorkOutcome.NOTHING_PENDING, result)
        assertEquals(0, source.calls)
    }

    @Test fun `keeps data when signed out or another account is active`() = runBlocking {
        val store = store(); store.write("user_abc", 1, byteArrayOf(1))
        val source = Source().apply { identity = null }
        val engine = BackupWorkerEngine(store, NativeSessionProvider(source))
        assertEquals(BackupWorkOutcome.AUTH_REQUIRED, engine.run { _, _ -> fail("unexpected upload"); BackupTransportResult.CONFIRMED })
        source.identity = SessionIdentity("user_other", "sess_b")
        assertEquals(BackupWorkOutcome.ACCOUNT_MISMATCH, engine.run { _, _ -> fail("unexpected upload"); BackupTransportResult.CONFIRMED })
        assertNotNull(store.read())
    }

    @Test fun `retries network failures and protects a newer pending revision`() = runBlocking {
        val store = store(); store.write("user_abc", 1, byteArrayOf(1))
        val engine = BackupWorkerEngine(store, NativeSessionProvider(Source()))
        assertEquals(BackupWorkOutcome.RETRY, engine.run { _, _ -> error("network") })
        assertNotNull(store.read())
        val result = engine.run { _, token -> assertEquals("test.token", token()); store.write("user_abc", 2, byteArrayOf(2)); BackupTransportResult.CONFIRMED }
        assertEquals(BackupWorkOutcome.NEWER_PENDING, result)
        assertEquals(2L, store.read()!!.revision)
        assertEquals(BackupWorkOutcome.CONFIRMED, engine.run { _, token -> token(); BackupTransportResult.CONFIRMED })
        assertNull(store.read())
    }

    @Test fun `stops when the active account changes during transport`() = runBlocking {
        val store = store(); store.write("user_abc", 1, byteArrayOf(1))
        val source = Source()
        val engine = BackupWorkerEngine(store, NativeSessionProvider(source))
        val result = engine.run { _, token ->
            token()
            source.identity = SessionIdentity("user_other", "sess_b")
            token()
            BackupTransportResult.CONFIRMED
        }
        assertEquals(BackupWorkOutcome.RETRY, result)
        assertNotNull(store.read())
    }

    @Test fun `reports corrupt storage and propagates cancellation without deletion`() = runBlocking {
        val store = store(); store.write("user_abc", 1, byteArrayOf(1))
        val engine = BackupWorkerEngine(store, NativeSessionProvider(Source()))
        assertThrows(CancellationException::class.java) { runBlocking { engine.run { _, _ -> throw CancellationException() } } }
        assertNotNull(store.read())
        val file = temp.root.resolve("pending.snapshot")
        val bytes = file.readBytes(); bytes[bytes.lastIndex] = (bytes.last().toInt() xor 1).toByte(); file.writeBytes(bytes)
        assertEquals(BackupWorkOutcome.STORAGE_ERROR, engine.run { _, _ -> fail("unexpected upload"); BackupTransportResult.CONFIRMED })
        assertTrue(file.exists())
    }

    @Test fun `keeps the snapshot and distinguishes permanent conflicts from retryable failures`() = runBlocking {
        val store = store(); store.write("user_abc", 1, byteArrayOf(1))
        val engine = BackupWorkerEngine(store, NativeSessionProvider(Source()))
        assertEquals(BackupWorkOutcome.CONFLICT, engine.run { _, _ -> BackupTransportResult.CONFLICT })
        assertEquals(BackupWorkOutcome.AUTH_REQUIRED, engine.run { _, _ -> BackupTransportResult.AUTH_REQUIRED })
        assertEquals(BackupWorkOutcome.ACCESS_DENIED, engine.run { _, _ -> BackupTransportResult.ACCESS_DENIED })
        assertEquals(BackupWorkOutcome.INVALID, engine.run { _, _ -> BackupTransportResult.INVALID })
        assertNotNull(store.read())
    }
}
