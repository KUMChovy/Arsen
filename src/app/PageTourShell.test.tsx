// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { db } from '../db/schema'
import { PageHeader } from '../shared/components/PageHeader'
import { PageTourShell } from './PageTourShell'

vi.mock('../domains/settings/NotificationPanel', () => ({ NotificationCenterHost: () => null }))
beforeEach(async () => { db.close(); await db.delete(); await db.open() })
afterEach(async () => { cleanup(); db.close(); await db.delete() })
it('waits for the general guide, remembers skipping, and lets the user reopen the page guide', async () => {
  await db.localMetadata.put({ id: 'productTour', value: 'pending' })
  const router = createMemoryRouter([{ path: '/', element: <main><PageTourShell><PageHeader title="Entreno" /></PageTourShell></main> }])
  render(<RouterProvider router={router} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await db.localMetadata.put({ id: 'productTour', value: 'completed' })
  expect(await screen.findByRole('dialog')).toHaveTextContent('Entreno de hoy')
  fireEvent.click(screen.getByRole('button', { name: 'Omitir recorrido' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await db.localMetadata.get('pageTours')).toEqual({ id: 'pageTours', value: ['workout'] })
  fireEvent.click(screen.getByRole('button', { name: 'Ayuda de esta página' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
