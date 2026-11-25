package com.kumchovy.arsen.codex.backup

import org.junit.Assert.*
import org.junit.Test

class BackupNotificationPolicyTest {
    @Test fun `reports only confirmed copies as successful`() {
        assertEquals(BackupNotice.CONFIRMED, backupNotice(BackupWorkOutcome.CONFIRMED))
        assertEquals(BackupNotice.CONFIRMED_WITH_CHANGES, backupNotice(BackupWorkOutcome.NEWER_PENDING))
        assertNull(backupNotice(BackupWorkOutcome.NOTHING_PENDING))
    }

    @Test fun `distinguishes retryable failures from those needing attention`() {
        assertEquals(BackupNotice.RETRYING, backupNotice(BackupWorkOutcome.RETRY))
        assertEquals(BackupNotice.NEEDS_ATTENTION, backupNotice(BackupWorkOutcome.CONFLICT))
        assertEquals(BackupNotice.NEEDS_ATTENTION, backupNotice(BackupWorkOutcome.AUTH_REQUIRED))
        assertEquals(BackupNotice.NEEDS_ATTENTION, backupNotice(BackupWorkOutcome.STORAGE_ERROR))
    }
}
