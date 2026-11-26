// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useOutletContext } from 'react-router-dom'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'
import type { WorkoutActionContext } from './workoutAction'


vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (callback: () => unknown) => callback(),
}))

vi.mock('../domains/settings/hooks', async () => {
  const services = await import('../domains/settings/services')
  return { useDeloadOverview: () => services.getDeloadOverview() }
})

vi.mock('../domains/settings/services', () => ({
  getAppSettings: () => ({ healthIntegrationEnabled: false }),
  getDeloadOverview: () => ({
    anchorDate: '2026-02-01',
    cooldownUntil: null,
    currentCycle: { id: 'deload-1', status: 'active' },
    daysRemaining: 5,
    firstLogDate: '2026-01-01',
    lastCompletedDate: null,
    phase: 'active',
    seriesReductionPercent: 50,
    shouldNotify: false,
    weeksSinceAnchor: 0,
    weightReductionPercent: 80,
  }),
}))
vi.mock('./providers', () => ({
  useAppProviders: () => ({
    databaseError: null,
    databaseStatus: 'ready',
  }),
}))
vi.mock('../domains/settings/NotificationPanel', () => ({ NotificationCenterHost: () => null }))
vi.mock('../domains/settings/notificationCenter', () => ({ syncNotices: vi.fn(async () => {}) }))
vi.mock('../domains/account/automaticBackup', () => ({ observeAutomaticPreparation: () => () => {} }))
vi.mock('./ProductTour', () => ({ ProductTourHost: () => null }))
vi.mock('./PageTourShell', () => ({ PageTourShell: ({ children }: { children: React.ReactNode }) => children }))

describe('AppShell', () => {
  afterEach(cleanup)
  it('renders mobile navigation and current route content', () => {
    const router = createMemoryRouter(
      [
        {
          element: <AppShell />,
          children: [{ path: '/', element: <h1>Entreno de hoy</h1> }],
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { name: 'Entreno de hoy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar ejercicio' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Rutina' })).toHaveAttribute('href', '/rutina')
    expect(screen.getByRole('link', { name: 'Progreso' })).toHaveAttribute('href', '/progreso')
    expect(screen.getByRole('link', { name: 'Historial' })).toHaveAttribute('href', '/historial')
    expect(screen.getByRole('link', { name: 'Ajustes' })).toHaveAttribute('href', '/settings')
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-deload-active', 'true')
  })

  it('opens the current exercise from the central action', async () => {
    const open = vi.fn()
    function Workout() {
      const { setWorkoutAction } = useOutletContext<WorkoutActionContext>()
      useEffect(() => { setWorkoutAction(() => open); return () => setWorkoutAction(null) }, [setWorkoutAction])
      return <p>Entreno</p>
    }
    const router = createMemoryRouter([{ element: <AppShell />, children: [{ path: '/', element: <Workout /> }] }])
    render(<RouterProvider router={router} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar ejercicio' }))
    expect(open).toHaveBeenCalledOnce()
  })
})
