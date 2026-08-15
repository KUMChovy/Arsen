// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'


vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (callback: () => unknown) => callback(),
}))

vi.mock('../domains/settings/services', () => ({
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

describe('AppShell', () => {
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
    expect(screen.getByRole('link', { name: 'Entreno' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Rutina' })).toHaveAttribute('href', '/rutina')
    expect(screen.getByRole('link', { name: 'Progreso' })).toHaveAttribute('href', '/progreso')
    expect(screen.getByRole('link', { name: 'Ajustes' })).toHaveAttribute('href', '/settings')
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-deload-active', 'true')
  })
})
