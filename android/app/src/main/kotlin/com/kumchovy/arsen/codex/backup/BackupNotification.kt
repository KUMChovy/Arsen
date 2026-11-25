package com.kumchovy.arsen.codex.backup

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.kumchovy.arsen.codex.MainActivity

enum class BackupNotice { CONFIRMED, CONFIRMED_WITH_CHANGES, RETRYING, NEEDS_ATTENTION }

fun backupNotice(outcome: BackupWorkOutcome): BackupNotice? = when (outcome) {
    BackupWorkOutcome.NOTHING_PENDING -> null
    BackupWorkOutcome.CONFIRMED -> BackupNotice.CONFIRMED
    BackupWorkOutcome.NEWER_PENDING -> BackupNotice.CONFIRMED_WITH_CHANGES
    BackupWorkOutcome.RETRY -> BackupNotice.RETRYING
    else -> BackupNotice.NEEDS_ATTENTION
}

fun notifyBackupOutcome(context: Context, outcome: BackupWorkOutcome) {
    val notice = backupNotice(outcome) ?: return
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return
    if (Build.VERSION.SDK_INT >= 26) {
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel("arsen-backup", "Respaldo", NotificationManager.IMPORTANCE_DEFAULT)
        )
    }
    val message = when (notice) {
        BackupNotice.CONFIRMED -> "La copia se confirmó en la nube."
        BackupNotice.CONFIRMED_WITH_CHANGES -> "La copia se confirmó. Hay cambios posteriores pendientes."
        BackupNotice.RETRYING -> "Falló el envío. ARSEN lo volverá a intentar."
        BackupNotice.NEEDS_ATTENTION -> "No se pudo completar la copia. Abre Cuenta y respaldo para revisarla."
    }
    val intent = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = NotificationCompat.Builder(context, "arsen-backup")
        .setSmallIcon(android.R.drawable.stat_notify_sync)
        .setContentTitle(if (notice == BackupNotice.CONFIRMED || notice == BackupNotice.CONFIRMED_WITH_CHANGES) "Respaldo confirmado" else "Falló el respaldo")
        .setContentText(message).setStyle(NotificationCompat.BigTextStyle().bigText(message))
        .setContentIntent(intent).setAutoCancel(true).build()
    try { manager.notify(4201, notification) } catch (_: SecurityException) { /* permission was revoked */ }
}
