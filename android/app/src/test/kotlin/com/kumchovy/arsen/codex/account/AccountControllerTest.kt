package com.kumchovy.arsen.codex.account

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class AccountControllerTest {
    private class FakeAuth : AccountAuth {
        var email: String? = null
        var result = AuthenticationResult.COMPLETE
        var attempts = 0
        override suspend fun currentEmail() = email
        override suspend fun signIn(email: String, password: String): AuthenticationResult {
            attempts++
            if (result == AuthenticationResult.COMPLETE) this.email = email
            return result
        }
        override suspend fun verify(): AuthenticationResult { email = "test@example.test"; return AuthenticationResult.COMPLETE }
        override suspend fun signOut() { email = null }
    }

    @Test fun `validates credentials before invoking Clerk`() = runBlocking {
        val auth = FakeAuth()
        val controller = AccountController(auth)
        assertThrows(IllegalArgumentException::class.java) { runBlocking { controller.signIn("", "secret") } }
        assertThrows(IllegalArgumentException::class.java) { runBlocking { controller.signIn("a@example.test", "") } }
        assertEquals(0, auth.attempts)
        assertEquals("signed-in", controller.signIn(" test@example.test ", "secret").status)
        assertEquals("test@example.test", controller.state().email)
    }

    @Test fun `does not treat an incomplete sign in as a session`() = runBlocking {
        val auth = FakeAuth().apply { result = AuthenticationResult.VERIFICATION_REQUIRED }
        val controller = AccountController(auth)
        assertEquals("verification-required", controller.signIn("test@example.test", "secret").status)
        assertEquals("signed-out", controller.state().status)
        assertEquals("signed-in", controller.verify().status)
        controller.signOut()
        assertEquals("signed-out", controller.state().status)
    }

    @Test fun `does not replace an existing session through sign in`() = runBlocking {
        val auth = FakeAuth().apply { email = "first@example.test" }
        val controller = AccountController(auth)
        assertThrows(IllegalStateException::class.java) { runBlocking { controller.signIn("other@example.test", "secret") } }
        assertEquals(0, auth.attempts)
        assertEquals("first@example.test", controller.state().email)
    }

    @Test fun `does not report successful sign in without an active session`() = runBlocking {
        val auth = FakeAuth().apply { result = AuthenticationResult.COMPLETE }
        val controller = AccountController(object : AccountAuth by auth {
            override suspend fun currentEmail(): String? = null
        })
        assertThrows(IllegalStateException::class.java) { runBlocking { controller.signIn("test@example.test", "secret") } }
        Unit
    }
}
