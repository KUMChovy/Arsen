package com.kumchovy.arsen.codex.health

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HealthSummaryCalculatorTest {
    @Test
    fun summarizesHeartRateAndOxygenSamplesWithoutInventingEmptyValues() {
        val result = HealthSummaryCalculator.summarize(
            HealthSamples(
                activeCaloriesKcal = 420.5,
                heartRate = listOf(
                    TimedHealthValue(92.0, Instant.parse("2026-07-20T16:42:00Z")),
                    TimedHealthValue(132.0, Instant.parse("2026-07-20T17:30:00Z")),
                    TimedHealthValue(168.0, Instant.parse("2026-07-20T18:30:00Z")),
                ),
                oxygenSaturation = listOf(
                    TimedHealthValue(96.0, Instant.parse("2026-07-20T17:00:00Z")),
                    TimedHealthValue(98.0, Instant.parse("2026-07-20T18:00:00Z")),
                ),
                steps = 1850,
            ),
        )

        assertEquals(130.67, result.heartRateAvgBpm ?: error("heart rate average missing"), 0.01)
        assertEquals(168.0, result.heartRateMaxBpm ?: error("heart rate maximum missing"), 0.0)
        assertEquals(92.0, result.heartRateMinBpm ?: error("heart rate minimum missing"), 0.0)
        assertEquals(97.0, result.oxygenSaturationAvgPercent ?: error("oxygen average missing"), 0.0)
        assertEquals(420.5, result.activeCaloriesKcal ?: error("calories missing"), 0.0)
        assertEquals(1850L, result.steps)
    }

    @Test
    fun returnsNullForMetricsWithoutRecords() {
        val result = HealthSummaryCalculator.summarize(HealthSamples())

        assertNull(result.heartRateAvgBpm)
        assertNull(result.heartRateMaxBpm)
        assertNull(result.heartRateMinBpm)
        assertNull(result.oxygenSaturationAvgPercent)
        assertNull(result.activeCaloriesKcal)
        assertNull(result.steps)
    }
}
