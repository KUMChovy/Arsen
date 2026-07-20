// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (callback: () => unknown) => callback(),
}))

vi.mock('../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services')>()

  return {
    ...actual,
    getAppSettings: () => ({
      activeRoutineId: 'routine-1',
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
})
