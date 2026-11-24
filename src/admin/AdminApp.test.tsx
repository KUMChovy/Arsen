// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminApp } from './AdminApp'
import type { AdminClerk } from './clerk'
import type { createAdminApi } from './api'

const makeClerk = (signedIn: boolean) => ({
  session: signedIn ? { id: 'sess_admin', getToken: vi.fn(async () => 'token') } : null,
  load: vi.fn(async () => {}), openSignIn: vi.fn(), signOut: vi.fn(async () => {}), addListener: vi.fn((_listener: () => void) => () => {}),
}) satisfies AdminClerk
const makeApi = () => ({
  overview: vi.fn(async () => ({ accounts: 2, devices: 3, confirmedBackups: 1, publishedExercises: 4 })),
  accounts: vi.fn(async (): Promise<Awaited<ReturnType<ReturnType<typeof createAdminApi>['accounts']>>> => ({ accounts: [{ userId: 'user_athlete', role: 'user' as const, createdAt: '2026-01-01T00:00:00.000Z', deviceCount: 1, backupCount: 1, lastBackupAt: '2026-01-02T00:00:00.000Z' }], nextCursor: null })),
  backups: vi.fn(async (): Promise<Awaited<ReturnType<ReturnType<typeof createAdminApi>['backups']>>> => ({ backups: [] })), drafts: vi.fn(async (): Promise<Awaited<ReturnType<ReturnType<typeof createAdminApi>['drafts']>>> => ({ items: [], nextCursor: null })),
  saveDraft: vi.fn(async () => ({})), publish: vi.fn(async () => ({ version: 1 })), archive: vi.fn(async () => ({ version: 2 })), invite: vi.fn(async (_id: string, _email: string) => ({ id: '8166d21c-bac3-497b-9d22-8492474c982b' })),
  uploadImage: vi.fn(async (_file: Blob, _signal?: AbortSignal) => ({ url: 'https://arsentest.public.blob.vercel-storage.com/catalog/images/8166d21c-bac3-497b-9d22-8492474c982b.png', sha256: 'a'.repeat(64), sizeBytes: 4, mimeType: 'image/png' as const })),
})
afterEach(cleanup)

describe('ARSEN Admin', () => {
  it('does not request private data before signing in', () => {
    const clerk = makeClerk(false)
    const api = makeApi()
    render(<AdminApp clerk={clerk} api={api as unknown as ReturnType<typeof createAdminApi>} />)
    expect(api.overview).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))
    expect(clerk.openSignIn).toHaveBeenCalledOnce()
  })
  it('shows a recoverable message if the sign-in screen cannot open', () => {
    const clerk = makeClerk(false)
    clerk.openSignIn.mockImplementation(() => { throw new Error('private SDK detail') })
    const api = makeApi()
    render(<AdminApp clerk={clerk} api={api as unknown as ReturnType<typeof createAdminApi>} />)
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo abrir/i)
    expect(screen.queryByText(/private SDK detail/)).not.toBeInTheDocument()
  })
  it('displays real overview and account metadata with empty backup state', async () => {
    const api = makeApi()
    render(<AdminApp clerk={makeClerk(true)} api={api as unknown as ReturnType<typeof createAdminApi>} />)
    expect(await screen.findByText('4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cuentas' }))
    fireEvent.click(await screen.findByRole('button', { name: /user_athlete/i }))
    expect(await screen.findByText(/no hay respaldos confirmados/i)).toBeInTheDocument()
    expect(api.backups).toHaveBeenCalledWith('user_athlete')
  })
  it('saves a new catalog draft without publishing it', async () => {
    const api = makeApi()
    render(<AdminApp clerk={makeClerk(true)} api={api as unknown as ReturnType<typeof createAdminApi>} />)
    await screen.findByText('4')
    fireEvent.click(screen.getByRole('button', { name: 'Catálogo' }))
    fireEvent.change(await screen.findByLabelText('Identificador'), { target: { value: 'sentadilla' } })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Sentadilla' } })
    fireEvent.change(screen.getByLabelText('Músculo principal'), { target: { value: 'Piernas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(await screen.findByText(/borrador guardado/i)).toBeInTheDocument()
    expect(api.saveDraft).toHaveBeenCalledWith({ id: 'sentadilla', name: 'Sentadilla', canonicalName: 'sentadilla', aliases: [], mainMuscle: 'Piernas' }, null)
    expect(api.publish).not.toHaveBeenCalled()
  })
  it('attaches an explicitly uploaded image to the draft', async () => {
    const api = makeApi()
    render(<AdminApp clerk={makeClerk(true)} api={api as unknown as ReturnType<typeof createAdminApi>} />)
    await screen.findByText('4')
    fireEvent.click(screen.getByRole('button', { name: 'Catálogo' }))
    fireEvent.change(await screen.findByLabelText('Identificador'), { target: { value: 'sentadilla' } })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Sentadilla' } })
    const file = new File(['data'], 'ejercicio.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Imagen del ejercicio'), { target: { files: [file] } })
    expect(api.uploadImage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Subir imagen' }))
    expect(await screen.findByText(/imagen cargada/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(await screen.findByText(/borrador guardado/i)).toBeInTheDocument()
    expect(api.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ image: expect.objectContaining({ mimeType: 'image/png', sizeBytes: 4 }) }), null)
  })
  it('confirms publication and does not publish when cancelled', async () => {
    const api = makeApi()
    const draft = { id: 'sentadilla', name: 'Sentadilla' }
    api.drafts.mockResolvedValue({ items: [{ id: draft.id, draft, published: null, archived: false, updated_at: '2026-01-01' }], nextCursor: null })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<AdminApp clerk={makeClerk(true)} api={api as unknown as ReturnType<typeof createAdminApi>} />)
    await screen.findByText('4')
    fireEvent.click(screen.getByRole('button', { name: 'Catálogo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }))
    expect(api.publish).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByText(/versión 1 del catálogo/i)).toBeInTheDocument()
    expect(api.publish).toHaveBeenCalledWith('sentadilla')
    confirm.mockRestore()
  })
  it('cancels an image upload when the admin session changes', async () => {
    const api = makeApi()
    let signal: AbortSignal | undefined
    api.uploadImage.mockImplementation((_file: Blob, requestSignal?: AbortSignal) => {
      signal = requestSignal
      return new Promise(() => {})
    })
    const clerk = makeClerk(true)
    let listener!: () => void
    clerk.addListener.mockImplementation((callback) => { listener = callback; return () => {} })
    render(<AdminApp clerk={clerk} api={api as unknown as ReturnType<typeof createAdminApi>} />)
    await screen.findByText('4')
    fireEvent.click(screen.getByRole('button', { name: 'Catálogo' }))
    fireEvent.change(await screen.findByLabelText('Imagen del ejercicio'), { target: { files: [new File(['data'], 'img.png', { type: 'image/png' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Subir imagen' }))
    expect(signal?.aborted).toBe(false)
    await act(async () => { clerk.session = null; listener() })
    expect(signal?.aborted).toBe(true)
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument()
  })
  it('shows a permission error without showing fabricated metrics', async () => {
    const api = makeApi()
    api.overview.mockRejectedValue(new Error('No tienes permiso para esta operación'))
    render(<AdminApp clerk={makeClerk(true)} api={api as unknown as ReturnType<typeof createAdminApi>} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/no tienes permiso/i)
    expect(screen.queryByText('4')).not.toBeInTheDocument()
  })
  it('reuses an invitation ID when an uncertain request is retried', async () => {
    const api = makeApi()
    api.invite.mockRejectedValueOnce(new Error('network unavailable'))
    render(<AdminApp clerk={makeClerk(true)} api={api as unknown as ReturnType<typeof createAdminApi>} />)
    await screen.findByText('4')
    fireEvent.click(screen.getByRole('button', { name: 'Invitaciones' }))
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'atleta@example.test' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar invitación' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }))
    expect(await screen.findByText(/invitación solicitada/i)).toBeInTheDocument()
    expect(api.invite).toHaveBeenCalledTimes(2)
    expect(api.invite.mock.calls[0]?.[0]).toBe(api.invite.mock.calls[1]?.[0])
  })
  it('does not submit two invitations while one request is pending', async () => {
    const api = makeApi()
    api.invite.mockImplementation(() => new Promise(() => {}))
    render(<AdminApp clerk={makeClerk(true)} api={api as unknown as ReturnType<typeof createAdminApi>} />)
    await screen.findByText('4')
    fireEvent.click(screen.getByRole('button', { name: 'Invitaciones' }))
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'atleta@example.test' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar invitación' })).toBeEnabled())
    const form = screen.getByRole('button', { name: 'Enviar invitación' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(api.invite).toHaveBeenCalledTimes(1)
  })
  it('does not display a previous account response after the admin session changes', async () => {
    const api = makeApi()
    let resolveBackups!: (value: Awaited<ReturnType<typeof api.backups>>) => void
    api.backups.mockImplementation(() => new Promise((resolve) => { resolveBackups = resolve }))
    const clerk = makeClerk(true)
    let listener!: () => void
    clerk.addListener.mockImplementation((callback) => { listener = callback; return () => {} })
    render(<AdminApp clerk={clerk} api={api as unknown as ReturnType<typeof createAdminApi>} />)
    await screen.findByText('4')
    fireEvent.click(screen.getByRole('button', { name: 'Cuentas' }))
    fireEvent.click(await screen.findByRole('button', { name: /user_athlete/i }))
    await act(async () => { clerk.session = null; listener() })
    await act(async () => { clerk.session = { id: 'sess_other', getToken: vi.fn(async () => 'other') }; listener() })
    await act(async () => { resolveBackups({ backups: [{ id: '8166d21c-bac3-497b-9d22-8492474c982b', deviceId: '67c5f68b-13e4-48e7-9a64-2dc6dc68d905', localRevision: 4, contractVersion: 1, sizeBytes: 100, includesHealth: false, confirmedAt: '2026-01-01T00:00:00.000Z' }] }) })
    expect(screen.queryByText(/8166d21c-bac3/)).not.toBeInTheDocument()
  })
  it('keeps an unfinished draft when Clerk refreshes the same session', async () => {
    const api = makeApi()
    const clerk = makeClerk(true)
    let listener!: () => void
    clerk.addListener.mockImplementation((callback) => { listener = callback; return () => {} })
    render(<AdminApp clerk={clerk} api={api as unknown as ReturnType<typeof createAdminApi>} />)
    await screen.findByText('4')
    fireEvent.click(screen.getByRole('button', { name: 'Catálogo' }))
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Trabajo en curso' } })
    await act(async () => { clerk.session = { id: 'sess_admin', getToken: vi.fn(async () => 'refreshed') }; listener() })
    expect(screen.getByLabelText('Nombre')).toHaveValue('Trabajo en curso')
  })
  it('does not mix backup results when the selected account changes', async () => {
    const api = makeApi()
    let resolveFirst!: (value: Awaited<ReturnType<typeof api.backups>>) => void
    api.backups.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
    api.backups.mockResolvedValueOnce({ backups: [] })
    api.accounts.mockResolvedValue({ accounts: [
      { userId: 'user_first', role: 'user', createdAt: '2026-01-01T00:00:00.000Z', deviceCount: 1, backupCount: 1, lastBackupAt: null },
      { userId: 'user_second', role: 'user', createdAt: '2026-01-01T00:00:00.000Z', deviceCount: 1, backupCount: 0, lastBackupAt: null },
    ], nextCursor: null })
    render(<AdminApp clerk={makeClerk(true)} api={api as unknown as ReturnType<typeof createAdminApi>} />)
    await screen.findByText('4')
    fireEvent.click(screen.getByRole('button', { name: 'Cuentas' }))
    fireEvent.click(await screen.findByRole('button', { name: /user_first/i }))
    fireEvent.click(screen.getByRole('button', { name: /user_second/i }))
    expect(await screen.findByText(/no hay respaldos confirmados/i)).toBeInTheDocument()
    await act(async () => { resolveFirst({ backups: [{ id: '8166d21c-bac3-497b-9d22-8492474c982b', deviceId: '67c5f68b-13e4-48e7-9a64-2dc6dc68d905', localRevision: 4, contractVersion: 1, sizeBytes: 100, includesHealth: false, confirmedAt: '2026-01-01T00:00:00.000Z' }] }) })
    expect(screen.queryByText(/8166d21c-bac3/)).not.toBeInTheDocument()
  })
})
