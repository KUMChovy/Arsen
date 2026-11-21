package com.kumchovy.arsen.codex.health

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HealthConnectManagerTest {
    private val dayStart = Instant.parse("2026-11-03T06:00:00Z")
    private val syncTime = Instant.parse("2026-11-03T18:30:00Z")

    @Test
    fun dailyReadsIncludeTheCurrentOpenInterval() {
        assertEquals(
            HealthQueryRange(start = dayStart, end = null),
            healthQueryRange(dayStart, syncTime, includeCurrentInterval = true),
        )
    }

    @Test
    fun sessionAndExerciseAggregatesStayBounded() {
        assertEquals(
            HealthQueryRange(start = dayStart, end = syncTime),
            healthQueryRange(dayStart, syncTime, includeCurrentInterval = false),
        )
    }

    @Test
    fun openEndedRangeDoesNotChangeTheReportedSyncEnd() {
        val range = healthQueryRange(dayStart, syncTime, includeCurrentInterval = true)

        assertEquals(dayStart, range.start)
        assertNull(range.end)
    }
}
