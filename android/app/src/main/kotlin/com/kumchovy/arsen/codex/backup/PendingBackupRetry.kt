package com.kumchovy.arsen.codex.backup

import com.kumchovy.arsen.codex.account.NativeSessionProvider
import com.kumchovy.arsen.codex.account.SessionResult
import kotlinx.coroutines.CancellationException

enum class BackupRetryResult { QUEUED, NOTHING_PENDING, OTHER_ACCOUNT, UNAVAILABLE }
class PendingBackupRetry(private val store: PendingSnapshotStore, private val sessions: NativeSessionProvider, private val enqueue: () -> Unit) {
    suspend fun run(expectedOwner: String): BackupRetryResult {
        return try {
            val pending = store.read() ?: return BackupRetryResult.NOTHING_PENDING
            val session = sessions.get()
            if (session.result != SessionResult.READY) BackupRetryResult.UNAVAILABLE
            else if (session.owner != expectedOwner || pending.owner != expectedOwner) BackupRetryResult.OTHER_ACCOUNT
            else { enqueue(); BackupRetryResult.QUEUED }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { BackupRetryResult.UNAVAILABLE }
    }
}
