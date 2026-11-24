package com.kumchovy.arsen.codex.backup

enum class BackupJobDecision { COMPLETE, RETRY, NEEDS_ATTENTION }

fun backupJobDecision(outcome: BackupWorkOutcome): BackupJobDecision = when (outcome) {
    BackupWorkOutcome.NOTHING_PENDING, BackupWorkOutcome.CONFIRMED -> BackupJobDecision.COMPLETE
    BackupWorkOutcome.RETRY, BackupWorkOutcome.NEWER_PENDING -> BackupJobDecision.RETRY
    else -> BackupJobDecision.NEEDS_ATTENTION
}
