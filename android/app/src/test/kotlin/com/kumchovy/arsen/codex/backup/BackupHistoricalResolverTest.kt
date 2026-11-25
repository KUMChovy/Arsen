package com.kumchovy.arsen.codex.backup

import java.security.MessageDigest
import javax.crypto.KeyGenerator
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class BackupHistoricalResolverTest {
    @get:Rule val temp = TemporaryFolder()
    private fun hash(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 255) }
    @Test fun `records equivalence only after the server reconfirms the historical copy`() = runBlocking {
        val store = PendingSnapshotStore(temp.root, KeyGenerator.getInstance("AES").apply { init(256) }.generateKey(), 4096)
        val manifest = """{"version":1,"tables":{"settings":[{"storagePersisted":null}],"workoutSessions":[]},"assets":[],"health":[]}"""
        val historical = "0d788ece-c86a-4af8-9c99-38efb1662f0a"
        val payload = buildJsonObject {
            put("version", 1); put("backupId", "8166d21c-bac3-497b-9d22-8492474c982b"); put("deviceId", "67c5f68b-13e4-48e7-9a64-2dc6dc68d905")
            put("baseBackupId", "c535e624-6166-4cc2-8858-17991596a999"); put("revision", 8); put("manifest", manifest); put("manifestSha256", hash(manifest.toByteArray()))
            put("includesHealth", false); put("healthConsent", false); put("sizeBytes", manifest.toByteArray().size); putJsonArray("binaries") {}
        }.toString().toByteArray()
        store.write("user_abc", 8, payload)
        val snapshot = store.beginSubmission()!!
        val envelope = decodePendingEnvelope(snapshot, 4096)
        var response = BackupHttpResponse(409, "")
        val http = object : BackupHttp {
            override suspend fun post(path: String, token: String, body: String): BackupHttpResponse {
                assertEquals("/api/v1/backups/reconfirm", path)
                assertEquals(historical, Json.parseToJsonElement(body).jsonObject["backupId"]!!.jsonPrimitive.content)
                return response
            }
            override suspend fun put(url: String, mimeType: String, bytes: ByteArray) = error("unexpected upload")
        }
        val resolver = BackupHistoricalResolver(store, http)
        assertEquals(BackupTransportResult.CONFLICT, resolver.resolve(snapshot, historical, envelope) { "token" })
        assertNull(store.readEquivalent())
        val newerPayload = JsonObject(Json.parseToJsonElement(payload.toString(Charsets.UTF_8)).jsonObject + mapOf("backupId" to JsonPrimitive("f05c826e-7942-4b80-92c3-d94482b06290"), "revision" to JsonPrimitive(9))).toString().toByteArray()
        store.write("user_abc", 9, newerPayload)
        response = BackupHttpResponse(200, """{"id":"$historical"}""")
        assertEquals(BackupTransportResult.CONFIRMED, resolver.resolve(snapshot, historical, envelope) { "token" })
        assertTrue(store.confirmSubmission(snapshot))
        assertEquals(historical, decodePendingEnvelope(store.readEquivalent()!!, 4096).backupId)
        assertNull(store.readConfirmed())
        val next = store.beginSubmission()!!
        val predecessor = store.readEquivalent()!!
        var attempts = 0
        val result = reconcileBackup(next.owner, decodePendingEnvelope(next, 4096), predecessor.owner, decodePendingEnvelope(predecessor, 4096), { historical }) {
            attempts++
            if (attempts == 1) BackupTransportResult.CONFLICT else {
                assertEquals(historical, it.baseBackupId)
                BackupTransportResult.CONFIRMED
            }
        }
        assertEquals(BackupTransportResult.CONFIRMED, result)
        assertEquals(9L, next.revision)
    }
}
