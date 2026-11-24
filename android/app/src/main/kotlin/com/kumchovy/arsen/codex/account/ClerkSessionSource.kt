package com.kumchovy.arsen.codex.account

import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.clerk.api.session.GetTokenOptions
import com.kumchovy.arsen.codex.BuildConfig
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull

class ClerkSessionSource : NativeSessionSource {
    override suspend fun waitUntilReady(): Boolean {
        if (BuildConfig.CLERK_PUBLISHABLE_KEY.isEmpty()) return false
        return withTimeoutOrNull(15_000) { Clerk.isInitialized.first { it } } ?: false
    }

    override fun currentIdentity(): SessionIdentity? {
        val session = Clerk.session ?: return null
        val user = session.user ?: return null
        return SessionIdentity(user.id, session.id)
    }

    override suspend fun refreshToken(): String? = withTimeoutOrNull(15_000) {
        when (val result = Clerk.auth.getToken(GetTokenOptions(skipCache = true))) {
            is ClerkResult.Success -> result.value
            is ClerkResult.Failure -> null
        }
    }
}
