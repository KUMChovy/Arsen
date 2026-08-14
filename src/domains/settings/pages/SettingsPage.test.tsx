// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'
import { updateAvailablePlateWeights } from '../services'

const settingsPageMocks = vi.hoisted(() => ({
  updateAvailablePlateWeights: vi.fn(() => Promise.resolve()),
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (callback: () => unknown) => callback(),
}))

vi.mock('../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services')>()

  return {
    ...actual,
    getAppSettings: () => ({
      activeRoutineId: 'routine-1',
      availablePlateWeightsKg: [25, 20, 15, 10, 5, 2.5, 1.25],
      deloadNotifications: true,
      id: 'app',
      preferredUnit: 'kg',
      storagePersisted: true,
    }),
    getStorageOverview: () => ({
      exerciseLogs: 2,
      persisted: true,
      quota: 5 * 1024 * 1024,
      routines: 1,
      sessions: 3,
      setLogs: 8,
      usage: 1024 * 1024,
    }),
    updateAvailablePlateWeights: settingsPageMocks.updateAvailablePlateWeights,
  }
})

vi.mock('../notifications', () => ({
  getDeloadOverview: () => ({
    firstLogDate: '2026-07-01',
    shouldNotify: false,
    weeks: 2,
  }),
  requestDeloadNotifications: vi.fn(),
}))

vi.mock('../../routine/importExport', () => ({
  importRoutineJson: vi.fn(),
}))

describe('SettingsPage', () => {
  afterEach(() => {
    cleanup()
    settingsPageMocks.updateAvailablePlateWeights.mockClear()
  })

  it('shows safe backup import modes and cleanup controls', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar respaldo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fusionar respaldo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reemplazar respaldo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar progreso/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Borrar rango de fechas/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Desde')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Hasta')).toHaveAttribute('type', 'date')
  })

  it('saves configurable available plates from the preferred unit', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('Discos disponibles')).toHaveValue('25, 20, 15, 10, 5, 2.5, 1.25')

    fireEvent.change(screen.getByLabelText('Discos disponibles'), { target: { value: '20, 10, 2.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar discos' }))

    await waitFor(() => {
      expect(updateAvailablePlateWeights).toHaveBeenCalledWith([20, 10, 2.5])
    })
  })
})
