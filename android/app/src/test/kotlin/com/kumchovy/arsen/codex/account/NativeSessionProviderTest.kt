package com.kumchovy.arsen.codex.account

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class NativeSessionProviderTest {
    private class Source : NativeSessionSource {
        var ready = true
        var identity: SessionIdentity? = SessionIdentity("user_a", "sess_a")
        var token: String? = "token-de-prueba"
        var onToken: () -> Unit = {}
        override suspend fun waitUntilReady() = ready
        override fun currentIdentity() = identity
        override suspend fun refreshToken(): String? { onToken(); return token }
    }

    @Test fun `requires initialization an active identity and a refreshed token`() = runBlocking {
        val source = Source()
        val provider = NativeSessionProvider(source)
        source.ready = false
        assertEquals(SessionResult.UNAVAILABLE, provider.get().result)
        source.ready = true; source.identity = null
        assertEquals(SessionResult.SIGNED_OUT, provider.get().result)
        source.identity = SessionIdentity("user_a", "sess_a"); source.token = null
        assertEquals(SessionResult.UNAVAILABLE, provider.get().result)
        source.token = "token\r\ninjected"
        assertEquals(SessionResult.UNAVAILABLE, provider.get().result)
    }

    @Test fun `refuses tokens when the session changes and keeps tokens out of diagnostics`() = runBlocking {
        val source = Source()
        val provider = NativeSessionProvider(source)
        source.onToken = { source.identity = SessionIdentity("user_b", "sess_b") }
        assertEquals(SessionResult.UNAVAILABLE, provider.get().result)
        source.identity = SessionIdentity("user_a", "sess_a"); source.onToken = {}
        val response = provider.get()
        assertEquals(SessionResult.READY, response.result)
        assertEquals("user_a", response.owner)
        assertEquals("token-de-prueba", response.token)
        assertFalse(response.toString().contains("token-de-prueba"))
    }
}
