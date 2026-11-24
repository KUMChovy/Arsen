import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import { ensureDemoData } from '../../db/seedDemoRoutine'
import { createContractBackup, getLocalRevision } from '../../db/contractBackup'
import { applyRemoteCatalog, readRemoteCatalog } from './remoteCatalogCache'

const exercise = {
  id: 'sinful-shell-press', name: 'Press plano', canonicalName: 'press-plano', mainMuscle: 'Pecho',
  aliases: ['banca'], technicalNotes: 'Controla el movimiento.',
  image: { url: 'https://assets.example.test/press.png', sha256: 'a'.repeat(64), sizeBytes: 1000, mimeType: 'image/png' },
}

describe('local global catalog cache', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open(); await ensureDemoData() })
  afterEach(() => db.close())

  it('stores a validated snapshot without marking personal data as changed', async () => {
    const revision = await getLocalRevision()
    expect(await readRemoteCatalog()).toBeNull()
    expect(await applyRemoteCatalog({ version: 1, exercises: [exercise] }, async () => true)).toBe(true)
    expect(await readRemoteCatalog()).toEqual({ version: 1, exercises: [exercise] })
    expect(await getLocalRevision()).toBe(revision)
    expect((await createContractBackup()).manifest).not.toContain('sinful-shell-press')
    db.close()
    await db.open()
    expect(await readRemoteCatalog()).toEqual({ version: 1, exercises: [exercise] })
  })

  it('preserves the last valid snapshot after invalid data or unavailable images', async () => {
    const original = { version: 1, exercises: [exercise] }
    await applyRemoteCatalog(original, async () => true)
    await expect(applyRemoteCatalog({ version: 2, exercises: [exercise, exercise] }, async () => true)).rejects.toThrow()
    await expect(applyRemoteCatalog({ version: 2, exercises: [exercise] }, async () => false)).rejects.toThrow()
    expect(await readRemoteCatalog()).toEqual(original)
  })

  it('does not overwrite a newer version with an older or repeated download', async () => {
    await applyRemoteCatalog({ version: 2, exercises: [exercise] }, async () => true)
    expect(await applyRemoteCatalog({ version: 1, exercises: [] }, async () => true)).toBe(false)
    expect(await applyRemoteCatalog({ version: 2, exercises: [] }, async () => true)).toBe(false)
    expect(await readRemoteCatalog()).toEqual({ version: 2, exercises: [exercise] })
  })

  it('keeps the highest valid version when downloads finish out of order', async () => {
    const results = await Promise.all([
      applyRemoteCatalog({ version: 2, exercises: [exercise] }, async () => true),
      applyRemoteCatalog({ version: 3, exercises: [] }, async () => true),
    ])
    expect(results).toContain(true)
    expect(await readRemoteCatalog()).toEqual({ version: 3, exercises: [] })
  })

  it('does not let image verification mutate the validated snapshot', async () => {
    await applyRemoteCatalog({ version: 1, exercises: [exercise] }, async (image) => {
      image.url = 'http://invalid.test/image.png'
      return true
    })
    expect(await readRemoteCatalog()).toEqual({ version: 1, exercises: [exercise] })
  })

  it('preserves the previous snapshot when writing the new version fails', async () => {
    await applyRemoteCatalog({ version: 1, exercises: [exercise] }, async () => true)
    const spy = vi.spyOn(db.localMetadata, 'put').mockRejectedValueOnce(new Error('write failed'))
    try {
      await expect(applyRemoteCatalog({ version: 2, exercises: [] }, async () => true)).rejects.toThrow()
      expect(await readRemoteCatalog()).toEqual({ version: 1, exercises: [exercise] })
    } finally {
      spy.mockRestore()
    }
  })

  it('falls back to the bundled catalog when local cache is corrupt and accepts a valid replacement', async () => {
    await db.localMetadata.put({ id: 'globalCatalog', value: { version: -1, exercises: [] } })
    expect(await readRemoteCatalog()).toBeNull()
    expect(await applyRemoteCatalog({ version: 1, exercises: [exercise] }, async () => true)).toBe(true)
    expect(await readRemoteCatalog()).toEqual({ version: 1, exercises: [exercise] })
  })
})
