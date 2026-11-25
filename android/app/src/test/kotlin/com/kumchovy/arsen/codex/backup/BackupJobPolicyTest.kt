package com.kumchovy.arsen.codex.backup

import org.junit.Assert.assertEquals
import org.junit.Test

class BackupJobPolicyTest {
    @Test fun `automatic preparation schedules the periodic job without an immediate upload`() {
        assertEquals(BackupSchedule.PERIODIC, backupScheduleForStage(periodic = true))
        assertEquals(BackupSchedule.IMMEDIATE, backupScheduleForStage(periodic = false))
    }
    @Test fun `only transient failures and newer snapshots schedule a retry`() {
        for (outcome in BackupWorkOutcome.entries) {
            val expected = when (outcome) {
                BackupWorkOutcome.RETRY, BackupWorkOutcome.NEWER_PENDING -> BackupJobDecision.RETRY
                BackupWorkOutcome.CONFIRMED, BackupWorkOutcome.NOTHING_PENDING -> BackupJobDecision.COMPLETE
                else -> BackupJobDecision.NEEDS_ATTENTION
            }
            assertEquals(expected, backupJobDecision(outcome))
        }
    }
}
