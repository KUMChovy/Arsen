package com.kumchovy.arsen.codex.backup

import com.kumchovy.arsen.codex.account.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class BackupContextTest {
    private val device = "67c5f68b-13e4-48e7-9a64-2dc6dc68d905"
    private val backup = "8166d21c-bac3-497b-9d22-8492474c982b"
    private class Source : NativeSessionSource {
        var identity: SessionIdentity? = SessionIdentity("user_abc", "session_a")
        override suspend fun waitUntilReady() = true
        override fun currentIdentity() = identity
        override suspend fun refreshToken() = "test.token"
    }
    private class Api : BackupContextApi {
        val calls = mutableListOf<String>()
        var latest = BackupHttpResponse(404, "")
        var registered = 200
        var activated = 200
        var onGet: () -> Unit = {}
        var onActivate: () -> Unit = {}
        override suspend fun register(token: String, deviceId: String): BackupHttpResponse {
            calls.add("register:$token:$deviceId")
            return BackupHttpResponse(registered, """{"id":"$deviceId"}""")
        }
        override suspend fun latest(token: String): BackupHttpResponse { calls.add("latest:$token"); onGet(); return latest }
        override suspend fun activate(token: String): BackupHttpResponse { calls.add("activate:$token"); onActivate(); if (activated == 200) registered = 200; return BackupHttpResponse(activated, "") }
    }
    @Test fun `registers device and fetches latest base for the authenticated owner`() = runBlocking {
        val api = Api().apply { latest = BackupHttpResponse(200, """{"backup":{"id":"$backup","deviceId":"$device","localRevision":4,"contractVersion":1,"sizeBytes":500,"includesHealth":false,"confirmedAt":"2026-11-23T12:00:00.000Z"}}""") }
        val result = BackupContext(NativeSessionProvider(Source()), api).prepare(device)
        assertEquals(BackupContextStatus.READY, result.status); assertEquals(device, result.deviceId)
        assertEquals(backup, result.baseBackupId); assertEquals("user_abc", result.owner)
        assertEquals(500L, result.summary!!.sizeBytes)
        assertEquals(2, api.calls.size)
    }
    @Test fun `empty remote history is allowed but invalid responses and account changes are not`() = runBlocking {
        val api = Api(); val source = Source(); val context = BackupContext(NativeSessionProvider(source), api)
        assertNull(context.prepare(device).baseBackupId)
        api.latest = BackupHttpResponse(200, """{"backup":{"id":"invalid"}}""")
        assertEquals(BackupContextStatus.INVALID, context.prepare(device).status)
        api.latest = BackupHttpResponse(404, ""); api.onGet = { source.identity = SessionIdentity("user_other", "session_b") }
        assertEquals(BackupContextStatus.ACCOUNT_CHANGED, context.prepare(device).status)
    }
    @Test fun `activates an invited account after a forbidden device registration and retries`() = runBlocking {
        val api = Api().apply { registered = 403 }
        val result = BackupContext(NativeSessionProvider(Source()), api).prepare(device)
        assertEquals(BackupContextStatus.READY, result.status)
        assertTrue(api.calls[1].startsWith("activate:"))
        assertTrue(api.calls[2].startsWith("register:"))
    }
    @Test fun `does not retry registration when invitation activation fails`() = runBlocking {
        val api = Api().apply { registered = 403; activated = 403 }
        assertEquals(BackupContextStatus.UNAVAILABLE, BackupContext(NativeSessionProvider(Source()), api).prepare(device).status)
        assertEquals(2, api.calls.size)
    }
    @Test fun `does not register a device if the account changes during activation`() = runBlocking {
        val source = Source()
        val api = Api().apply { registered = 403; onActivate = { source.identity = SessionIdentity("user_other", "session_b") } }
        assertEquals(BackupContextStatus.ACCOUNT_CHANGED, BackupContext(NativeSessionProvider(source), api).prepare(device).status)
        assertEquals(2, api.calls.size)
    }
}
