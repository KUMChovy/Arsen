package com.kumchovy.arsen.codex.backup

import java.security.MessageDigest
import javax.crypto.KeyGenerator
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class PendingEquivalentTest {
    @get:Rule val temp = TemporaryFolder()
    private fun hash(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 255) }
    @Test fun `records verified equivalence without fabricating a confirmed revision`() {
        val store = PendingSnapshotStore(temp.root, KeyGenerator.getInstance("AES").apply { init(256) }.generateKey(), 4096)
        val manifest = """{"version":1,"tables":{"settings":[{"storagePersisted":null}],"workoutSessions":[]},"assets":[],"health":[]}"""
        val originalId = "8166d21c-bac3-497b-9d22-8492474c982b"
        val canonicalId = "0d788ece-c86a-4af8-9c99-38efb1662f0a"
        val bytes = buildJsonObject {
            put("version", 1); put("backupId", originalId); put("deviceId", "67c5f68b-13e4-48e7-9a64-2dc6dc68d905")
            put("baseBackupId", JsonNull); put("revision", 8); put("manifest", manifest); put("manifestSha256", hash(manifest.toByteArray()))
            put("includesHealth", false); put("healthConsent", false); put("sizeBytes", manifest.toByteArray().size); putJsonArray("binaries") {}
        }.toString().toByteArray()
        store.write("user_abc", 8, bytes)
        val snapshot = store.beginSubmission()!!
        val reconfirmedFrom = "c535e624-6166-4cc2-8858-17991596a999"
        assertTrue(store.recordEquivalent(snapshot, canonicalId, reconfirmedFrom))
        assertTrue(store.confirmSubmission(snapshot))
        assertNull(store.read())
        assertNull(store.readConfirmed())
        assertEquals(canonicalId, decodePendingEnvelope(store.readEquivalent()!!, 4096).backupId)
        assertEquals(reconfirmedFrom, decodePendingEnvelope(store.readEquivalent()!!, 4096).baseBackupId)
        assertEquals(8L, store.readEquivalent()!!.revision)
    }
}
