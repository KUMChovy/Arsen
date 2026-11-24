package com.kumchovy.arsen.codex.account

enum class AuthenticationResult { COMPLETE, VERIFICATION_REQUIRED }
data class AccountStatus(val status: String, val email: String? = null)

interface AccountAuth {
    suspend fun currentEmail(): String?
    suspend fun signIn(email: String, password: String): AuthenticationResult
    suspend fun verify(): AuthenticationResult
    suspend fun signOut()
}

class AccountController(private val auth: AccountAuth) {
    suspend fun state(): AccountStatus = auth.currentEmail()?.let { AccountStatus("signed-in", it) } ?: AccountStatus("signed-out")

    suspend fun signIn(email: String, password: String): AccountStatus {
        val identifier = email.trim()
        require(identifier.isNotEmpty() && identifier.length <= 320 && password.isNotEmpty() && password.length <= 1024)
        check(auth.currentEmail() == null) { "Ya hay una sesión activa" }
        return finish(auth.signIn(identifier, password))
    }

    suspend fun verify(): AccountStatus = finish(auth.verify())

    suspend fun signOut() = auth.signOut()

    private suspend fun finish(result: AuthenticationResult): AccountStatus {
        if (result == AuthenticationResult.VERIFICATION_REQUIRED) return AccountStatus("verification-required")
        val email = auth.currentEmail() ?: error("La sesión aún no está disponible")
        return AccountStatus("signed-in", email)
    }
}
