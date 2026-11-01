package com.kumchovy.arsen.codex.health

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

/**
 * Health Connect opens this screen when the user asks why Arsen needs access.
 * Keeping the explanation in the app makes the permission purpose explicit
 * and satisfies Health Connect's privacy-rationale contract.
 */
class HealthConnectRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(
            TextView(this).apply {
                text = "Arsen usa Health Connect para leer frecuencia cardiaca, calorías activas, pasos y oxígeno disponibles después de sincronizar el smartwatch. Los datos se resumen y se guardan localmente junto al entrenamiento; Arsen no los envía a un servidor."
                setPadding(48, 48, 48, 48)
            },
        )
    }
}
