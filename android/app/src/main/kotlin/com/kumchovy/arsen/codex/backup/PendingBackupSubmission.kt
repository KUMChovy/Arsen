package com.kumchovy.arsen.codex.backup

enum class SubmissionResult { NOTHING_PENDING, SIGN_IN_REQUIRED, OTHER_ACCOUNT, RETRY, NEWER_PENDING, CONFIRMED }

class PendingBackupSubmission(private val store: PendingSnapshotStore) {
    suspend fun run(sessionOwner: String?, automatic: Boolean = false, submitAndConfirm: suspend (PendingSnapshot) -> Boolean): SubmissionResult {
        val pending = store.read() ?: return SubmissionResult.NOTHING_PENDING
        if (sessionOwner == null) return SubmissionResult.SIGN_IN_REQUIRED
        if (pending.owner != sessionOwner) return SubmissionResult.OTHER_ACCOUNT
        val snapshot = (if (automatic) store.beginAutomaticSubmission() else store.beginSubmission()) ?: return SubmissionResult.NOTHING_PENDING
        if (snapshot.owner != sessionOwner) return SubmissionResult.OTHER_ACCOUNT
        if (!submitAndConfirm(snapshot)) return SubmissionResult.RETRY
        if (!store.confirmSubmission(snapshot)) return SubmissionResult.RETRY
        return if (store.read() == null) SubmissionResult.CONFIRMED else SubmissionResult.NEWER_PENDING
    }
}
