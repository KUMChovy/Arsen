package com.kumchovy.arsen.codex.health

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.PermissionController
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Instant
import java.util.concurrent.Executors
import kotlinx.coroutines.runBlocking
import org.json.JSONObject

@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private lateinit var manager: HealthConnectManager

    companion object {
        private const val HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata"
        private const val MANAGE_HEALTH_PERMISSIONS_ACTION =
            "android.health.connect.action.MANAGE_HEALTH_PERMISSIONS"
        private const val HEALTH_CONNECT_PLAY_STORE_URL =
            "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata"
    }

    override fun load() {
        // El manager concentra la lectura Android y el plugin solo adapta datos para JavaScript.
        manager = HealthConnectManager(context)
    }

    @PluginMethod
    fun getAvailability(call: PluginCall) {
        call.resolve(JSObject().put("status", HealthConnectManager.availability(context)))
    }

    @PluginMethod
    fun getPermissions(call: PluginCall) {
        executor.execute {
            try {
                val granted = runBlocking { manager.grantedPermissions() }
                mainHandler.post { call.resolve(permissionsPayload(granted)) }
            } catch (error: Exception) {
                mainHandler.post { call.reject(error.message ?: "No se pudieron leer los permisos") }
            }
        }
    }

    @PluginMethod
    fun openHealthConnectAccess(call: PluginCall) {
        // Android 14 exposes an app-specific access screen. On Android 13 and
        // lower, the public SDK only exposes the Health Connect home settings;
        // the permission request contract below remains the authoritative way
        // to add Arsen and grant its declared data types.
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            Intent(MANAGE_HEALTH_PERMISSIONS_ACTION).apply {
                putExtra(Intent.EXTRA_PACKAGE_NAME, context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        } else {
            Intent(androidx.health.connect.client.HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        }

        try {
            context.startActivity(intent)
            call.resolve()
        } catch (error: Exception) {
            call.reject(error.message ?: "No se pudo abrir Health Connect")
        }
    }

    @PluginMethod
    fun openHealthConnectInstall(call: PluginCall) {
        val marketIntent = Intent(
            Intent.ACTION_VIEW,
            Uri.parse("market://details?id=$HEALTH_CONNECT_PACKAGE"),
        ).apply {
            // Prefer the Play Store app, but keep the browser fallback for
            // devices without Google Play or with a restricted store profile.
            setPackage("com.android.vending")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        try {
            context.startActivity(marketIntent)
        } catch (_: ActivityNotFoundException) {
            try {
                context.startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse(HEALTH_CONNECT_PLAY_STORE_URL)).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    },
                )
            } catch (error: Exception) {
                call.reject(error.message ?: "No se pudo abrir la instalación de Health Connect")
                return
            }
        } catch (error: Exception) {
            call.reject(error.message ?: "No se pudo abrir la instalación de Health Connect")
            return
        }

        call.resolve()
    }

    @PluginMethod
    fun requestHealthPermissions(call: PluginCall) {
        val availability = HealthConnectManager.availability(context)
        if (availability != HealthConnectManager.AVAILABLE) {
            call.reject("Health Connect no está disponible", availability)
            return
        }

        // The official contract owns the permission UI; Arsen never asks for
        // permissions merely because the optional module is installed.
        val permissionContract = PermissionController.createRequestPermissionResultContract()
        val intent = permissionContract.createIntent(
            context,
            manager.requestedPermissions,
        )
        startActivityForResult(call, intent, "permissionsResult")
    }

    @ActivityCallback
    fun permissionsResult(call: PluginCall, result: ActivityResult) {
        val permissionContract = PermissionController.createRequestPermissionResultContract()
        val granted = permissionContract.parseResult(result.resultCode, result.data)
        call.resolve(permissionsPayload(granted))
    }

    @PluginMethod
    fun readDayHealth(call: PluginCall) {
        // Valida ISO-8601 antes de enviar rangos al SDK para evitar lecturas ambiguas.
        val dayStart = call.getString("dayStart")
        val dayEnd = call.getString("dayEnd")
        if (dayStart == null || dayEnd == null) {
            call.reject("Falta el rango diario para leer salud")
            return
        }

        val parsed = try {
            listOf(
                Instant.parse(dayStart),
                Instant.parse(dayEnd),
            )
        } catch (_: Exception) {
            call.reject("Los rangos de tiempo deben ser ISO-8601 válidos")
            return
        }

        val sessionRange = call.getObject("session")?.let { range ->
            parseRange(range, "session")
        }
        val exerciseRanges = try {
            val ranges = call.getArray("exercises")
            if (ranges == null) {
                emptyList()
            } else {
                (0 until ranges.length()).map { index -> parseRange(ranges.getJSONObject(index), "exercise-$index") }
            }
        } catch (error: Exception) {
            call.reject(error.message ?: "Los rangos de ejercicio no son válidos")
            return
        }

        call.setKeepAlive(true)
        executor.execute {
            // La lectura ocurre fuera del hilo de UI y vuelve al bridge en el hilo principal.
            try {
                val result = runBlocking {
                    manager.readDay(
                        dayStart = parsed[0],
                        dayEnd = parsed[1],
                        exerciseRanges = exerciseRanges,
                        sessionRange = sessionRange,
                    )
                }
                mainHandler.post {
                    call.resolve(readResultPayload(result))
                    call.release(bridge)
                }
            } catch (error: Exception) {
                mainHandler.post {
                    call.reject(error.message ?: "No se pudieron leer los datos de salud")
                    call.release(bridge)
                }
            }
        }
    }

    override fun handleOnDestroy() {
        executor.shutdownNow()
        super.handleOnDestroy()
    }

    private fun permissionsPayload(granted: Set<String>): JSObject {
        return JSObject()
            .put("requested", JSArray(manager.requestedPermissions.toList()))
            .put("granted", JSArray(granted.toList()))
    }

    private fun readResultPayload(result: HealthReadResult): JSObject {
        // Convierte el resultado tipado de Kotlin al contrato JSON consumido por TypeScript.
        val exercises = JSArray()
        result.exercises.forEach { exercise ->
            exercises.put(windowPayload(exercise.window).put("id", exercise.id))
        }
        return JSObject().put("day", windowPayload(result.day)).put("exercises", exercises).also { payload ->
            result.session?.let { payload.put("session", windowPayload(it)) }
        }
    }

    private fun parseRange(value: JSONObject, fallbackId: String): HealthReadRange {
        val id = value.optString("id", fallbackId)
        val start = Instant.parse(value.getString("rangeStart"))
        val end = Instant.parse(value.getString("rangeEnd"))
        require(!end.isBefore(start)) { "El rango $id es inválido" }
        return HealthReadRange(id = id, rangeStart = start, rangeEnd = end)
    }

    private fun windowPayload(window: HealthReadWindow): JSObject {
        return JSObject()
            .put("rangeStart", window.rangeStart.toString())
            .put("rangeEnd", window.rangeEnd.toString())
            .put("missingPermissions", JSArray(window.missingPermissions.map { it.wireName }))
            .put("metrics", metricsPayload(window.metrics))
    }

    private fun metricsPayload(metrics: CalculatedHealthMetrics): JSObject {
        return JSObject()
            .put("heartRateAvgBpm", nullable(metrics.heartRateAvgBpm))
            .put("heartRateMaxBpm", nullable(metrics.heartRateMaxBpm))
            .put("heartRateMinBpm", nullable(metrics.heartRateMinBpm))
            .put("activeCaloriesKcal", nullable(metrics.activeCaloriesKcal))
            .put("steps", nullable(metrics.steps))
            .put("oxygenSaturationAvgPercent", nullable(metrics.oxygenSaturationAvgPercent))
    }

    private fun nullable(value: Any?): Any = value ?: JSONObject.NULL

}
