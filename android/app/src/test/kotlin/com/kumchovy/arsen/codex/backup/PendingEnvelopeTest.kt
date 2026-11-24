package com.kumchovy.arsen.codex.backup

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.security.MessageDigest

class PendingEnvelopeTest {
    private val backupId = "8166d21c-bac3-497b-9d22-8492474c982b"
    private val deviceId = "67c5f68b-13e4-48e7-9a64-2dc6dc68d905"
    private val image = byteArrayOf(1, 2, 3, 4)
    private fun sha(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun manifest(healthInSession: Boolean = false, deviceSetting: Boolean = false) = buildJsonObject {
        put("version", 1)
        putJsonObject("tables") {
            putJsonArray("settings") { add(buildJsonObject { put("storagePersisted", JsonNull); if (deviceSetting) put("notificationPermission", "granted") }) }
            putJsonArray("workoutSessions") { if (healthInSession) add(buildJsonObject { put("health", true) }) }
        }
        putJsonArray("assets") { add(buildJsonObject { put("id", "image"); put("sha256", sha(image)) }) }
        putJsonArray("health") {}
    }.toString()
    private fun envelope(manifest: String = manifest(), base64: String = "AQIDBA==", revision: Long = 8, duplicate: Boolean = false) = buildJsonObject {
        put("version", 1); put("backupId", backupId); put("deviceId", deviceId); put("baseBackupId", JsonNull); put("revision", revision)
        put("manifest", manifest); put("manifestSha256", sha(manifest.toByteArray())); put("includesHealth", false); put("healthConsent", false)
        put("sizeBytes", manifest.toByteArray().size + image.size)
        putJsonArray("binaries") {
            add(buildJsonObject { put("id", "image"); put("base64", base64) })
            if (duplicate) add(buildJsonObject { put("id", "image"); put("base64", base64) })
        }
    }.toString().toByteArray()
    private fun snapshot(payload: ByteArray, revision: Long = 8) = PendingSnapshot("user_abc", revision, payload, sha(payload))

    @Test fun `decodes the same bounded envelope used by the web client`() {
        val decoded = decodePendingEnvelope(snapshot(envelope()), 4096)
        assertEquals(backupId, decoded.backupId)
        assertEquals(deviceId, decoded.deviceId)
        assertEquals(8L, decoded.revision)
        assertEquals("image", decoded.binaries.single().id)
        assertArrayEquals(image, decoded.binaries.single().bytes)
    }

    @Test fun `rejects changed bytes duplicate components and mismatched revisions`() {
        assertThrows(Exception::class.java) { decodePendingEnvelope(snapshot(envelope(base64 = "AQIDBQ==")), 4096) }
        assertThrows(Exception::class.java) { decodePendingEnvelope(snapshot(envelope(duplicate = true)), 4096) }
        assertThrows(Exception::class.java) { decodePendingEnvelope(snapshot(envelope(revision = 9)), 4096) }
        assertThrows(Exception::class.java) { decodePendingEnvelope(snapshot(envelope(base64 = "AQIDBA")), 4096) }
        assertThrows(Exception::class.java) { decodePendingEnvelope(snapshot(envelope()), 10) }
    }

    @Test fun `rejects health hidden in sessions and device permissions`() {
        assertThrows(Exception::class.java) { decodePendingEnvelope(snapshot(envelope(manifest = manifest(healthInSession = true))), 4096) }
        assertThrows(Exception::class.java) { decodePendingEnvelope(snapshot(envelope(manifest = manifest(deviceSetting = true))), 4096) }
    }
}
