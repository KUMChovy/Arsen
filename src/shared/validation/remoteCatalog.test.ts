import { describe, expect, it } from 'vitest'
import { publishedCatalogSchema } from './remoteCatalog'

const exercise = {
  id: 'sinful-shell-press-inclinado',
  name: 'Press inclinado',
  canonicalName: 'press-inclinado',
  mainMuscle: 'Pecho',
  aliases: ['press de banca inclinado'],
  technicalNotes: 'Controla el movimiento.',
  image: { url: 'https://assets.example.test/exercise.png', sha256: 'a'.repeat(64), sizeBytes: 1000, mimeType: 'image/png' },
}

describe('published catalog validation', () => {
  it('accepts a published catalog snapshot with a stable identifier', () => {
    expect(publishedCatalogSchema.safeParse({ version: 1, exercises: [exercise] }).success).toBe(true)
  })

  it('rejects repeated identifiers and unknown fields', () => {
    expect(publishedCatalogSchema.safeParse({ version: 1, exercises: [exercise, exercise] }).success).toBe(false)
    expect(publishedCatalogSchema.safeParse({ version: 1, exercises: [{ ...exercise, status: 'draft' }] }).success).toBe(false)
  })

  it('rejects insecure or malformed images and invalid versions', () => {
    for (const image of [
      { ...exercise.image, url: 'http://assets.example.test/image.png' },
      { ...exercise.image, url: 'not a url' },
      { ...exercise.image, url: 'https://name:password@assets.example.test/image.png' },
      { ...exercise.image, sha256: 'bad' },
      { ...exercise.image, sizeBytes: 0 },
      { ...exercise.image, sizeBytes: 10 * 1024 * 1024 + 1 },
      { ...exercise.image, mimeType: 'image/svg+xml' },
    ]) expect(publishedCatalogSchema.safeParse({ version: 1, exercises: [{ ...exercise, image }] }).success).toBe(false)
    expect(publishedCatalogSchema.safeParse({ version: Number.MAX_SAFE_INTEGER + 1, exercises: [exercise] }).success).toBe(false)
  })
})
