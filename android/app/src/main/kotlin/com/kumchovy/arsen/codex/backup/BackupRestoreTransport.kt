package com.kumchovy.arsen.codex.backup

import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.MessageDigest
import java.net.URI
import java.net.URLDecoder
import kotlinx.serialization.json.*

interface BackupDownloadHttp {
    suspend fun authorize(token: String, body: String): BackupHttpResponse
    suspend fun download(url: String, maxBytes: Int): ByteArray
}
class BackupRestoreArchive(val manifest: ByteArray, val manifestSha256: String, val binaries: List<EnvelopeBinary>)

internal fun validBackupDownloadUrl(value: String, path: String, configuredOrigin: String): Boolean = try {
    val origin = URI(configuredOrigin)
    val uri = URI(value)
    val parameters = (uri.rawQuery ?: "").split('&').map {
        val pair = it.split('=', limit = 2)
        URLDecoder.decode(pair[0], "UTF-8") to URLDecoder.decode(pair.getOrElse(1) { "" }, "UTF-8")
    }.groupBy({ it.first }, { it.second })
    val validPath = Regex("^backups/[a-f0-9]{64}/[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/(manifest|assets/[a-f0-9]{64})$")
    origin.scheme == "https" && origin.host?.matches(Regex("^[a-z0-9-]+\\.private\\.blob\\.vercel-storage\\.com$")) == true &&
        origin.port == -1 && origin.userInfo == null && origin.rawPath == "" && origin.rawQuery == null && origin.rawFragment == null &&
        uri.scheme == "https" && uri.host == origin.host && uri.port in listOf(-1, 443) && uri.userInfo == null && uri.fragment == null &&
        validPath.matches(path) && uri.rawPath == "/$path" &&
        listOf("vercel-blob-delegation", "vercel-blob-signature").all { parameters[it]?.singleOrNull()?.isNotEmpty() == true }
} catch (_: Exception) { false }

class BackupRestoreTransport(private val http: BackupDownloadHttp, private val maxBytes: Int, private val privateOrigin: String) {
    private fun sha(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun hash(value: String) = sha(value.toByteArray(Charsets.UTF_8))

    suspend fun download(owner: String, backupId: String, token: suspend () -> String): BackupRestoreArchive {
        require(maxBytes in 1..(Int.MAX_VALUE - 2048))
        require(owner.matches(Regex("^user_[A-Za-z0-9]{1,123}$")) && backupId.matches(Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")))
        val root = "backups/${hash(owner)}/$backupId"
        suspend fun component(kind: String, id: String?, remaining: Int, expectedHash: String? = null): Pair<ByteArray, String> {
            val credential = token()
            require(credential.isNotEmpty() && credential.length <= 16384 && credential.all { it.code in 33..126 })
            val body = buildJsonObject { put("backupId", backupId); put("kind", kind); if (id != null) put("id", id) }
            val response = http.authorize(credential, body.toString())
            check(response.status == 200) { "Descarga no autorizada" }
            val metadata = Json.parseToJsonElement(response.body).jsonObject
            val url = metadata["url"]?.jsonPrimitive?.content ?: error("URL inválida")
            val expected = metadata["sha256"]?.jsonPrimitive?.content ?: error("Huella inválida")
            val size = metadata["sizeBytes"]?.jsonPrimitive?.intOrNull ?: error("Tamaño inválido")
            val path = if (id == null) "$root/manifest" else "$root/assets/${hash(id)}"
            check(expected.matches(Regex("^[a-f0-9]{64}$")) && (expectedHash == null || expected == expectedHash) && size in 1..remaining && validBackupDownloadUrl(url, path, privateOrigin)) { "Metadatos inválidos" }
            val bytes = http.download(url, size)
            check(bytes.size == size && sha(bytes) == expected) { "El archivo no coincide" }
            return bytes to expected
        }
        val (manifest, manifestHash) = component("manifest", null, minOf(maxBytes, 4 * 1024 * 1024))
        val text = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(manifest)).toString()
        val assets = Json.parseToJsonElement(text).jsonObject["assets"]?.jsonArray ?: error("Manifiesto inválido")
        check(assets.size <= 5000)
        val seen = mutableSetOf<String>()
        var remaining = maxBytes - manifest.size
        val binaries = assets.map { row ->
            val asset = row.jsonObject
            val id = asset["id"]?.jsonPrimitive?.content ?: error("Componente inválido")
            val expected = asset["sha256"]?.jsonPrimitive?.content ?: error("Componente inválido")
            check(id.isNotEmpty() && id.length <= 256 && seen.add(id) && remaining > 0)
            val (bytes) = component("asset", id, remaining, expected)
            remaining -= bytes.size
            EnvelopeBinary(id, bytes)
        }
        return BackupRestoreArchive(manifest, manifestHash, binaries)
    }
}
