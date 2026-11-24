package com.kumchovy.arsen.codex.backup

import com.kumchovy.arsen.codex.account.NativeSessionProvider
import com.kumchovy.arsen.codex.account.SessionResult
import kotlinx.coroutines.CancellationException

enum class BackupWorkOutcome { NOTHING_PENDING, AUTH_REQUIRED, ACCESS_DENIED, ACCOUNT_MISMATCH, CONFLICT, INVALID, RETRY, CONFIRMED, NEWER_PENDING, STORAGE_ERROR }
enum class BackupTransportResult { CONFIRMED, RETRY, AUTH_REQUIRED, ACCESS_DENIED, CONFLICT, INVALID }

class BackupWorkerEngine(private val store: PendingSnapshotStore, private val sessions: NativeSessionProvider) {
    suspend fun run(submit: suspend (PendingSnapshot, suspend () -> String) -> BackupTransportResult): BackupWorkOutcome {
        val pending = try { store.read() } catch (_: Exception) { return BackupWorkOutcome.STORAGE_ERROR }
        if (pending == null) return BackupWorkOutcome.NOTHING_PENDING
        val session = sessions.get()
        if (session.result == SessionResult.SIGNED_OUT) return BackupWorkOutcome.AUTH_REQUIRED
        if (session.result != SessionResult.READY) return BackupWorkOutcome.RETRY
        if (session.owner != pending.owner) return BackupWorkOutcome.ACCOUNT_MISMATCH
        return try {
            var unsuccessful = BackupWorkOutcome.RETRY
            when (PendingBackupSubmission(store).run(session.owner) { snapshot ->
                val result = submit(snapshot) {
                    val fresh = sessions.get()
                    check(fresh.result == SessionResult.READY && fresh.owner == snapshot.owner && fresh.token != null) { "Sesión no disponible para esta copia" }
                    fresh.token
                }
                unsuccessful = when (result) {
                    BackupTransportResult.RETRY -> BackupWorkOutcome.RETRY
                    BackupTransportResult.AUTH_REQUIRED -> BackupWorkOutcome.AUTH_REQUIRED
                    BackupTransportResult.ACCESS_DENIED -> BackupWorkOutcome.ACCESS_DENIED
                    BackupTransportResult.CONFLICT -> BackupWorkOutcome.CONFLICT
                    BackupTransportResult.INVALID -> BackupWorkOutcome.INVALID
                    BackupTransportResult.CONFIRMED -> BackupWorkOutcome.CONFIRMED
                }
                result == BackupTransportResult.CONFIRMED
            }) {
                SubmissionResult.NOTHING_PENDING -> BackupWorkOutcome.NOTHING_PENDING
                SubmissionResult.SIGN_IN_REQUIRED -> BackupWorkOutcome.AUTH_REQUIRED
                SubmissionResult.OTHER_ACCOUNT -> BackupWorkOutcome.ACCOUNT_MISMATCH
                SubmissionResult.RETRY -> unsuccessful
                SubmissionResult.NEWER_PENDING -> BackupWorkOutcome.NEWER_PENDING
                SubmissionResult.CONFIRMED -> BackupWorkOutcome.CONFIRMED
            }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { BackupWorkOutcome.RETRY }
    }
}
