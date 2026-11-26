package com.kumchovy.arsen.codex.backup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZonedDateTime

class ManualBackupReminderTest {
    @Test fun schedulesForEightInLocalTimeAndNeverOnAnotherDate() {
        val morning = ZonedDateTime.parse("2026-11-25T10:00:00-06:00[America/Mexico_City]")
        assertEquals(10 * 60 * 60 * 1000L, manualReminderDelay(morning, "2026-11-25"))
        assertEquals(0L, manualReminderDelay(morning.withHour(21), "2026-11-25"))
        assertNull(manualReminderDelay(morning, "2026-11-24"))
        assertNull(manualReminderDelay(morning, "not-a-date"))
    }
    @Test fun ignoresLateOrPrematureDeliveries() {
        val now = ZonedDateTime.parse("2026-11-25T20:10:00-06:00[America/Mexico_City]")
        assertTrue(shouldDeliverManualReminder(now, "2026-11-25"))
        assertFalse(shouldDeliverManualReminder(now.plusDays(1), "2026-11-25"))
        assertFalse(shouldDeliverManualReminder(now.withHour(19), "2026-11-25"))
    }
}
