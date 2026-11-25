package com.kumchovy.arsen.codex.backup

import java.net.URI
import java.net.URLDecoder
import java.security.MessageDigest
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.*

class BackupHttpResponse(val status: Int, val body: String)
interface BackupHttp {
    suspend fun post(path: String, token: String, body: String): BackupHttpResponse
    suspend fun put(url: String, mimeType: String, bytes: ByteArray): Int
}

private fun hash(value: String) = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
private val backupUuid = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")

internal fun validBackupBlobUrl(value: String, path: String): Boolean = try {
    val uri = URI(value)
    val parameters = (uri.rawQuery ?: "").split('&').map {
        val pair = it.split('=', limit = 2)
        URLDecoder.decode(pair[0], "UTF-8") to URLDecoder.decode(pair.getOrElse(1) { "" }, "UTF-8")
    }.groupBy({ it.first }, { it.second })
    uri.scheme == "https" && uri.host == "vercel.com" && uri.port in listOf(-1, 443) &&
        uri.userInfo == null && uri.fragment == null && uri.path in listOf("/api/blob", "/api/blob/") &&
        parameters["pathname"] == listOf(path) && listOf("vercel-blob-delegation", "vercel-blob-signature").all { parameters[it]?.singleOrNull()?.isNotEmpty() == true }
} catch (_: Exception) { false }

class NativeBackupTransport(private val http: BackupHttp) {
    suspend fun submit(owner: String, envelope: PendingEnvelope, onHistorical: suspend (String, PendingEnvelope) -> BackupTransportResult = { _, _ -> BackupTransportResult.CONFLICT }, token: suspend () -> String): BackupTransportResult {
        try {
            suspend fun post(path: String, body: JsonObject): BackupHttpResponse {
                val credential = token()
                require(credential.isNotEmpty() && credential.length <= 16384 && credential.all { it.code in 33..126 })
                return http.post(path, credential, body.toString())
            }
            fun status(code: Int): BackupTransportResult = when (code) {
                401 -> BackupTransportResult.AUTH_REQUIRED
                403 -> BackupTransportResult.ACCESS_DENIED
                409 -> BackupTransportResult.CONFLICT
                429, in 500..599 -> BackupTransportResult.RETRY
                else -> BackupTransportResult.INVALID
            }
            fun json(response: BackupHttpResponse) = Json.parseToJsonElement(response.body).jsonObject
            val prepared = post("/api/v1/backups", buildJsonObject {
                put("deviceId", envelope.deviceId)
                putJsonObject("backup") {
                    put("id", envelope.backupId); put("contractVersion", 1); put("localRevision", envelope.revision)
                    if (envelope.baseBackupId == null) put("baseBackupId", JsonNull) else put("baseBackupId", envelope.baseBackupId)
                    put("manifestSha256", envelope.manifestSha256); put("sizeBytes", envelope.sizeBytes)
                    put("includesHealth", envelope.includesHealth); put("healthConsent", envelope.healthConsent)
                }
            })
            if (prepared.status !in 200..201) return status(prepared.status)
            val metadata = json(prepared)
            val id = metadata["id"]?.jsonPrimitive?.content ?: return BackupTransportResult.INVALID
            val state = metadata["state"]?.jsonPrimitive?.content
            if (!backupUuid.matches(id)) return BackupTransportResult.INVALID
            if (id != envelope.backupId || metadata["deviceId"]?.jsonPrimitive?.content != envelope.deviceId || metadata["localRevision"]?.jsonPrimitive?.longOrNull != envelope.revision) {
                if (state != "confirmed" || !backupUuid.matches(metadata["deviceId"]?.jsonPrimitive?.content.orEmpty()) || metadata["localRevision"]?.jsonPrimitive?.longOrNull?.let { it in 0..9007199254740991L } != true) return BackupTransportResult.CONFLICT
                return onHistorical(id, envelope)
            }
            if (state == "confirmed") return BackupTransportResult.CONFIRMED
            if (state != "pending") return BackupTransportResult.INVALID
            val root = "backups/${hash(owner)}/${id.lowercase()}"
            suspend fun confirm(): BackupTransportResult {
                val response = post("/api/v1/backups/confirm", buildJsonObject { put("backupId", id) })
                return if (response.status == 200 && json(response)["id"]?.jsonPrimitive?.content == id) BackupTransportResult.CONFIRMED else status(response.status)
            }
            suspend fun upload(endpoint: String, body: JsonObject, path: String, mime: String, bytes: ByteArray): BackupTransportResult? {
                val response = post(endpoint, body)
                if (response.status == 409) return confirm()
                if (response.status != 200) return status(response.status)
                val url = json(response)["url"]?.jsonPrimitive?.content ?: return BackupTransportResult.INVALID
                if (!validBackupBlobUrl(url, path)) return BackupTransportResult.INVALID
                val result = http.put(url, mime, bytes)
                return if (result in 200..299 || result == 400) null else status(result)
            }
            val manifest = envelope.manifest.toByteArray(Charsets.UTF_8)
            upload("/api/v1/backups/manifest-upload", buildJsonObject { put("backupId", id); put("sizeBytes", manifest.size) }, "$root/manifest", "application/json", manifest)?.let { return it }
            val reserved = post("/api/v1/backups/reserve", buildJsonObject {
                put("backupId", id)
                putJsonArray("components") { envelope.binaries.forEach { binary -> add(buildJsonObject { put("id", binary.id); put("sizeBytes", binary.bytes.size) }) } }
            })
            if (reserved.status == 409) return confirm()
            if (reserved.status != 200) return status(reserved.status)
            for (binary in envelope.binaries) {
                upload("/api/v1/backups/asset-upload", buildJsonObject { put("backupId", id); put("id", binary.id) }, "$root/assets/${hash(binary.id)}", "application/octet-stream", binary.bytes)?.let { return it }
            }
            return confirm()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: IllegalArgumentException) {
            return BackupTransportResult.INVALID
        } catch (_: Exception) {
            return BackupTransportResult.RETRY
        }
    }
}
