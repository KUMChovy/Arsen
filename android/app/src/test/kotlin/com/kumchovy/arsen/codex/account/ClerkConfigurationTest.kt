package com.kumchovy.arsen.codex.account

import org.junit.Assert.*
import org.junit.Test

class ClerkConfigurationTest {
    @Test fun `does not initialize when there is no public key`() {
        var called = false
        assertFalse(initializeClerkIfConfigured("") { called = true })
        assertFalse(called)
    }

    @Test fun `initializes with a valid public key and rejects secret or malformed keys`() {
        val key = "pk_test_ABCdef123"
        var received: String? = null
        assertTrue(initializeClerkIfConfigured(key) { received = it })
        assertEquals(key, received)
        assertThrows(IllegalArgumentException::class.java) { initializeClerkIfConfigured("sk_test_secret") { fail("unexpected initialization") } }
        assertThrows(IllegalArgumentException::class.java) { initializeClerkIfConfigured("pk_test_\"bad") { fail("unexpected initialization") } }
    }
}
