// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationCenter } from './NotificationPanel'

describe('notification center', () => {
  afterEach(cleanup)
  it('offers an accessible dismissal and keeps dismissed notices in history', () => {
    const dismiss = vi.fn()
    render(<NotificationCenter onDismiss={dismiss} notices={[
      { id: 'one', title: 'Sesión pendiente', body: 'Continúa tu sesión', createdAt: '2026-11-25T12:00:00Z', dismissed: false },
      { id: 'two', title: 'Descarga', body: 'Revisa tu descanso', createdAt: new Date().toISOString(), dismissed: true },
    ]} />)
    fireEvent.click(screen.getByRole('button', { name: /Notificaciones/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Descartar Sesión pendiente' }))
    expect(dismiss).toHaveBeenCalledWith('one')
    fireEvent.click(screen.getByText('Historial de esta semana'))
    expect(screen.getByText('Descarga')).toBeInTheDocument()
  })
  it('dismisses a notification with a horizontal pointer gesture', () => {
    const dismiss = vi.fn()
    render(<NotificationCenter onDismiss={dismiss} notices={[{ id: 'one', title: 'Sesión pendiente', body: 'Continúa tu sesión', createdAt: '2026-11-25T12:00:00Z', dismissed: false }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Notificaciones/ }))
    const item = screen.getByText('Sesión pendiente').closest('li')!
    const down = new Event('pointerdown', { bubbles: true }); Object.defineProperties(down, { clientX: { value: 150 }, clientY: { value: 10 } })
    const up = new Event('pointerup', { bubbles: true }); Object.defineProperties(up, { clientX: { value: 50 }, clientY: { value: 12 } })
    fireEvent(item, down); fireEvent(item, up)
    expect(dismiss).toHaveBeenCalledWith('one')
  })
  it('offers navigation to backup for a manual reminder', () => {
    const open = vi.fn()
    render(<NotificationCenter onDismiss={vi.fn()} onOpenBackup={open} notices={[{ id: 'manual-backup:r:2026-11-25', title: 'Recordatorio de respaldo', body: 'Prepara una copia si quieres.', createdAt: new Date().toISOString(), dismissed: false }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Notificaciones/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Cuenta y respaldo' }))
    expect(open).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
