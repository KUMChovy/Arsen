package com.kumchovy.arsen.codex.health

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant

enum class HealthMetricKey(val wireName: String) {
    HEART_RATE("heartRate"),
    ACTIVE_CALORIES("activeCalories"),
    STEPS("steps"),
    OXYGEN_SATURATION("oxygenSaturation"),
}

data class HealthReadWindow(
    val rangeStart: Instant,
    val rangeEnd: Instant,
    val metrics: CalculatedHealthMetrics,
    val missingPermissions: Set<HealthMetricKey>,
)

data class HealthReadResult(
    val day: HealthReadWindow,
    val exercises: List<HealthReadExercise> = emptyList(),
    val session: HealthReadWindow? = null,
)

data class HealthReadRange(
    val id: String,
    val rangeStart: Instant,
    val rangeEnd: Instant,
)

data class HealthReadExercise(
    val id: String,
    val window: HealthReadWindow,
)

internal data class HealthQueryRange(
    val start: Instant,
    val end: Instant?,
)

internal fun healthQueryRange(
    rangeStart: Instant,
    rangeEnd: Instant,
    includeCurrentInterval: Boolean,
): HealthQueryRange {
    return HealthQueryRange(
        start = rangeStart,
        end = if (includeCurrentInterval) null else rangeEnd,
    )
}

/**
 * Owns the Android-specific Health Connect access for the Capacitor plugin.
 *
 * It deliberately does not cache records: Mi Fitness may sync after a previous
 * read, so every explicit user sync asks Health Connect for the current day.
 */
class HealthConnectManager(private val context: Context) {
    companion object {
        private const val TAG = "ArsenHealth"
        const val AVAILABLE = "available"
        const val UNAVAILABLE = "unavailable"
        const val PROVIDER_UPDATE_REQUIRED = "provider-update-required"

        fun availability(context: Context): String {
            return when (HealthConnectClient.getSdkStatus(context)) {
                HealthConnectClient.SDK_AVAILABLE -> AVAILABLE
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> PROVIDER_UPDATE_REQUIRED
                else -> UNAVAILABLE
            }
        }
    }

    val requestedPermissions: Set<String> = setOf(
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(OxygenSaturationRecord::class),
    )

    suspend fun grantedPermissions(): Set<String> {
        if (availability(context) != AVAILABLE) return emptySet()
        return HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()
    }

    suspend fun readDay(
        dayStart: Instant,
        dayEnd: Instant,
        exerciseRanges: List<HealthReadRange> = emptyList(),
        sessionRange: HealthReadRange? = null,
    ): HealthReadResult {
        // Se vuelven a comprobar los permisos en cada sincronización para soportar permisos parciales o revocados.
        check(availability(context) == AVAILABLE) { "Health Connect is not available" }

        val client = HealthConnectClient.getOrCreate(context)
        val granted = client.permissionController.getGrantedPermissions()
        Log.i(TAG, "Health Connect read started; granted=${granted.size}")
        // Cada ventana se calcula por separado para no repartir métricas diarias entre ejercicios.
        val day = readWindow(
            client = client,
            granted = granted,
            rangeStart = dayStart,
            rangeEnd = dayEnd,
            includeCurrentInterval = true,
        )
        val session = sessionRange?.let { readWindow(client, granted, it.rangeStart, it.rangeEnd) }
        val exercises = exerciseRanges.map { range ->
            HealthReadExercise(range.id, readWindow(client, granted, range.rangeStart, range.rangeEnd))
        }
        Log.i(
            TAG,
            "Health Connect read finished; heartRate=${day.metrics.heartRateAvgBpm != null} calories=${day.metrics.activeCaloriesKcal != null} steps=${day.metrics.steps != null} oxygen=${day.metrics.oxygenSaturationAvgPercent != null}",
        )
        return HealthReadResult(day = day, exercises = exercises, session = session)
    }

    private suspend fun readWindow(
        client: HealthConnectClient,
        granted: Set<String>,
        rangeStart: Instant,
        rangeEnd: Instant,
        includeCurrentInterval: Boolean = false,
    ): HealthReadWindow {
        val range = healthQueryRange(rangeStart, rangeEnd, includeCurrentInterval).toTimeRangeFilter()
        val heartRatePermission = HealthPermission.getReadPermission(HeartRateRecord::class)
        val caloriesPermission = HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)
        val stepsPermission = HealthPermission.getReadPermission(StepsRecord::class)
        val oxygenPermission = HealthPermission.getReadPermission(OxygenSaturationRecord::class)

        val missing = buildSet {
            if (heartRatePermission !in granted) add(HealthMetricKey.HEART_RATE)
            if (caloriesPermission !in granted) add(HealthMetricKey.ACTIVE_CALORIES)
            if (stepsPermission !in granted) add(HealthMetricKey.STEPS)
            if (oxygenPermission !in granted) add(HealthMetricKey.OXYGEN_SATURATION)
        }

        // Read only the metrics that were granted. This keeps a revoked optional
        // permission from preventing the other available metrics from syncing.
        val oxygen = if (oxygenPermission in granted) {
            try {
                readOxygenSaturation(client, range)
            } catch (error: Exception) {
                Log.w(TAG, "Oxygen saturation read failed", error)
                emptyList()
            }
        } else {
            emptyList()
        }
        val aggregate = aggregate(
            client = client,
            range = range,
            includeHeartRate = heartRatePermission in granted,
            includeCalories = caloriesPermission in granted,
            includeSteps = stepsPermission in granted,
        )

        return HealthReadWindow(
            rangeStart = rangeStart,
            rangeEnd = rangeEnd,
            metrics = HealthSummaryCalculator.summarize(
                HealthSamples(
                    heartRate = aggregate.heartRate,
                    oxygenSaturation = oxygen,
                    activeCaloriesKcal = aggregate.activeCaloriesKcal,
                    steps = aggregate.steps,
                ),
            ),
            missingPermissions = missing,
        )
    }

    private suspend fun readOxygenSaturation(
        client: HealthConnectClient,
        range: TimeRangeFilter,
    ): List<TimedHealthValue> {
        // Oxígeno se resume a partir de las lecturas instantáneas del rango.
        return readAllRecords(client, OxygenSaturationRecord::class, range)
            .map { record -> TimedHealthValue(record.percentage.value, record.time) }
    }

    private suspend fun aggregate(
        client: HealthConnectClient,
        range: TimeRangeFilter,
        includeHeartRate: Boolean,
        includeCalories: Boolean,
        includeSteps: Boolean,
    ): AggregateValues {
        val heartRate = if (includeHeartRate) {
            try {
                val result = client.aggregate(
                    AggregateRequest(
                        setOf(
                            HeartRateRecord.BPM_AVG,
                            HeartRateRecord.BPM_MAX,
                            HeartRateRecord.BPM_MIN,
                        ),
                        range,
                    ),
                )
                HeartRateAggregate(
                    averageBpm = result[HeartRateRecord.BPM_AVG]?.toDouble(),
                    maxBpm = result[HeartRateRecord.BPM_MAX]?.toDouble(),
                    minBpm = result[HeartRateRecord.BPM_MIN]?.toDouble(),
                )
            } catch (error: Exception) {
                Log.w(TAG, "Heart rate aggregate failed", error)
                null
            }
        } else {
            null
        }

        // Calorías y pasos son acumulativos; aggregate evita sumar registros duplicados manualmente.
        val activeCaloriesKcal = if (includeCalories) {
            try {
                val result = client.aggregate(
                    AggregateRequest(setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL), range),
                )
                result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories
            } catch (error: Exception) {
                Log.w(TAG, "Active calories aggregate failed", error)
                null
            }
        } else {
            null
        }
        val steps = if (includeSteps) {
            try {
                val result = client.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), range))
                result[StepsRecord.COUNT_TOTAL]
            } catch (error: Exception) {
                Log.w(TAG, "Steps aggregate failed", error)
                null
            }
        } else {
            null
        }
        return AggregateValues(
            heartRate = heartRate,
            activeCaloriesKcal = activeCaloriesKcal,
            steps = steps,
        )
    }

    private suspend fun <T : Record> readAllRecords(
        client: HealthConnectClient,
        recordType: kotlin.reflect.KClass<T>,
        range: TimeRangeFilter,
    ): List<T> {
        // Health Connect puede paginar los registros; se recorren todas las páginas antes de resumir.
        val records = mutableListOf<T>()
        var pageToken: String? = null

        do {
            val request = if (pageToken == null) {
                ReadRecordsRequest(recordType, range)
            } else {
                ReadRecordsRequest(recordType, range, pageToken = pageToken)
            }
            val response = client.readRecords(request)
            records += response.records
            pageToken = response.pageToken
        } while (!pageToken.isNullOrBlank())

        return records
    }

    private data class AggregateValues(
        val heartRate: HeartRateAggregate? = null,
        val activeCaloriesKcal: Double? = null,
        val steps: Long? = null,
    )

    private fun HealthQueryRange.toTimeRangeFilter(): TimeRangeFilter {
        return end?.let { TimeRangeFilter.between(start, it) } ?: TimeRangeFilter.after(start)
    }
}
