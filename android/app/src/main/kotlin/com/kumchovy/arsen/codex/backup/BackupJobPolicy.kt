package com.kumchovy.arsen.codex.backup

import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime

enum class BackupJobDecision { COMPLETE, RETRY, NEEDS_ATTENTION }
enum class BackupSchedule { IMMEDIATE, PERIODIC }

fun backupScheduleForStage(periodic: Boolean): BackupSchedule = if (periodic) BackupSchedule.PERIODIC else BackupSchedule.IMMEDIATE

fun backupEligibleOnLocalDay(preparedAt: Instant, now: Instant, zone: ZoneId): Boolean =
    preparedAt.isBefore(now) && preparedAt.atZone(zone).toLocalDate().isBefore(now.atZone(zone).toLocalDate())

fun nextBackupCheck(now: ZonedDateTime): ZonedDateTime {
    val earliest = now.plusHours(72)
    val morning = earliest.toLocalDate().atTime(3, 0).atZone(now.zone)
    return if (morning.toInstant().isBefore(earliest.toInstant())) morning.plusDays(1) else morning
}


fun backupJobDecision(outcome: BackupWorkOutcome): BackupJobDecision = when (outcome) {
    BackupWorkOutcome.NOTHING_PENDING, BackupWorkOutcome.CONFIRMED -> BackupJobDecision.COMPLETE
    BackupWorkOutcome.RETRY, BackupWorkOutcome.NEWER_PENDING -> BackupJobDecision.RETRY
    else -> BackupJobDecision.NEEDS_ATTENTION
}
