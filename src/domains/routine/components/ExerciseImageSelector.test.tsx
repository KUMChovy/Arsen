// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExerciseImageSelector } from './ExerciseImageSelector'

describe('ExerciseImageSelector', () => {
  afterEach(() => {
    cleanup()
  })

  it('preselects the exercise muscle and filters bundled images by chip', () => {
    renderSelector({ mainMuscle: 'Pecho' })

    expect(screen.getByRole('button', { name: 'Pecho' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Press inclinado$/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Espalda' }))

    expect(screen.getByRole('button', { name: 'Espalda' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: /^Press inclinado$/ })).not.toBeInTheDocument()
  })

  it('combines search with the active muscle filter and supports aliases', () => {
    renderSelector({ mainMuscle: 'Pecho' })

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar imagen' }), { target: { value: 'banca' } })

    expect(screen.getByRole('button', { name: /Press plano/ })).toBeInTheDocument()
  })

  it('keeps a draft selection until the user confirms', () => {
    const onChange = vi.fn()
    renderSelector({ onChange })

    fireEvent.click(screen.getByRole('button', { name: /^Press inclinado$/ }))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Usar imagen' }))
    expect(onChange).toHaveBeenCalledWith({ bundledAssetId: 'press-inclinado--pecho', customAssetId: null })
  })

  it('keeps custom upload visible and announces upload errors', () => {
    renderSelector({ error: 'No se pudo cargar la imagen' })

    expect(screen.getByLabelText('Subir imagen propia')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la imagen')
  })
})

function renderSelector(overrides: Partial<Parameters<typeof ExerciseImageSelector>[0]> = {}) {
  return render(
    <ExerciseImageSelector
      assets={[asset]}
      disabled={false}
      error={null}
      mainMuscle="Pecho"
      onChange={vi.fn()}
      onClose={vi.fn()}
      onUpload={vi.fn()}
      selection={{ bundledAssetId: null, customAssetId: null }}
      {...overrides}
    />,
  )
}

const asset = {
  createdAt: '2026-08-02T00:00:00.000Z',
  dataUrl: 'data:image/png;base64,AAAA',
  id: 'asset-1',
  mimeType: 'image/png',
  name: 'press.png',
  updatedAt: '2026-08-02T00:00:00.000Z',
}
