// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExerciseImageSelector } from './ExerciseImageSelector'

describe('ExerciseImageSelector', () => {
  it('exposes included and custom image selections as pressed buttons', () => {
    const { rerender } = render(
      <ExerciseImageSelector
        assets={[asset]}
        disabled={false}
        error={null}
        mainMuscle="Pecho"
        onChange={vi.fn()}
        onUpload={vi.fn()}
        selection={{ assetKind: 'press', customAssetId: null }}
      />,
    )

    expect(screen.getByRole('button', { name: /Press/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Auto/ })).toHaveAttribute('aria-pressed', 'false')

    rerender(
      <ExerciseImageSelector
        assets={[asset]}
        disabled={false}
        error={null}
        mainMuscle="Pecho"
        onChange={vi.fn()}
        onUpload={vi.fn()}
        selection={{ assetKind: 'press', customAssetId: asset.id }}
      />,
    )

    expect(screen.getByRole('button', { name: /press\.png/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('announces upload errors', () => {
    const { rerender } = render(
      <ExerciseImageSelector
        assets={[]}
        disabled={false}
        error={null}
        mainMuscle="Pecho"
        onChange={vi.fn()}
        onUpload={vi.fn()}
        selection={{ assetKind: null, customAssetId: null }}
      />,
    )

    rerender(
      <ExerciseImageSelector
        assets={[]}
        disabled={false}
        error="No se pudo cargar la imagen"
        mainMuscle="Pecho"
        onChange={vi.fn()}
        onUpload={vi.fn()}
        selection={{ assetKind: null, customAssetId: null }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la imagen')
  })
})

const asset = {
  createdAt: '2026-08-02T00:00:00.000Z',
  dataUrl: 'data:image/png;base64,AAAA',
  id: 'asset-1',
  mimeType: 'image/png',
  name: 'press.png',
  updatedAt: '2026-08-02T00:00:00.000Z',
}
