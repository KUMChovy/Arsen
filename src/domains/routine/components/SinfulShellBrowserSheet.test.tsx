// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseCatalogItem } from '../types'
import { SinfulShellBrowserSheet } from './SinfulShellBrowserSheet'

describe('SinfulShellBrowserSheet', () => {
  afterEach(cleanup)

  it('searches by alias and opens detail before import', () => {
    const onAddCopy = vi.fn()

    render(
      <SinfulShellBrowserSheet
        catalog={[]}
        disabled={false}
        mode="catalog"
        onAddCopy={onAddCopy}
        onClose={vi.fn()}
        onViewCatalogCopy={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en Sinful Shell' }), { target: { value: 'lat pulldown' } })
    fireEvent.click(screen.getByRole('button', { name: /Jal.n al pecho/i }))

    expect(screen.getByRole('heading', { name: /Jal.n al pecho/i })).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.getByText(/M.sculo principal:/i)).toBeInTheDocument()
    expect(onAddCopy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Agregar a mi catalogo' }))
    expect(onAddCopy).toHaveBeenCalledWith(expect.objectContaining({ id: 'sinful-shell-jalon-al-pecho' }))
  })

  it('filters by muscle chips', () => {
    render(
      <SinfulShellBrowserSheet
        catalog={[]}
        disabled={false}
        mode="catalog"
        onAddCopy={vi.fn()}
        onClose={vi.fn()}
        onViewCatalogCopy={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pecho' }))

    const results = screen.getByTestId('sinful-shell-results')
    expect(within(results).getByRole('button', { name: 'Press inclinado Disponible' })).toBeInTheDocument()
    expect(within(results).queryByRole('button', { name: /Jal.n al pecho/i })).not.toBeInTheDocument()
  })

  it('shows already-added actions for existing copies', () => {
    const catalogCopy = catalogItem({
      id: 'catalog-copy',
      name: 'Press inclinado',
      sinfulShellId: 'sinful-shell-press-inclinado',
    })
    const onViewCatalogCopy = vi.fn()
    const onAddCopyToRoutine = vi.fn()

    render(
      <SinfulShellBrowserSheet
        catalog={[catalogCopy]}
        disabled={false}
        mode="routine-add"
        onAddCopy={vi.fn()}
        onAddCopyToRoutine={onAddCopyToRoutine}
        onClose={vi.fn()}
        onViewCatalogCopy={onViewCatalogCopy}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Press inclinado Agregado' }))
    expect(screen.getByText('Ya agregado')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver en mi catalogo' }))
    expect(onViewCatalogCopy).toHaveBeenCalledWith(catalogCopy)

    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la rutina' }))
    expect(onAddCopyToRoutine).toHaveBeenCalledWith(catalogCopy)
  })
})

function catalogItem(overrides: Partial<ExerciseCatalogItem>): ExerciseCatalogItem {
  return {
    aliases: [],
    assetKind: null,
    barWeightKg: 20,
    bundledAssetId: null,
    canonicalName: 'press-inclinado',
    createdAt: '2026-08-11T00:00:00.000Z',
    customAssetId: null,
    defaultRecommendedRir: 2,
    defaultRepsMax: 10,
    defaultRepsMin: 8,
    defaultRestSeconds: 90,
    defaultTargetSets: 3,
    equipment: 'Barra',
    id: 'catalog-1',
    loadMode: 'single',
    mainMuscle: 'Pecho',
    name: 'Press inclinado',
    origin: 'sinful-shell',
    sinfulShellContentLocked: true,
    sinfulShellId: null,
    technicalNotes: '',
    updatedAt: '2026-08-11T00:00:00.000Z',
    warmupProtocol: 'none',
    ...overrides,
  }
}
