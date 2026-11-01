package com.kumchovy.arsen.codex.health

import java.time.Instant

/** A metric sample with its source timestamp preserved for future range auditing. */
data class TimedHealthValue(
    val value: Double,
    val time: Instant,
)

/** Raw values collected from one Health Connect time window. */
data class HealthSamples(
    val heartRate: List<TimedHealthValue> = emptyList(),
    val oxygenSaturation: List<TimedHealthValue> = emptyList(),
    val activeCaloriesKcal: Double? = null,
    val steps: Long? = null,
)

/** The stable summary shape sent from the native layer to TypeScript. */
data class CalculatedHealthMetrics(
    val heartRateAvgBpm: Double?,
    val heartRateMaxBpm: Double?,
    val heartRateMinBpm: Double?,
    val activeCaloriesKcal: Double?,
    val steps: Long?,
    val oxygenSaturationAvgPercent: Double?,
)

object HealthSummaryCalculator {
    /**
     * Summarizes only records returned for the requested window.
     *
     * Null means Health Connect returned no value; it is intentionally different
     * from zero so the UI never suggests that an unavailable metric was measured.
     */
    fun summarize(samples: HealthSamples): CalculatedHealthMetrics {
        return CalculatedHealthMetrics(
            heartRateAvgBpm = samples.heartRate.averageOrNull(),
            heartRateMaxBpm = samples.heartRate.maxValueOrNull(),
            heartRateMinBpm = samples.heartRate.minValueOrNull(),
            activeCaloriesKcal = samples.activeCaloriesKcal,
            steps = samples.steps,
            oxygenSaturationAvgPercent = samples.oxygenSaturation.averageOrNull(),
        )
    }

    private fun List<TimedHealthValue>.averageOrNull(): Double? {
        return if (isEmpty()) null else sumOf { it.value } / size
    }

    private fun List<TimedHealthValue>.maxValueOrNull(): Double? {
        return maxOfOrNull { it.value }
    }

    private fun List<TimedHealthValue>.minValueOrNull(): Double? {
        return minOfOrNull { it.value }
    }
}
