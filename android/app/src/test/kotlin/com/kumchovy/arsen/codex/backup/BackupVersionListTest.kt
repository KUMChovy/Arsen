package com.kumchovy.arsen.codex.backup

import com.kumchovy.arsen.codex.account.NativeSessionProvider
import com.kumchovy.arsen.codex.account.NativeSessionSource
import com.kumchovy.arsen.codex.account.SessionIdentity
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class BackupVersionListTest {
    private class Source : NativeSessionSource {
        var identity: SessionIdentity? = SessionIdentity("user_abc", "sess_a")
        override suspend fun waitUntilReady() = true
        override fun currentIdentity() = identity
        override suspend fun refreshToken() = "test.token"
    }

    @Test fun `returns versions only when the account stays the same`() = runBlocking {
        val source = Source()
        val list = BackupVersionList(NativeSessionProvider(source)) { BackupHttpResponse(200, """{"backups":[]}""") }
        assertEquals("user_abc", list.load().owner)
        val changing = BackupVersionList(NativeSessionProvider(source)) {
            source.identity = SessionIdentity("user_other", "sess_b")
            BackupHttpResponse(200, """{"backups":[]}""")
        }
        assertThrows(Exception::class.java) { runBlocking { changing.load() } }
        Unit
    }

    @Test fun `rejects unavailable and malformed version lists`() = runBlocking {
        val sessions = NativeSessionProvider(Source())
        assertThrows(Exception::class.java) { runBlocking { BackupVersionList(sessions) { BackupHttpResponse(503, "") }.load() } }
        assertThrows(Exception::class.java) { runBlocking { BackupVersionList(sessions) { BackupHttpResponse(200, """{"backups":[{}]}""") }.load() } }
        Unit
    }

    @Test fun `only forwards version metadata to the web view`() = runBlocking {
        val list = BackupVersionList(NativeSessionProvider(Source())) { BackupHttpResponse(200, """{"backups":[{"id":"a","deviceId":"b","localRevision":1,"contractVersion":1,"sizeBytes":10,"includesHealth":false,"confirmedAt":"2026-11-23T12:00:00Z","token":"private"}]}""") }
        val result = list.load().backups.toString()
        assertFalse(result.contains("token"))
        assertFalse(result.contains("private"))
        assertTrue(result.contains("confirmedAt"))
    }

    @Test fun `activates an invited account before retrying a forbidden version lookup`() = runBlocking {
        var attempts = 0
        var activations = 0
        val list = BackupVersionList(NativeSessionProvider(Source()), activate = { activations++; BackupHttpResponse(200, "") }) {
            attempts++
            if (attempts == 1) BackupHttpResponse(403, "") else BackupHttpResponse(200, """{"backups":[]}""")
        }
        assertEquals("user_abc", list.load().owner)
        assertEquals(1, activations)
        assertEquals(2, attempts)
    }
    @Test fun `does not retry a version lookup after account changes during activation`() = runBlocking {
        val source = Source()
        var attempts = 0
        val list = BackupVersionList(NativeSessionProvider(source), activate = {
            source.identity = SessionIdentity("user_other", "sess_b")
            BackupHttpResponse(200, "")
        }) { attempts++; BackupHttpResponse(403, "") }
        assertThrows(Exception::class.java) { runBlocking { list.load() } }
        assertEquals(1, attempts)
    }
}
