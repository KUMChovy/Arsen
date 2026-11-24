// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from './AccountPage'
import { completeVerification, getAccountState, signIn, signOut } from '../services'
import { prepareManualBackup, queueManualBackup } from '../backupService'
import { prepareRestorePreview, applyRestorePreview } from '../restoreService'

vi.mock('../services', () => ({
  getAccountState: vi.fn(), signIn: vi.fn(), completeVerification: vi.fn(), signOut: vi.fn(),
}))
vi.mock('../backupService', () => ({ prepareManualBackup: vi.fn(), queueManualBackup: vi.fn() }))
vi.mock('../restoreService', () => ({ prepareRestorePreview: vi.fn(), applyRestorePreview: vi.fn() }))

describe('Cuenta y respaldo', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(getAccountState).mockResolvedValue({ status: 'signed-out' }) })
  afterEach(cleanup)
  const show = () => render(<MemoryRouter><AccountPage /></MemoryRouter>)

  it('allows a guest to enter credentials without promising automatic backups', async () => {
    show()
    expect(await screen.findByRole('heading', { name: /tu cuenta/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByRole('link', { name: /seguir como invitado/i })).toBeInTheDocument()
    expect(screen.getByText(/iniciar sesión no activa/i)).toBeInTheDocument()
  })

  it('submits credentials, clears the password and shows the account', async () => {
    vi.mocked(signIn).mockResolvedValue({ status: 'signed-in', email: 'atleta@example.test' })
    show()
    fireEvent.change(await screen.findByLabelText('Correo electrónico'), { target: { value: 'atleta@example.test' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-de-prueba' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('atleta@example.test')).toBeInTheDocument()
    expect(signIn).toHaveBeenCalledWith('atleta@example.test', 'clave-de-prueba')
    expect(screen.queryByDisplayValue('clave-de-prueba')).not.toBeInTheDocument()
    expect(screen.getByText(/respaldo automático.*pendiente/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /volver al entrenamiento/i })).toBeInTheDocument()
  })

  it('offers additional verification only when Clerk requests it', async () => {
    vi.mocked(signIn).mockResolvedValue({ status: 'verification-required' })
    vi.mocked(completeVerification).mockResolvedValue({ status: 'signed-in', email: 'atleta@example.test' })
    show()
    fireEvent.change(await screen.findByLabelText('Correo electrónico'), { target: { value: 'a@example.test' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    fireEvent.click(await screen.findByRole('button', { name: /completar verificación/i }))
    expect(await screen.findByText('atleta@example.test')).toBeInTheDocument()
  })

  it('shows unavailable and failed states without exposing errors', async () => {
    vi.mocked(getAccountState).mockResolvedValueOnce({ status: 'unavailable' })
    show()
    expect(await screen.findByText(/disponible en la app android/i)).toBeInTheDocument()
    cleanup()
    vi.mocked(getAccountState).mockResolvedValue({ status: 'signed-out' })
    vi.mocked(signIn).mockRejectedValue(new Error('internal-token'))
    show()
    fireEvent.change(await screen.findByLabelText('Correo electrónico'), { target: { value: 'a@example.test' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo iniciar sesión/i))
    expect(screen.queryByText(/internal-token/)).not.toBeInTheDocument()
  })

  it('signs out only after the requested action', async () => {
    vi.mocked(getAccountState).mockResolvedValue({ status: 'signed-in', email: 'atleta@example.test' })
    vi.mocked(signOut).mockResolvedValue(undefined)
    show()
    fireEvent.click(await screen.findByRole('button', { name: /cerrar sesión/i }))
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('requires a separate confirmation when a remote backup already exists', async () => {
    vi.mocked(getAccountState).mockResolvedValue({ status: 'signed-in', email: 'atleta@example.test' })
    const context = { status: 'READY', owner: 'user_abc', deviceId: '67c5f68b-13e4-48e7-9a64-2dc6dc68d905', baseBackupId: '8166d21c-bac3-497b-9d22-8492474c982b' } as const
    vi.mocked(prepareManualBackup).mockResolvedValue(context)
    vi.mocked(queueManualBackup).mockResolvedValue(undefined)
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Preparar respaldo' }))
    expect(await screen.findByText(/ya existe un respaldo/i)).toBeInTheDocument()
    expect(queueManualBackup).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con este dispositivo' }))
    await waitFor(() => expect(queueManualBackup).toHaveBeenCalledWith(context))
    expect(await screen.findByText(/copia preparada para envío/i)).toBeInTheDocument()
  })

  it('shows restore details and requires explicit confirmation before replacing local data', async () => {
    vi.mocked(getAccountState).mockResolvedValue({ status: 'signed-in', email: 'atleta@example.test' })
    const preview = { owner: 'user_abc', summary: { id: '8166d21c-bac3-497b-9d22-8492474c982b', deviceId: '67c5f68b-13e4-48e7-9a64-2dc6dc68d905', localRevision: 3, contractVersion: 1 as const, sizeBytes: 1024, includesHealth: false, confirmedAt: '2026-11-23T12:00:00.000Z' }, localRevision: 7, backup: { manifest: '{}', manifestSha256: 'a'.repeat(64), revision: 3, binaries: [] } }
    vi.mocked(prepareRestorePreview).mockResolvedValue(preview)
    vi.mocked(applyRestorePreview).mockResolvedValue(undefined)
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver respaldo para restaurar' }))
    expect(await screen.findByText(/reemplazará los datos locales/i)).toBeInTheDocument()
    expect(applyRestorePreview).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar datos locales' }))
    await waitFor(() => expect(applyRestorePreview).toHaveBeenCalledWith(preview))
    expect(await screen.findByText(/datos restaurados/i)).toBeInTheDocument()
  })
})
