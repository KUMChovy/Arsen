// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'

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
  })
})
