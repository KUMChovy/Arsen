// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccessGate } from './AccessGate'
import { isNativeAccount } from './native'
import { registerWithInvitation } from './services'

vi.mock('./native', () => ({ isNativeAccount: vi.fn() }))
vi.mock('./services', () => ({ getAccountState: vi.fn(async () => ({ status: 'signed-out' })), registerWithInvitation: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), completeVerification: vi.fn() }))
vi.mock('./pages/AccountPage', () => ({ AccountPage: ({ onContinue, onBack }: { onContinue: () => void; onBack?: () => void }) => <><button onClick={onContinue}>Entrar después del acceso</button><button onClick={onBack}>Volver a opciones de acceso</button></> }))

describe('initial access', () => {
  beforeEach(() => { localStorage.clear(); vi.mocked(isNativeAccount).mockReturnValue(true); vi.resetAllMocks(); vi.mocked(isNativeAccount).mockReturnValue(true) })
  afterEach(cleanup)
  const show = () => render(<MemoryRouter><AccessGate><p>Entrenamiento</p></AccessGate></MemoryRouter>)
  it('offers three choices before training and remembers guest access offline', () => {
    show()
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar como invitado' }))
    expect(screen.getByText('Entrenamiento')).toBeInTheDocument()
    cleanup(); show()
    expect(screen.getByText('Entrenamiento')).toBeInTheDocument()
  })
  it('opens direct registration without granting access on cancellation', async () => {
    vi.mocked(registerWithInvitation).mockRejectedValue(new Error('cancelled'))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/registro/i)
    expect(screen.queryByText('Entrenamiento')).not.toBeInTheDocument()
  })
  it('opens sign-in and grants access only after the user continues', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(screen.queryByText('Entrenamiento')).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar después del acceso' }))
    expect(screen.getByText('Entrenamiento')).toBeInTheDocument()
  })
  it('returns from sign-in to all initial choices without entering', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a opciones de acceso' }))
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar como invitado' })).toBeInTheDocument()
    expect(screen.queryByText('Entrenamiento')).not.toBeInTheDocument()
    expect(localStorage.getItem('arsen.initial-access.v1')).toBeNull()
  })
  it('keeps the web version accessible', () => {
    vi.mocked(isNativeAccount).mockReturnValue(false)
    show()
    expect(screen.getByText('Entrenamiento')).toBeInTheDocument()
  })
})
