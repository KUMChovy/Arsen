import { describe, expect, it } from 'vitest'
import { prepareRemoteBackupSchema } from './remoteBackup'

const valid = {
  id: 'ec03264a-6e3c-4a5c-93c9-af88fe519a40',
  contractVersion: 1,
  localRevision: 0,
  baseBackupId: null,
  manifestSha256: 'a'.repeat(64),
  sizeBytes: 1,
  includesHealth: false,
  healthConsent: false,
}

describe('remote backup preparation metadata', () => {
  it('accepts a first backup and a later backup based on a confirmed version', () => {
    expect(prepareRemoteBackupSchema.safeParse(valid).success).toBe(true)
    expect(prepareRemoteBackupSchema.safeParse({ ...valid, baseBackupId: valid.id }).success).toBe(true)
  })

  it('rejects unknown fields and invalid identifiers', () => {
    for (const input of [{ ...valid, userId: 'another-user' }, { ...valid, id: 'bad' }, { ...valid, baseBackupId: 'bad' }, { ...valid, baseBackupId: undefined }]) {
      expect(prepareRemoteBackupSchema.safeParse(input).success).toBe(false)
    }
  })

  it('rejects invalid sizes, revisions, contract versions and hashes', () => {
    for (const input of [
      { ...valid, sizeBytes: 0 }, { ...valid, sizeBytes: Number.MAX_SAFE_INTEGER + 1 },
      { ...valid, localRevision: -1 }, { ...valid, localRevision: 1.5 },
      { ...valid, contractVersion: 0 }, { ...valid, contractVersion: Number.MAX_SAFE_INTEGER + 1 },
      { ...valid, manifestSha256: 'A'.repeat(64) }, { ...valid, manifestSha256: 'a'.repeat(63) },
    ]) expect(prepareRemoteBackupSchema.safeParse(input).success).toBe(false)
  })

  it('requires explicit consent when health data is included', () => {
    expect(prepareRemoteBackupSchema.safeParse({ ...valid, includesHealth: true }).success).toBe(false)
    expect(prepareRemoteBackupSchema.safeParse({ ...valid, includesHealth: true, healthConsent: true }).success).toBe(true)
  })
})
