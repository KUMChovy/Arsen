package com.kumchovy.arsen.codex.backup

import com.kumchovy.arsen.codex.account.NativeSessionProvider
import com.kumchovy.arsen.codex.account.SessionResult
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.*
import java.time.Instant

interface BackupContextApi {
    suspend fun register(token: String, deviceId: String): BackupHttpResponse
    suspend fun latest(token: String): BackupHttpResponse
    suspend fun activate(token: String): BackupHttpResponse = BackupHttpResponse(403, "")
}
enum class BackupContextStatus { READY, SIGN_IN_REQUIRED, ACCOUNT_CHANGED, INVALID, UNAVAILABLE }
class BackupSummary(val id: String, val deviceId: String, val localRevision: Long, val contractVersion: Long, val sizeBytes: Long, val includesHealth: Boolean, val confirmedAt: String)
class BackupContextResult(val status: BackupContextStatus, val owner: String? = null, val deviceId: String? = null, val baseBackupId: String? = null, val summary: BackupSummary? = null)
private val contextUuid = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")

class BackupContext(private val sessions: NativeSessionProvider, private val api: BackupContextApi) {
    suspend fun prepare(deviceId: String): BackupContextResult {
        if (!contextUuid.matches(deviceId)) return BackupContextResult(BackupContextStatus.INVALID)
        try {
            val session = sessions.get()
            if (session.result == SessionResult.SIGNED_OUT) return BackupContextResult(BackupContextStatus.SIGN_IN_REQUIRED)
            if (session.result != SessionResult.READY || session.owner == null || session.token == null) return BackupContextResult(BackupContextStatus.UNAVAILABLE)
            var registration = api.register(session.token, deviceId)
            if (registration.status == 403) {
                if (api.activate(session.token).status != 200) return BackupContextResult(BackupContextStatus.UNAVAILABLE)
                val current = sessions.get()
                if (current.result != SessionResult.READY || current.token == null) return BackupContextResult(BackupContextStatus.UNAVAILABLE)
                if (current.owner != session.owner) return BackupContextResult(BackupContextStatus.ACCOUNT_CHANGED)
                registration = api.register(current.token, deviceId)
            }
            if (registration.status != 200) return BackupContextResult(BackupContextStatus.UNAVAILABLE)
            if (Json.parseToJsonElement(registration.body).jsonObject["id"]?.jsonPrimitive?.content != deviceId) return BackupContextResult(BackupContextStatus.INVALID)
            val refreshed = sessions.get()
            if (refreshed.result != SessionResult.READY || refreshed.token == null) return BackupContextResult(BackupContextStatus.UNAVAILABLE)
            if (refreshed.owner != session.owner) return BackupContextResult(BackupContextStatus.ACCOUNT_CHANGED)
            val response = api.latest(refreshed.token)
            val summary = when (response.status) {
                404 -> null
                200 -> {
                    val row = Json.parseToJsonElement(response.body).jsonObject["backup"]?.jsonObject ?: return BackupContextResult(BackupContextStatus.INVALID)
                    val id = row["id"]?.jsonPrimitive?.content?.takeIf { contextUuid.matches(it) } ?: return BackupContextResult(BackupContextStatus.INVALID)
                    val remoteDevice = row["deviceId"]?.jsonPrimitive?.content?.takeIf { contextUuid.matches(it) } ?: return BackupContextResult(BackupContextStatus.INVALID)
                    val revision = row["localRevision"]?.jsonPrimitive?.longOrNull?.takeIf { it in 0..9007199254740991L } ?: return BackupContextResult(BackupContextStatus.INVALID)
                    val version = row["contractVersion"]?.jsonPrimitive?.longOrNull?.takeIf { it in 1..9007199254740991L } ?: return BackupContextResult(BackupContextStatus.INVALID)
                    val size = row["sizeBytes"]?.jsonPrimitive?.longOrNull?.takeIf { it in 1..9007199254740991L } ?: return BackupContextResult(BackupContextStatus.INVALID)
                    val health = row["includesHealth"]?.jsonPrimitive?.takeIf { !it.isString }?.booleanOrNull ?: return BackupContextResult(BackupContextStatus.INVALID)
                    val confirmed = row["confirmedAt"]?.jsonPrimitive?.content ?: return BackupContextResult(BackupContextStatus.INVALID)
                    Instant.parse(confirmed)
                    BackupSummary(id, remoteDevice, revision, version, size, health, confirmed)
                }
                else -> return BackupContextResult(BackupContextStatus.UNAVAILABLE)
            }
            val final = sessions.get()
            if (final.result != SessionResult.READY) return BackupContextResult(BackupContextStatus.UNAVAILABLE)
            if (final.owner != session.owner) return BackupContextResult(BackupContextStatus.ACCOUNT_CHANGED)
            return BackupContextResult(BackupContextStatus.READY, session.owner, deviceId, summary?.id, summary)
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: IllegalArgumentException) { return BackupContextResult(BackupContextStatus.INVALID) }
        catch (_: Exception) { return BackupContextResult(BackupContextStatus.UNAVAILABLE) }
    }
}
