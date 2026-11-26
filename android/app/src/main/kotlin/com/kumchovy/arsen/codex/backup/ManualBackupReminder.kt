package com.kumchovy.arsen.codex.backup

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.BackoffPolicy
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.kumchovy.arsen.codex.MainActivity
import java.time.Duration
import java.time.LocalDate
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit

internal fun manualReminderDelay(now: ZonedDateTime, date: String): Long? {
    val day = try { LocalDate.parse(date) } catch (_: Exception) { return null }
    if (day != now.toLocalDate()) return null
    val target = now.withHour(20).withMinute(0).withSecond(0).withNano(0)
    return Duration.between(now.toInstant(), target.toInstant()).toMillis().coerceAtLeast(0)
}

internal fun shouldDeliverManualReminder(now: ZonedDateTime, date: String): Boolean =
    now.toLocalDate().toString() == date && now.hour >= 20

class ManualBackupReminderWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val date = inputData.getString("date") ?: return Result.failure()
        val now = ZonedDateTime.now()
        if (now.toLocalDate().toString() != date) return Result.success()
        if (!shouldDeliverManualReminder(now, date)) return Result.retry()
        val manager = NotificationManagerCompat.from(applicationContext)
        if (!manager.areNotificationsEnabled()) return Result.success()
        if (Build.VERSION.SDK_INT >= 26) applicationContext.getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel("arsen-backup", "Respaldo", NotificationManager.IMPORTANCE_DEFAULT)
        )
        val intent = Intent(applicationContext, MainActivity::class.java).putExtra("arsen_open_backup_reminder", true)
        val pending = PendingIntent.getActivity(applicationContext, 4202, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val body = "Si quieres, abre Cuenta y respaldo para preparar una copia manual."
        val notification = NotificationCompat.Builder(applicationContext, "arsen-backup")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("Recuerda revisar tu respaldo")
            .setContentText(body).setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pending).setAutoCancel(true).build()
        try { manager.notify(4202, notification) } catch (_: SecurityException) { }
        return Result.success()
    }
}

object ManualBackupReminderScheduler {
    fun schedule(context: Context, date: String) {
        synchronized(ManualBackupReminderScheduler::class.java) {
            val delay = manualReminderDelay(ZonedDateTime.now(), date) ?: return
            val prefs = context.getSharedPreferences("arsen-manual-reminders", Context.MODE_PRIVATE)
            if (prefs.getString("scheduled-date", null) == date) return
            val work = OneTimeWorkRequestBuilder<ManualBackupReminderWorker>()
                .setInputData(workDataOf("date" to date))
                .setInitialDelay(delay, TimeUnit.MILLISECONDS)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.HOURS).build()
            WorkManager.getInstance(context).enqueueUniqueWork("arsen-manual-reminder-$date", ExistingWorkPolicy.KEEP, work).result.get(5, TimeUnit.SECONDS)
            check(prefs.edit().putString("scheduled-date", date).commit())
        }
    }
}
