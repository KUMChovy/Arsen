package com.kumchovy.arsen.codex.backup

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class BackupReconcilerTest {
    private fun envelope(id: String, base: String?, revision: Long, device: String = "device") =
        PendingEnvelope(id, device, base, revision, "manifest", "hash", false, false, 1, emptyList())

    @Test fun `retries against own confirmed predecessor after checking remote head`() = runBlocking {
        val seen = mutableListOf<String?>()
        val confirmed = envelope("confirmed", "old", 4)
        val pending = envelope("pending", "old", 5)
        val result = reconcileBackup("user_a", pending, "user_a", confirmed, { "confirmed" }) {
            seen.add(it.baseBackupId)
            if (seen.size == 1) BackupTransportResult.CONFLICT else BackupTransportResult.CONFIRMED
        }
        assertEquals(BackupTransportResult.CONFIRMED, result)
        assertEquals(listOf("old", "confirmed"), seen)
    }

    @Test fun `does not rebase across accounts devices or a changed remote head`() = runBlocking {
        val confirmed = envelope("confirmed", "old", 4)
        for ((owner, device, remote) in listOf(Triple("user_b", "device", "confirmed"), Triple("user_a", "other", "confirmed"), Triple("user_a", "device", "foreign"))) {
            var attempts = 0
            val result = reconcileBackup("user_a", envelope("pending", "old", 5, device), owner, confirmed, { remote }) { attempts++; BackupTransportResult.CONFLICT }
            assertEquals(BackupTransportResult.CONFLICT, result)
            assertEquals(1, attempts)
        }
    }
}
