package com.kumchovy.arsen.codex.backup

import com.kumchovy.arsen.codex.account.NativeSessionProvider
import com.kumchovy.arsen.codex.account.SessionResult
import kotlinx.serialization.json.*

data class BackupVersionListResult(val owner: String, val backups: JsonArray)

class BackupVersionList(private val sessions: NativeSessionProvider, private val activate: suspend (String) -> BackupHttpResponse = { BackupHttpResponse(403, "") }, private val fetch: suspend (String) -> BackupHttpResponse) {
    suspend fun load(): BackupVersionListResult {
        val session = sessions.get()
        check(session.result == SessionResult.READY && session.owner != null && session.token != null)
        var response = fetch(session.token)
        if (response.status == 403) {
            check(activate(session.token).status == 200)
            val current = sessions.get()
            check(current.result == SessionResult.READY && current.owner == session.owner && current.token != null)
            response = fetch(current.token)
        }
        check(response.status == 200)
        val rows = Json.parseToJsonElement(response.body).jsonObject["backups"]!!.jsonArray
        check(rows.size <= 5)
        val fields = setOf("id", "deviceId", "localRevision", "contractVersion", "sizeBytes", "includesHealth", "confirmedAt")
        val safe = JsonArray(rows.map { element ->
            val row = element.jsonObject
            check(fields.all { row[it] is JsonPrimitive })
            JsonObject(row.filterKeys { it in fields })
        })
        val current = sessions.get()
        check(current.result == SessionResult.READY && current.owner == session.owner)
        return BackupVersionListResult(session.owner, safe)
    }
}
