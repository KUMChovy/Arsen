package com.kumchovy.arsen.codex.account

import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.clerk.api.signin.SignIn
import com.clerk.api.auth.HostedAuthMode
import kotlinx.coroutines.withTimeout

class ClerkAccountAuth : AccountAuth {
    private suspend fun ensureReady() { check(ClerkSessionSource().waitUntilReady()) { "Cuenta no disponible" } }

    override suspend fun currentEmail(): String? {
        ensureReady()
        return Clerk.session?.user?.primaryEmailAddress?.emailAddress
    }

    override suspend fun signIn(email: String, password: String): AuthenticationResult {
        ensureReady()
        return withTimeout(30_000) {
            when (val result = Clerk.auth.signInWithPassword { identifier = email; this.password = password }) {
                is ClerkResult.Success -> if (result.value.status == SignIn.Status.COMPLETE) AuthenticationResult.COMPLETE else AuthenticationResult.VERIFICATION_REQUIRED
                is ClerkResult.Failure -> error("No se pudo iniciar sesión")
            }
        }
    }

    override suspend fun verify(): AuthenticationResult {
        ensureReady()
        return when (Clerk.auth.startHostedAuth()) {
            is ClerkResult.Success -> AuthenticationResult.COMPLETE
            is ClerkResult.Failure -> error("No se completó la verificación")
        }
    }

    override suspend fun register(): AuthenticationResult {
        ensureReady()
        return when (Clerk.auth.startHostedAuth(mode = HostedAuthMode.SIGN_UP)) {
            is ClerkResult.Success -> AuthenticationResult.COMPLETE
            is ClerkResult.Failure -> error("No se completó el registro")
        }
    }

    override suspend fun signOut() {
        ensureReady()
        when (Clerk.auth.signOut()) {
            is ClerkResult.Success -> Unit
            is ClerkResult.Failure -> error("No se pudo cerrar sesión")
        }
    }
}
