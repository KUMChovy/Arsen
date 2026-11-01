// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'
import { updateAvailablePlateWeights, updateDeloadReductionSettings } from '../services'

const settingsPageMocks = vi.hoisted(() => ({
  completeActiveDeload: vi.fn(() => Promise.resolve()),
  requestDeloadNotifications: vi.fn(() => Promise.resolve('granted')),
  scheduleDeload: vi.fn(() => Promise.resolve()),
  skipDeloadSuggestion: vi.fn(() => Promise.resolve()),
  startDeloadNow: vi.fn(() => Promise.resolve()),
  updateAvailablePlateWeights: vi.fn(() => Promise.resolve()),
  updateDeloadReductionSettings: vi.fn(() => Promise.resolve()),
}))

const healthPageMocks = vi.hoisted(() => ({
  disableHealthIntegration: vi.fn(() => Promise.resolve()),
  enableHealthIntegration: vi.fn(() => Promise.resolve({ granted: [] as string[], requested: [] as string[] })),
  getHealthAvailability: vi.fn(() => Promise.resolve({ status: 'available' })),
  getHealthPermissions: vi.fn(() => Promise.resolve({ granted: [], requested: [] })),
  isHealthConnectAvailabilityError: vi.fn(() => false),
  openHealthConnectAccess: vi.fn(() => Promise.resolve()),
  openHealthConnectInstall: vi.fn(() => Promise.resolve()),
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
      deloadSeriesReductionPercent: 50,
      deloadWeightReductionPercent: 80,
      id: 'app',
      preferredUnit: 'kg',
      storagePersisted: true,
    }),
    getDeloadOverview: () => ({
      anchorDate: '2026-07-01',
      cooldownUntil: null,
      currentCycle: {
        id: 'deload-1',
        status: 'suggested',
        suggestedAt: '2026-08-05',
      },
      daysRemaining: null,
      firstLogDate: '2026-07-01',
      lastCompletedDate: null,
      phase: 'suggested',
      seriesReductionPercent: 50,
      shouldNotify: true,
      weeksSinceAnchor: 5,
      weightReductionPercent: 80,
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
    completeActiveDeload: settingsPageMocks.completeActiveDeload,
    scheduleDeload: settingsPageMocks.scheduleDeload,
    skipDeloadSuggestion: settingsPageMocks.skipDeloadSuggestion,
    startDeloadNow: settingsPageMocks.startDeloadNow,
    updateAvailablePlateWeights: settingsPageMocks.updateAvailablePlateWeights,
    updateDeloadReductionSettings: settingsPageMocks.updateDeloadReductionSettings,
  }
})

vi.mock('../notifications', () => ({
  requestDeloadNotifications: settingsPageMocks.requestDeloadNotifications,
}))

vi.mock('../../routine/importExport', () => ({
  importRoutineJson: vi.fn(),
}))

vi.mock('../../health/services', () => healthPageMocks)

describe('SettingsPage', () => {
  afterEach(() => {
    cleanup()
    settingsPageMocks.completeActiveDeload.mockClear()
    settingsPageMocks.requestDeloadNotifications.mockClear()
    settingsPageMocks.scheduleDeload.mockClear()
    settingsPageMocks.skipDeloadSuggestion.mockClear()
    settingsPageMocks.startDeloadNow.mockClear()
    settingsPageMocks.updateAvailablePlateWeights.mockClear()
    settingsPageMocks.updateDeloadReductionSettings.mockClear()
    healthPageMocks.disableHealthIntegration.mockClear()
    healthPageMocks.enableHealthIntegration.mockClear()
    healthPageMocks.getHealthAvailability.mockClear()
    healthPageMocks.getHealthPermissions.mockClear()
    healthPageMocks.isHealthConnectAvailabilityError.mockClear()
    healthPageMocks.openHealthConnectAccess.mockClear()
    healthPageMocks.openHealthConnectInstall.mockClear()
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

  it('shows actionable deload settings', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Sugerido')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar deload ahora' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ahora no' })).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha de inicio deload')).toHaveAttribute('type', 'date')
    expect(screen.getByRole('button', { name: 'Programar deload' })).toBeInTheDocument()
    expect(screen.getByLabelText('Series deload')).toHaveValue(50)
    expect(screen.getByLabelText('Peso deload')).toHaveValue(80)
    expect(screen.getByRole('button', { name: 'Guardar deload' })).toBeInTheDocument()
  })

  it('defers Health Connect detection until activation', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )

    expect(healthPageMocks.getHealthAvailability).not.toHaveBeenCalled()
    expect(screen.getByText(/Mi Fitness/i)).toBeInTheDocument()
    expect(healthPageMocks.enableHealthIntegration).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Activar integración' }))

    await waitFor(() => {
      expect(healthPageMocks.enableHealthIntegration).toHaveBeenCalledOnce()
    })
  })

  it('refreshes the granted permission count after activation', async () => {
    healthPageMocks.enableHealthIntegration.mockResolvedValueOnce({
      granted: ['android.permission.health.READ_STEPS', 'android.permission.health.READ_HEART_RATE'],
      requested: [],
    })

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Activar integración' }))

    await waitFor(() => {
      expect(screen.getByText('2 de 4 permisos activos')).toBeInTheDocument()
    })
  })

  it('opens installation from activation when Health Connect is unavailable', async () => {
    const availabilityError = Object.assign(new Error('Health Connect no está disponible'), { status: 'unavailable' })
    healthPageMocks.enableHealthIntegration.mockRejectedValueOnce(availabilityError)
    healthPageMocks.isHealthConnectAvailabilityError.mockReturnValue(true)

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Activar integración' }))

    await waitFor(() => {
      expect(healthPageMocks.openHealthConnectInstall).toHaveBeenCalledOnce()
    })
    expect(screen.getByText('Health Connect no está instalado. Se abrió Google Play.')).toBeInTheDocument()
  })

  it('offers the Play Store when Health Connect is unavailable', async () => {
    healthPageMocks.enableHealthIntegration.mockRejectedValueOnce(new Error('Health Connect no está disponible'))
    healthPageMocks.isHealthConnectAvailabilityError.mockReturnValue(true)

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Activar integración' }))

    await waitFor(() => {
      expect(healthPageMocks.openHealthConnectInstall).toHaveBeenCalledOnce()
    })
  })

  it('saves configurable deload reductions', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Series deload'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('Peso deload'), { target: { value: '70' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar deload' }))

    await waitFor(() => {
      expect(updateDeloadReductionSettings).toHaveBeenCalledWith({
        seriesReductionPercent: 60,
        weightReductionPercent: 70,
      })
    })
  })
})
