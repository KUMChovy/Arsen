package com.kumchovy.arsen.codex.backup

suspend fun reconcileBackup(
    owner: String,
    pending: PendingEnvelope,
    confirmedOwner: String?,
    confirmed: PendingEnvelope?,
    latest: suspend () -> String?,
    submit: suspend (PendingEnvelope) -> BackupTransportResult,
): BackupTransportResult {
    val first = submit(pending)
    if (first != BackupTransportResult.CONFLICT || confirmed == null || owner != confirmedOwner ||
        pending.deviceId != confirmed.deviceId || pending.revision <= confirmed.revision ||
        pending.baseBackupId != confirmed.baseBackupId) return first
    if (latest() != confirmed.backupId) return BackupTransportResult.CONFLICT
    val rebased = PendingEnvelope(pending.backupId, pending.deviceId, confirmed.backupId, pending.revision,
        pending.manifest, pending.manifestSha256, pending.includesHealth, pending.healthConsent, pending.sizeBytes, pending.binaries)
    return submit(rebased)
}
