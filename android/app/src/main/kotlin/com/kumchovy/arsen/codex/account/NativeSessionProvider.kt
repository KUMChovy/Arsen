package com.kumchovy.arsen.codex.account

import kotlinx.coroutines.CancellationException

data class SessionIdentity(val owner: String, val sessionId: String)
enum class SessionResult { READY, SIGNED_OUT, UNAVAILABLE }

class NativeSession(val result: SessionResult, val owner: String? = null, val token: String? = null) {
    override fun toString() = "NativeSession(result=$result)"
}

interface NativeSessionSource {
    suspend fun waitUntilReady(): Boolean
    fun currentIdentity(): SessionIdentity?
    suspend fun refreshToken(): String?
}

class NativeSessionProvider(private val source: NativeSessionSource) {
    suspend fun getLocal(): NativeSession = try {
        if (!source.waitUntilReady()) NativeSession(SessionResult.UNAVAILABLE)
        else {
            val identity = source.currentIdentity()
            if (identity == null) NativeSession(SessionResult.SIGNED_OUT)
            else if (!Regex("^user_[A-Za-z0-9]{1,123}$").matches(identity.owner) || identity.sessionId.isBlank() || identity != source.currentIdentity()) NativeSession(SessionResult.UNAVAILABLE)
            else NativeSession(SessionResult.READY, identity.owner)
        }
    } catch (cancelled: CancellationException) { throw cancelled }
    catch (_: Exception) { NativeSession(SessionResult.UNAVAILABLE) }

    suspend fun get(): NativeSession = try {
        if (!source.waitUntilReady()) NativeSession(SessionResult.UNAVAILABLE)
        else {
            val identity = source.currentIdentity()
            if (identity == null) NativeSession(SessionResult.SIGNED_OUT)
            else {
                val token = source.refreshToken()
                if (token.isNullOrBlank() || token.length > 16384 || token.any { it <= ' ' || it >= '\u007f' } || identity != source.currentIdentity()) NativeSession(SessionResult.UNAVAILABLE)
                else NativeSession(SessionResult.READY, identity.owner, token)
            }
        }
    } catch (cancelled: CancellationException) { throw cancelled }
    catch (_: Exception) { NativeSession(SessionResult.UNAVAILABLE) }
}
