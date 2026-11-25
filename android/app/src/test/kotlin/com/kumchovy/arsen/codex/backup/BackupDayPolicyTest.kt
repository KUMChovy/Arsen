package com.kumchovy.arsen.codex.backup

import java.time.Instant
import java.time.ZoneId
import org.junit.Assert.*
import org.junit.Test

class BackupDayPolicyTest {
    @Test fun `eligible copies precede the local day even across UTC midnight`() {
        val zone = ZoneId.of("America/Mexico_City")
        val now = Instant.parse("2026-05-04T09:00:00Z")
        assertTrue(backupEligibleOnLocalDay(Instant.parse("2026-05-04T05:59:59Z"), now, zone))
        assertFalse(backupEligibleOnLocalDay(Instant.parse("2026-05-04T06:00:00Z"), now, zone))
        assertFalse(backupEligibleOnLocalDay(Instant.parse("2026-05-04T10:00:00Z"), now, zone))
    }

    @Test fun `first automatic check targets the next local morning after three days`() {
        val now = java.time.ZonedDateTime.of(2026, 5, 1, 10, 0, 0, 0, ZoneId.of("America/Mexico_City"))
        val target = nextBackupCheck(now)
        assertEquals(java.time.LocalDate.of(2026, 5, 5), target.toLocalDate())
        assertEquals(3, target.hour)
        assertFalse(target.toInstant().isBefore(now.toInstant().plusSeconds(72 * 3600L)))
    }
}
