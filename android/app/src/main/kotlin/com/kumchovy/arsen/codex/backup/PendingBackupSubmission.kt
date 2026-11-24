package com.kumchovy.arsen.codex.backup

enum class SubmissionResult { NOTHING_PENDING, SIGN_IN_REQUIRED, OTHER_ACCOUNT, RETRY, NEWER_PENDING, CONFIRMED }

class PendingBackupSubmission(private val store: PendingSnapshotStore) {
    suspend fun run(sessionOwner: String?, submitAndConfirm: suspend (PendingSnapshot) -> Boolean): SubmissionResult {
        val snapshot = store.read() ?: return SubmissionResult.NOTHING_PENDING
        if (sessionOwner == null) return SubmissionResult.SIGN_IN_REQUIRED
        if (snapshot.owner != sessionOwner) return SubmissionResult.OTHER_ACCOUNT
        if (!submitAndConfirm(snapshot)) return SubmissionResult.RETRY
        return if (store.acknowledge(snapshot.owner, snapshot.revision, snapshot.sha256)) SubmissionResult.CONFIRMED else SubmissionResult.NEWER_PENDING
    }
}
