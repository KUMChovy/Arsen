package com.kumchovy.arsen.codex.backup

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.kumchovy.arsen.codex.BuildConfig
import com.kumchovy.arsen.codex.account.ClerkSessionSource
import com.kumchovy.arsen.codex.account.NativeSessionProvider
import java.io.File
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal const val MAX_PENDING_BACKUP_BYTES = 16 * 1024 * 1024

class BackupWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val outcome = try {
            if (BuildConfig.ARSEN_BACKUP_API_ORIGIN.isEmpty()) return@withContext Result.failure(workDataOf("reason" to "NOT_CONFIGURED"))
            val store = PendingSnapshotStore(File(applicationContext.noBackupFilesDir, "arsen-backup"), AndroidBackupKey.getOrCreate(), MAX_PENDING_BACKUP_BYTES)
            val transport = NativeBackupTransport(BackupHttpClient(BuildConfig.ARSEN_BACKUP_API_ORIGIN))
            BackupWorkerEngine(store, NativeSessionProvider(ClerkSessionSource())).run { snapshot, token ->
                val envelope = try { decodePendingEnvelope(snapshot, MAX_PENDING_BACKUP_BYTES) } catch (_: Exception) { return@run BackupTransportResult.INVALID }
                transport.submit(snapshot.owner, envelope, token)
            }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { BackupWorkOutcome.STORAGE_ERROR }
        when (backupJobDecision(outcome)) {
            BackupJobDecision.COMPLETE -> Result.success(workDataOf("outcome" to outcome.name))
            BackupJobDecision.RETRY -> Result.retry()
            BackupJobDecision.NEEDS_ATTENTION -> Result.failure(workDataOf("outcome" to outcome.name))
        }
    }
}

object BackupScheduler {
    private val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
    fun enqueue(context: Context) {
        val request = OneTimeWorkRequestBuilder<BackupWorker>().setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build()
        WorkManager.getInstance(context).enqueueUniqueWork("arsen-backup-once", ExistingWorkPolicy.KEEP, request)
    }
    fun schedulePeriodic(context: Context) {
        val request = PeriodicWorkRequestBuilder<BackupWorker>(72, TimeUnit.HOURS).setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("arsen-backup-periodic", ExistingPeriodicWorkPolicy.KEEP, request)
    }
}
