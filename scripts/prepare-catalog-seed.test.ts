import { describe, expect, it } from 'vitest'
import { prepareCatalogSeed } from './prepare-catalog-seed.mjs'

describe('initial catalog preparation', () => {
  it('preserves all existing identifiers and verifies their image bytes', async () => {
    const result = await prepareCatalogSeed(process.cwd())
    expect(result.exercises).toHaveLength(74)
    expect(new Set(result.exercises.map((item: { id: string }) => item.id)).size).toBe(74)
    expect(result.exercises.every((item: { image: { sha256: string; sizeBytes: number } }) => /^[a-f0-9]{64}$/.test(item.image.sha256) && item.image.sizeBytes > 0)).toBe(true)
  }, 30_000)
  it('fails closed when the source is absent', async () => {
    await expect(prepareCatalogSeed('missing-catalog-source')).rejects.toThrow()
  })
})
