// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NotificationPreferences } from './NotificationPreferences'
import { setNoticeCenterEnabled } from './notificationCenter'
import { requestBackupNotifications } from '../account/backupService'

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => true }))
vi.mock('./notificationCenter', () => ({ getNoticeCenterEnabled: vi.fn(), setNoticeCenterEnabled: vi.fn(async () => {}) }))
vi.mock('../account/backupService', () => ({ requestBackupNotifications: vi.fn(async () => true), openBackupNotificationSettings: vi.fn(async () => {}) }))
vi.mock('../account/native', () => ({ isNativeAccount: () => true }))
afterEach(cleanup)
it('configures the internal center and requests Android permission only on demand', async () => {
  render(<NotificationPreferences />)
  fireEvent.click(screen.getByRole('switch', { name: 'Avisos en el centro' }))
  await waitFor(() => expect(setNoticeCenterEnabled).toHaveBeenCalledWith(false))
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar permiso de Android' }))
  await waitFor(() => expect(requestBackupNotifications).toHaveBeenCalledOnce())
  expect(await screen.findByText('Notificaciones de Android permitidas.')).toBeInTheDocument()
})
