// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ExerciseArt } from './ExerciseArt'

describe('ExerciseArt', () => {
  afterEach(() => {
    cleanup()
  })

  it('uses a custom image before assetKind and muscle fallback', () => {
    render(<ExerciseArt alt="Remo" assetKind="press" customImageSrc="data:image/png;base64,AAAA" muscle="Pecho" />)

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

  it('uses a valid assetKind before muscle fallback', () => {
    render(<ExerciseArt alt="Remo" assetKind="row" muscle="Pecho" />)

    const art = screen.getByRole('img', { name: 'Remo' })

    expect(art.getAttribute('style')).toContain('40% 50%')
  })

  it('falls back to normalized muscle art when assetKind is unknown', () => {
    render(<ExerciseArt alt="Dominante" assetKind="unknown" muscle="Piernas" />)

    const art = screen.getByRole('img', { name: 'Dominante' })

    expect(art.getAttribute('style')).toContain('100% 50%')
  })

  it('falls back when assetKind is an inherited object key', () => {
    render(<ExerciseArt alt="Dominante" assetKind="toString" muscle="Piernas" />)

    const art = screen.getByRole('img', { name: 'Dominante' })

    expect(art.getAttribute('style')).toContain('100% 50%')
  })
})
