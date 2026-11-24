package com.kumchovy.arsen.codex.backup

import java.net.URLEncoder
import java.security.MessageDigest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class NativeBackupTransportTest {
    private val backupId = "8166d21c-bac3-497b-9d22-8492474c982b"
    private val deviceId = "67c5f68b-13e4-48e7-9a64-2dc6dc68d905"
    private val owner = "user_abc"
    private val asset = byteArrayOf(1, 2, 3, 4)
    private fun sha(value: String) = MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun envelope() = PendingEnvelope(backupId, deviceId, null, 8, "{}", "a".repeat(64), false, false, 6, listOf(EnvelopeBinary("image", asset)))

    private inner class FakeHttp : BackupHttp {
        val calls = mutableListOf<String>()
        val tokens = mutableListOf<String>()
        val payloads = mutableListOf<ByteArray>()
        var prepareState = "pending"
        var uploadStatus = 200
        var reserveStatus = 200
        var confirmationStatus = 200
        var forcedStatus: Int? = null
        var badUrl = false
        private fun signed(path: String): String {
            if (badUrl) return "https://evil.example/upload"
            return "https://vercel.com/api/blob/?pathname=${URLEncoder.encode(path, "UTF-8")}&vercel-blob-delegation=a&vercel-blob-signature=b"
        }
        override suspend fun post(path: String, token: String, body: String): BackupHttpResponse {
            calls.add(path); tokens.add(token)
            forcedStatus?.let { return BackupHttpResponse(it, "") }
            val root = "backups/${sha(owner)}/$backupId"
            return when (path) {
                "/api/v1/backups" -> BackupHttpResponse(201, """{"id":"$backupId","state":"$prepareState","localRevision":8,"deviceId":"$deviceId"}""")
                "/api/v1/backups/manifest-upload" -> BackupHttpResponse(200, buildJsonObject { put("url", signed("$root/manifest")) }.toString())
                "/api/v1/backups/reserve" -> BackupHttpResponse(reserveStatus, "{}")
                "/api/v1/backups/asset-upload" -> BackupHttpResponse(200, buildJsonObject { put("url", signed("$root/assets/${sha("image")}")) }.toString())
                "/api/v1/backups/confirm" -> BackupHttpResponse(confirmationStatus, """{"id":"$backupId"}""")
                else -> error("unexpected path")
            }
        }
        override suspend fun put(url: String, mimeType: String, bytes: ByteArray): Int {
            calls.add("PUT:$mimeType"); payloads.add(bytes.copyOf()); return uploadStatus
        }
    }

    @Test fun `prepares uploads verifies and confirms with fresh tokens`() = runBlocking {
        val http = FakeHttp(); var tokenCalls = 0
        val result = NativeBackupTransport(http).submit(owner, envelope()) { tokenCalls++; "test.token" }
        assertEquals(BackupTransportResult.CONFIRMED, result)
        assertEquals(listOf("/api/v1/backups", "/api/v1/backups/manifest-upload", "PUT:application/json", "/api/v1/backups/reserve", "/api/v1/backups/asset-upload", "PUT:application/octet-stream", "/api/v1/backups/confirm"), http.calls)
        assertEquals(5, tokenCalls)
        assertTrue(http.tokens.all { it == "test.token" })
        assertArrayEquals("{}".toByteArray(), http.payloads[0])
        assertArrayEquals(asset, http.payloads[1])
    }

    @Test fun `checks server confirmation after a repeated immutable upload`() = runBlocking {
        val http = FakeHttp().apply { uploadStatus = 400 }
        assertEquals(BackupTransportResult.CONFIRMED, NativeBackupTransport(http).submit(owner, envelope()) { "test.token" })
        assertEquals("/api/v1/backups/confirm", http.calls.last())
        http.calls.clear(); http.confirmationStatus = 409
        assertEquals(BackupTransportResult.CONFLICT, NativeBackupTransport(http).submit(owner, envelope()) { "test.token" })
        http.calls.clear(); http.reserveStatus = 400
        assertEquals(BackupTransportResult.INVALID, NativeBackupTransport(http).submit(owner, envelope()) { "test.token" })
        assertFalse(http.calls.contains("/api/v1/backups/confirm"))
    }

    @Test fun `rejects untrusted upload URLs and distinguishes authorization failures`() = runBlocking {
        val http = FakeHttp().apply { badUrl = true }
        assertEquals(BackupTransportResult.INVALID, NativeBackupTransport(http).submit(owner, envelope()) { "test.token" })
        assertTrue(http.payloads.isEmpty())
        for ((status, expected) in listOf(401 to BackupTransportResult.AUTH_REQUIRED, 403 to BackupTransportResult.ACCESS_DENIED, 409 to BackupTransportResult.CONFLICT, 503 to BackupTransportResult.RETRY)) {
            http.forcedStatus = status
            assertEquals(expected, NativeBackupTransport(http).submit(owner, envelope()) { "test.token" })
        }
    }

    @Test fun `recognizes an already confirmed version and propagates cancellation`() = runBlocking {
        val http = FakeHttp().apply { prepareState = "confirmed" }
        assertEquals(BackupTransportResult.CONFIRMED, NativeBackupTransport(http).submit(owner, envelope()) { "test.token" })
        assertEquals(listOf("/api/v1/backups"), http.calls)
        assertThrows(CancellationException::class.java) { runBlocking { NativeBackupTransport(http).submit(owner, envelope()) { throw CancellationException() } } }
        Unit
    }
}
