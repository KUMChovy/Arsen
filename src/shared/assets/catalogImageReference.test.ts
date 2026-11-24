import { describe, expect, it } from 'vitest'
import { catalogImageReference, parseCatalogImageReference } from './catalogImageReference'

describe('global image references', () => {
  it('retains the integrity metadata without embedding the URL', () => {
    const image = { url: 'https://assets.example.test/image.png', sha256: 'a'.repeat(64), sizeBytes: 100, mimeType: 'image/png' as const }
    const reference = catalogImageReference(image)
    expect(reference).not.toContain('assets.example.test')
    expect(parseCatalogImageReference(reference)).toMatchObject({ sha256: image.sha256, sizeBytes: 100, mimeType: 'image/png' })
  })

  it('ignores unknown, malformed and oversized references', () => {
    for (const value of [null, 'bundled', `global-image-v1:${'a'.repeat(64)}:0:png`, `global-image-v1:${'a'.repeat(64)}:10485761:png`, `global-image-v1:${'a'.repeat(64)}:5:svg`]) {
      expect(parseCatalogImageReference(value)).toBeNull()
    }
  })
})
