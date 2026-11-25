// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from './AccountPage'
import { completeVerification, getAccountState, signIn, signOut } from '../services'
import { prepareManualBackup, queueManualBackup, requestBackupNotifications, getBackupStatus } from '../backupService'
import { prepareRestorePreview, applyRestorePreview, listRestoreVersions } from '../restoreService'
import { enableAutomaticBackup, disableAutomaticBackup, isAutomaticBackupEnabled, getAutomaticBackupSchedule, observeAutomaticPreparation } from '../automaticBackup'

vi.mock('../services', () => ({
  getAccountState: vi.fn(), signIn: vi.fn(), completeVerification: vi.fn(), signOut: vi.fn(),
}))
vi.mock('../backupService', () => ({ prepareManualBackup: vi.fn(), queueManualBackup: vi.fn(), requestBackupNotifications: vi.fn(), getBackupStatus: vi.fn() }))
vi.mock('../restoreService', () => ({ prepareRestorePreview: vi.fn(), applyRestorePreview: vi.fn(), listRestoreVersions: vi.fn() }))
vi.mock('../automaticBackup', () => ({ enableAutomaticBackup: vi.fn(), disableAutomaticBackup: vi.fn(), isAutomaticBackupEnabled: vi.fn(), getAutomaticBackupSchedule: vi.fn(), observeAutomaticPreparation: vi.fn(() => () => undefined) }))

describe('Cuenta y respaldo', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(getAccountState).mockResolvedValue({ status: 'signed-out' }); vi.mocked(getBackupStatus).mockResolvedValue({ owner: 'user_abc', localRevision: 8, pending: false, confirmed: null, unpreparedChanges: null }); vi.mocked(isAutomaticBackupEnabled).mockResolvedValue(false); vi.mocked(getAutomaticBackupSchedule).mockResolvedValue(null) })
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
    vi.mocked(queueManualBackup).mockResolvedValue('queued')
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

  it('allows selection of a confirmed version before restoring', async () => {
    vi.mocked(getAccountState).mockResolvedValue({ status: 'signed-in', email: 'atleta@example.test' })
    const summary = { id: '8166d21c-bac3-497b-9d22-8492474c982b', deviceId: '67c5f68b-13e4-48e7-9a64-2dc6dc68d905', localRevision: 3, contractVersion: 1 as const, sizeBytes: 1024, includesHealth: false, confirmedAt: '2026-11-23T12:00:00.000Z' }
    vi.mocked(listRestoreVersions).mockResolvedValue({ owner: 'user_abc', backups: [summary] })
    vi.mocked(prepareRestorePreview).mockResolvedValue({ owner: 'user_abc', summary, localRevision: 7, backup: { manifest: '{}', manifestSha256: 'a'.repeat(64), revision: 3, binaries: [] } })
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Consultar versiones' }))
    fireEvent.click(await screen.findByRole('button', { name: /seleccionar copia/i }))
    expect(await screen.findByText(/reemplazará los datos locales/i)).toBeInTheDocument()
    expect(prepareRestorePreview).toHaveBeenCalledWith(summary.id)
    expect(applyRestorePreview).not.toHaveBeenCalled()
  })

  it('explains when Android notification permission is unavailable', async () => {
    vi.mocked(getAccountState).mockResolvedValue({ status: 'signed-in', email: 'atleta@example.test' })
    vi.mocked(requestBackupNotifications).mockResolvedValue(false)
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Activar notificaciones de respaldo' }))
    expect(await screen.findByText(/notificaciones.*desactivadas/i)).toBeInTheDocument()
  })

  it('distinguishes a pending prepared copy from the last cloud confirmation', async () => {
    vi.mocked(getAccountState).mockResolvedValue({ status: 'signed-in', email: 'atleta@example.test' })
    vi.mocked(getBackupStatus).mockResolvedValue({ owner: 'user_abc', localRevision: 8, pending: true, unpreparedChanges: true, confirmed: { id: '8166d21c-bac3-497b-9d22-8492474c982b', deviceId: '67c5f68b-13e4-48e7-9a64-2dc6dc68d905', localRevision: 3, contractVersion: 1, sizeBytes: 1024, includesHealth: false, confirmedAt: '2026-11-23T12:00:00.000Z' } })
    show()
    expect(await screen.findByText(/copia preparada pendiente/i)).toBeInTheDocument()
    expect(screen.getByText(/última copia confirmada/i)).toBeInTheDocument()
  })

  it('requires confirmation before enabling automatic backup over existing remote history', async () => {
    vi.mocked(getAccountState).mockResolvedValue({ status: 'signed-in', email: 'atleta@example.test' })
    const context = { status: 'READY', owner: 'user_abc', deviceId: '67c5f68b-13e4-48e7-9a64-2dc6dc68d905', baseBackupId: '8166d21c-bac3-497b-9d22-8492474c982b' } as const
    vi.mocked(prepareManualBackup).mockResolvedValue(context)
    vi.mocked(enableAutomaticBackup).mockResolvedValue('queued')
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Activar respaldo automático' }))
    expect(await screen.findByText(/ya existe un respaldo/i)).toBeInTheDocument()
    expect(enableAutomaticBackup).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con este dispositivo' }))
    await waitFor(() => expect(enableAutomaticBackup).toHaveBeenCalledWith(context))
  })
  it('does not claim a new copy is pending when identical content was already confirmed', async () => {
    vi.mocked(getAccountState).mockResolvedValue({ status: 'signed-in', email: 'atleta@example.test' })
    const context = { status: 'READY', owner: 'user_abc', deviceId: '67c5f68b-13e4-48e7-9a64-2dc6dc68d905', baseBackupId: '8166d21c-bac3-497b-9d22-8492474c982b' } as const
    vi.mocked(prepareManualBackup).mockResolvedValue(context)
    vi.mocked(enableAutomaticBackup).mockResolvedValue('unchanged')
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Activar respaldo automático' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar con este dispositivo' }))
    expect(await screen.findByText(/datos coinciden con la última copia confirmada/i)).toBeInTheDocument()
  })

  it('allows disabling automatic backup without deleting a pending copy', async () => {
    vi.mocked(getAccountState).mockResolvedValue({ status: 'signed-in', email: 'atleta@example.test' })
    vi.mocked(isAutomaticBackupEnabled).mockResolvedValue(true)
    vi.mocked(disableAutomaticBackup).mockResolvedValue(undefined)
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar respaldo automático' }))
    await waitFor(() => expect(disableAutomaticBackup).toHaveBeenCalled())
    expect(await screen.findByText(/copias pendientes se conservan/i)).toBeInTheDocument()
  })
  it('shows recoverable automatic preparation errors without claiming cloud confirmation', async () => {
    vi.mocked(getAccountState).mockResolvedValue({ status: 'signed-in', email: 'atleta@example.test' })
    vi.mocked(isAutomaticBackupEnabled).mockResolvedValue(true)
    vi.mocked(observeAutomaticPreparation).mockImplementation((observer) => { observer('error'); return () => undefined })
    show()
    expect(await screen.findByText(/no se pudo preparar la copia automática/i)).toBeInTheDocument()
    expect(screen.getByText(/no hay copias confirmadas en la nube/i)).toBeInTheDocument()
  })
})
