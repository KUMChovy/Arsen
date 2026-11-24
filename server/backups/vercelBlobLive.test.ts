import { randomUUID } from 'node:crypto'
import { del } from '@vercel/blob'
import { describe, expect, it } from 'vitest'
import { backupObjectPath } from './blobReader'
import { signPrivateBackupUpload } from './signUpload'
import { signPrivateBackupDownload } from './signDownload'
import { createVercelBackupReader } from './vercelBlobReader'
import { createVercelCleanup } from './vercelCleanup'

describe.skipIf(process.env.RUN_BLOB_LIVE_CHECK !== '1')('private Blob development store', () => {
  it('uploads, protects, reads and removes an isolated test object', async () => {
    const userId = `arsen-live-check-${randomUUID()}`
    const backupId = randomUUID()
    const pathname = backupObjectPath(userId, backupId, 'manifest')
    const content = JSON.stringify({ test: 'arsen-private-blob' })
    let attemptedUpload = false
    try {
      const upload = await signPrivateBackupUpload({ userId, backupId, kind: 'manifest', maxBytes: 256, serverLimitBytes: 256 })
      const send = () => fetch(upload, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: content, signal: AbortSignal.timeout(15_000) })
      attemptedUpload = true
      const invalidType = await fetch(upload, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: content, signal: AbortSignal.timeout(15_000) })
      expect(invalidType.ok).toBe(false)
      const oversized = await fetch(upload, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(257), signal: AbortSignal.timeout(15_000) })
      expect(oversized.ok).toBe(false)
      const first = await send()
      expect(first.ok).toBe(true)
      const duplicate = await send()
      expect(duplicate.ok).toBe(false)
      const reader = createVercelBackupReader(userId, backupId)
      expect(new TextDecoder().decode(await reader('manifest', undefined, 256) ?? undefined)).toBe(content)
      const download = await signPrivateBackupDownload({ userId, backupId, kind: 'manifest' })
      const response = await fetch(download, { signal: AbortSignal.timeout(15_000) })
      expect(response.ok).toBe(true)
      expect(await response.text()).toBe(content)
      const unsigned = new URL(download)
      unsigned.search = ''
      expect((await fetch(unsigned, { signal: AbortSignal.timeout(15_000) })).ok).toBe(false)
      const cleanup = createVercelCleanup()
      expect(await cleanup.list(pathname, 10)).toContain(pathname)
      await cleanup.remove([pathname])
      expect(await cleanup.list(pathname, 10)).not.toContain(pathname)
      attemptedUpload = false
    } finally {
      if (attemptedUpload) await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(15_000) })
    }
  }, 90_000)
})
