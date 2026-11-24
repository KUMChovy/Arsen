package com.kumchovy.arsen.codex.backup

import java.security.MessageDigest
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class BackupRestoreTransportTest {
    private val backupId = "8166d21c-bac3-497b-9d22-8492474c982b"
    private val owner = "user_abc"
    private val image = byteArrayOf(1, 2, 3)
    private fun sha(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun hash(text: String) = sha(text.toByteArray())
    private val origin = "https://example-store.private.blob.vercel-storage.com"
    private fun signed(path: String) = "$origin/$path?vercel-blob-delegation=a&vercel-blob-signature=b"
    private val manifest get() = buildJsonObject { putJsonArray("assets") { add(buildJsonObject { put("id", "image"); put("sha256", sha(image)) }) } }.toString().toByteArray()
    private inner class Api : BackupDownloadHttp {
        var badManifest = false
        var badAsset = false
        var badUrl = false
        var calls = 0
        override suspend fun authorize(token: String, body: String): BackupHttpResponse {
            calls++
            val kind = Json.parseToJsonElement(body).jsonObject["kind"]!!.jsonPrimitive.content
            val path = "backups/${hash(owner)}/$backupId/" + if (kind == "manifest") "manifest" else "assets/${hash("image")}"
            val bytes = if (kind == "manifest") manifest else image
            return BackupHttpResponse(200, buildJsonObject { put("url", if (badUrl) "https://evil.example" else signed(path)); put("sha256", sha(bytes)); put("sizeBytes", bytes.size) }.toString())
        }
        override suspend fun download(url: String, maxBytes: Int): ByteArray {
            val asset = url.contains("assets")
            val bytes = if (asset) image else manifest
            return if ((asset && badAsset) || (!asset && badManifest)) bytes.copyOf().also { it[0] = 0 } else bytes
        }
    }
    @Test fun `downloads and verifies manifest and all declared image bytes`() = runBlocking {
        val api = Api(); var tokens = 0
        val archive = BackupRestoreTransport(api, 4096, origin).download(owner, backupId) { tokens++; "token" }
        assertArrayEquals(manifest, archive.manifest); assertArrayEquals(image, archive.binaries.single().bytes)
        assertEquals(2, tokens); assertEquals(2, api.calls)
    }
    @Test fun `rejects tampering and untrusted signed URLs before accepting an archive`() = runBlocking {
        for (api in listOf(Api().apply { badManifest = true }, Api().apply { badAsset = true }, Api().apply { badUrl = true })) {
            assertThrows(Exception::class.java) { runBlocking { BackupRestoreTransport(api, 4096, origin).download(owner, backupId) { "token" } } }
        }
    }
    @Test fun `requires the configured private origin path and one set of signing parameters`() {
        val path = "backups/${hash(owner)}/$backupId/manifest"
        assertTrue(validBackupDownloadUrl(signed(path), path, origin))
        assertFalse(validBackupDownloadUrl(signed("different"), path, origin))
        assertFalse(validBackupDownloadUrl(signed(path).replace("example-store", "other-store"), path, origin))
        assertFalse(validBackupDownloadUrl(signed(path) + "&vercel-blob-signature=extra", path, origin))
        assertFalse(validBackupDownloadUrl(signed(path).replace("https://", "http://"), path, origin))
    }
}
