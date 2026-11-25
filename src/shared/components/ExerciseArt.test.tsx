// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as catalogImages from '../assets/catalogImages'
import { ExerciseArt } from './ExerciseArt'

describe('ExerciseArt', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows a cached global image referenced by a personal copy and releases it on unmount', async () => {
    const revoke = vi.fn()
    const OriginalURL = URL
    vi.stubGlobal('URL', class extends OriginalURL { static createObjectURL = () => 'blob:global-image'; static revokeObjectURL = revoke })
    vi.spyOn(catalogImages, 'recoverCatalogImage').mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
    const reference = `global-image-v1:${'a'.repeat(64)}:100:png`
    const { unmount } = render(<ExerciseArt alt="Global" assetKind={reference} muscle="Pecho" />)
    await waitFor(() => expect(screen.getByRole('img', { name: 'Global' })).toHaveAttribute('data-image-source', 'custom'))
    unmount()
    expect(revoke).toHaveBeenCalledWith('blob:global-image')
  })

  it('retries a missing global image when connectivity returns', async () => {
    const OriginalURL = URL
    vi.stubGlobal('URL', class extends OriginalURL { static createObjectURL = () => 'blob:recovered'; static revokeObjectURL = vi.fn() })
    const recovery = vi.spyOn(catalogImages, 'recoverCatalogImage').mockResolvedValueOnce(null).mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
    const reference = `global-image-v1:${'a'.repeat(64)}:100:png`
    render(<ExerciseArt alt="Global" assetKind={reference} muscle="Pecho" />)
    await waitFor(() => expect(recovery).toHaveBeenCalledTimes(1))
    window.dispatchEvent(new Event('online'))
    await waitFor(() => expect(screen.getByRole('img', { name: 'Global' })).toHaveAttribute('data-image-source', 'custom'))
  })

  it('uses a custom image before bundled and muscle fallback', () => {
    render(
      <ExerciseArt
        alt="Remo"
        bundledAssetId="press-inclinado--pecho"
        customImageSrc="data:image/png;base64,AAAA"
        muscle="Pecho"
      />,
    )

    const art = screen.getByRole('img', { name: 'Remo' })

    expect(art).toHaveStyle({ backgroundImage: 'url(data:image/png;base64,AAAA)' })
    expect(art).toHaveClass('size-[66px]')
  })

  it('does not keep the default size when a caller provides one', () => {
    render(<ExerciseArt alt="Compacto" className="size-12" muscle="Pecho" />)

    const art = screen.getByRole('img', { name: 'Compacto' })

    expect(art).toHaveClass('size-12')
    expect(art).not.toHaveClass('size-[66px]')
  })

  it('uses a valid bundled asset before muscle fallback', () => {
    render(<ExerciseArt alt="Press inclinado" bundledAssetId="press-inclinado--pecho" muscle="Piernas" />)

    const art = screen.getByRole('img', { name: 'Press inclinado' })

    expect(art.getAttribute('style')).toContain('press-inclinado')
  })

  it('falls back to muscle art when bundled asset is unknown', () => {
    render(<ExerciseArt alt="Dominante" bundledAssetId="missing--pecho" muscle="Piernas" />)

    const art = screen.getByRole('img', { name: 'Dominante' })

    expect(art.getAttribute('style')).toContain('piernas')
  })

  it('uses a neutral local fallback when no usable image data exists', () => {
    render(<ExerciseArt alt="Sin dato" bundledAssetId="missing--pecho" muscle={null} />)

    const art = screen.getByRole('img', { name: 'Sin dato' })

    expect(art).toHaveAttribute('data-image-source', 'placeholder')
  })
})
