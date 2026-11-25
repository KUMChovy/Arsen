package com.kumchovy.arsen.codex.backup

import java.net.URI
import java.io.ByteArrayOutputStream
import javax.net.ssl.HttpsURLConnection
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

fun backupApiOrigin(value: String): String {
    val uri = try { URI(value) } catch (_: Exception) { throw IllegalArgumentException("Origen inválido") }
    require(uri.scheme == "https" && !uri.host.isNullOrEmpty() && uri.userInfo == null && uri.port in -1..65535 && uri.port != 0 && uri.rawQuery == null && uri.rawFragment == null && uri.rawPath in listOf("", "/")) { "Origen inválido" }
    return "https://${uri.host}${if (uri.port == -1) "" else ":${uri.port}"}"
}

fun isBackupApiPath(path: String) = path in setOf("/api/v1/backups", "/api/v1/backups/manifest-upload", "/api/v1/backups/reserve", "/api/v1/backups/asset-upload", "/api/v1/backups/confirm", "/api/v1/backups/download", "/api/v1/backups/reconfirm")
fun isBackupContextPostPath(path: String) = path in setOf("/api/v1/account/devices", "/api/v1/account/activate")
fun isBackupContextGetPath(path: String) = path in setOf("/api/v1/backups/latest", "/api/v1/backups")

class BackupHttpClient(origin: String, private val privateOrigin: String = "") : BackupHttp, BackupContextApi, BackupDownloadHttp {
    private val base = backupApiOrigin(origin)

    override suspend fun post(path: String, token: String, body: String): BackupHttpResponse = withContext(Dispatchers.IO) {
        require(isBackupApiPath(path) || isBackupContextPostPath(path))
        request(path, token, "POST", body)
    }

    override suspend fun register(token: String, deviceId: String): BackupHttpResponse =
        post("/api/v1/account/devices", token, kotlinx.serialization.json.buildJsonObject { put("id", kotlinx.serialization.json.JsonPrimitive(deviceId)) }.toString())

    override suspend fun activate(token: String): BackupHttpResponse = post("/api/v1/account/activate", token, "{}")

    override suspend fun latest(token: String): BackupHttpResponse = withContext(Dispatchers.IO) {
        val path = "/api/v1/backups/latest"
        require(isBackupContextGetPath(path))
        request(path, token, "GET", null)
    }

    suspend fun list(token: String): BackupHttpResponse = withContext(Dispatchers.IO) {
        val path = "/api/v1/backups"
        require(isBackupContextGetPath(path))
        request(path, token, "GET", null)
    }

    override suspend fun authorize(token: String, body: String): BackupHttpResponse = post("/api/v1/backups/download", token, body)

    override suspend fun download(url: String, maxBytes: Int): ByteArray = withContext(Dispatchers.IO) {
        require(maxBytes in 1..MAX_PENDING_BACKUP_BYTES)
        val uri = URI(url)
        require(validBackupDownloadUrl(url, uri.rawPath.removePrefix("/"), privateOrigin))
        val connection = uri.toURL().openConnection() as HttpsURLConnection
        try {
            configure(connection, "GET", "application/octet-stream")
            check(connection.responseCode == 200) { "Descarga no disponible" }
            connection.inputStream.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    check(output.size() <= maxBytes - count) { "Descarga demasiado grande" }
                    output.write(buffer, 0, count)
                }
                output.toByteArray()
            }
        } finally { connection.disconnect() }
    }

    private fun request(path: String, token: String, method: String, body: String?): BackupHttpResponse {
        require(token.isNotEmpty() && token.length <= 16384 && token.all { it.code in 33..126 })
        val connection = URI(base + path).toURL().openConnection() as HttpsURLConnection
        try {
            configure(connection, method, "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")
            if (body != null) connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val bytes = stream?.use { input ->
                val buffer = ByteArray(4096)
                val output = ByteArrayOutputStream()
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    require(output.size() + count <= 65536) { "Respuesta demasiado grande" }
                    output.write(buffer, 0, count)
                }
                output.toByteArray()
            } ?: byteArrayOf()
            return BackupHttpResponse(status, bytes.toString(Charsets.UTF_8))
        } finally { connection.disconnect() }
    }

    override suspend fun put(url: String, mimeType: String, bytes: ByteArray): Int = withContext(Dispatchers.IO) {
        val uri = URI(url)
        require(uri.scheme == "https" && uri.host == "vercel.com" && uri.port in listOf(-1, 443) && uri.userInfo == null && uri.fragment == null && uri.path in listOf("/api/blob", "/api/blob/") && mimeType in listOf("application/json", "application/octet-stream"))
        val connection = uri.toURL().openConnection() as HttpsURLConnection
        try {
            configure(connection, "PUT", mimeType)
            connection.setFixedLengthStreamingMode(bytes.size)
            connection.outputStream.use { it.write(bytes) }
            connection.responseCode
        } finally { connection.disconnect() }
    }

    private fun configure(connection: HttpsURLConnection, method: String, contentType: String) {
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 15000
        connection.readTimeout = 15000
        connection.requestMethod = method
        connection.doOutput = method != "GET"
        connection.setRequestProperty("Content-Type", contentType)
        connection.setRequestProperty("Accept", "application/json")
        connection.useCaches = false
    }
}
