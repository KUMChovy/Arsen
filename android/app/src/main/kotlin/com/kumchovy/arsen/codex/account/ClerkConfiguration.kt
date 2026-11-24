package com.kumchovy.arsen.codex.account

fun initializeClerkIfConfigured(key: String, initialize: (String) -> Unit): Boolean {
    if (key.isEmpty()) return false
    require(key.length <= 512 && Regex("^pk_(test|live)_[A-Za-z0-9_=-]+$").matches(key)) { "La clave pública de Clerk no es válida" }
    initialize(key)
    return true
}
