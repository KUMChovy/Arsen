package com.kumchovy.arsen.codex.backup

import com.kumchovy.arsen.codex.account.NativeSessionProvider
import com.kumchovy.arsen.codex.account.SessionResult
import java.security.MessageDigest
import kotlinx.coroutines.CancellationException

enum class BackupStageResult { STORED, SIGN_IN_REQUIRED, OTHER_ACCOUNT, UNAVAILABLE, INVALID, STORAGE_ERROR }

class PendingBackupStager(
    private val store: PendingSnapshotStore,
    private val sessions: NativeSessionProvider,
    private val maxBytes: Int,
    private val validate: (PendingSnapshot, Int) -> Unit = { snapshot, limit -> decodePendingEnvelope(snapshot, limit); Unit },
) {
    suspend fun stage(revision: Long, payload: ByteArray, expectedOwner: String? = null): BackupStageResult {
        if (revision !in 0..9007199254740991L || payload.isEmpty() || payload.size > maxBytes) return BackupStageResult.INVALID
        try {
            val session = sessions.get()
            if (session.result == SessionResult.SIGNED_OUT) return BackupStageResult.SIGN_IN_REQUIRED
            if (session.result != SessionResult.READY || session.owner == null) return BackupStageResult.UNAVAILABLE
            if (expectedOwner != null && session.owner != expectedOwner) return BackupStageResult.OTHER_ACCOUNT
            val previous = try { store.read() } catch (_: Exception) { return BackupStageResult.STORAGE_ERROR }
            if (previous != null && previous.owner != session.owner) return BackupStageResult.OTHER_ACCOUNT
            val copy = payload.copyOf()
            val digest = MessageDigest.getInstance("SHA-256").digest(copy).joinToString("") { "%02x".format(it.toInt() and 255) }
            try { validate(PendingSnapshot(session.owner, revision, copy, digest), maxBytes) } catch (_: Exception) { return BackupStageResult.INVALID }
            val current = sessions.get()
            if (current.result == SessionResult.SIGNED_OUT) return BackupStageResult.SIGN_IN_REQUIRED
            if (current.result != SessionResult.READY) return BackupStageResult.UNAVAILABLE
            if (current.owner != session.owner) return BackupStageResult.OTHER_ACCOUNT
            return try { store.write(session.owner, revision, copy); BackupStageResult.STORED } catch (_: Exception) { BackupStageResult.STORAGE_ERROR }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { return BackupStageResult.UNAVAILABLE }
    }
}
