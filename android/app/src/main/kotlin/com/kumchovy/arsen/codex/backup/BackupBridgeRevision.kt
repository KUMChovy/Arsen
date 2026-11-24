package com.kumchovy.arsen.codex.backup

fun backupBridgeRevision(value: Any?): Long? {
    val revision = when (value) {
        is Int -> value.toLong()
        is Long -> value
        is Double -> if (value.isFinite() && value >= 0 && value <= 9007199254740991.0 && value % 1.0 == 0.0) value.toLong() else return null
        else -> return null
    }
    return revision.takeIf { it in 0..9007199254740991L }
}
