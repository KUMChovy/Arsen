package com.kumchovy.arsen.codex.backup

import kotlinx.serialization.json.*

class BackupHistoricalResolver(private val store: PendingSnapshotStore, private val http: BackupHttp) {
    suspend fun resolve(snapshot: PendingSnapshot, historicalId: String, requested: PendingEnvelope, token: suspend () -> String): BackupTransportResult {
        val base = requested.baseBackupId ?: return BackupTransportResult.CONFLICT
        val body = buildJsonObject { put("backupId", historicalId); put("baseBackupId", base); put("manifestSha256", requested.manifestSha256) }
        val response = http.post("/api/v1/backups/reconfirm", token(), body.toString())
        return when (response.status) {
            200 -> {
                val returned = Json.parseToJsonElement(response.body).jsonObject["id"]?.jsonPrimitive?.content
                if (returned != historicalId) BackupTransportResult.INVALID
                else if (store.recordEquivalent(snapshot, historicalId, base)) BackupTransportResult.CONFIRMED else BackupTransportResult.RETRY
            }
            401 -> BackupTransportResult.AUTH_REQUIRED
            403 -> BackupTransportResult.ACCESS_DENIED
            409 -> BackupTransportResult.CONFLICT
            429, in 500..599 -> BackupTransportResult.RETRY
            else -> BackupTransportResult.INVALID
        }
    }
}
