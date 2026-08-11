// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ExerciseArt } from './ExerciseArt'

describe('ExerciseArt', () => {
  afterEach(() => {
    cleanup()
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
