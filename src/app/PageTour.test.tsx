// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageTour, pageTourForPath } from './PageTour'

describe('recorridos por página', () => {
  afterEach(cleanup)
  it('recognizes main and detail screens without identifying individual records', () => {
    expect(pageTourForPath('/')).toBe('workout')
    expect(pageTourForPath('/rutina/dia/uno')).toBe('routineDay')
    expect(pageTourForPath('/progreso/ejercicio/sentadilla')).toBe('exercise')
    expect(pageTourForPath('/historial/sesion/uno')).toBe('session')
    expect(pageTourForPath('/cuenta')).toBe('account')
  })
  it('allows moving back and skipping an individual guide', () => {
    const finish = vi.fn()
    render(<PageTour page="routine" onFinish={finish} />)
    expect(screen.getByRole('dialog')).toHaveTextContent('Tu rutina')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Tu rutina')
    fireEvent.click(screen.getByRole('button', { name: 'Omitir recorrido' }))
    expect(finish).toHaveBeenCalledOnce()
  })
  it('offers first-routine guidance when workout has no routine', () => {
    const empty = document.createElement('div')
    empty.dataset.tour = 'workout-empty'
    document.body.appendChild(empty)
    render(<PageTour page="workout" onFinish={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Crea tu primera rutina')
    empty.remove()
  })
  it('explains each settings category and each routine view', () => {
    const view = render(<PageTour page="settings" onFinish={vi.fn()} />)
    for (const title of ['Datos', 'Salud opcional', 'Rutinas', 'Deload', 'Notificaciones', 'Almacenamiento', 'Zona de limpieza']) {
      while (!screen.getByRole('dialog').textContent?.includes(title)) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    }
    view.unmount()
    const tabs = document.createElement('div')
    tabs.dataset.tour = 'routine-tabs'
    document.body.appendChild(tabs)
    render(<PageTour page="routine" onFinish={vi.fn()} />)
    for (const title of ['Vista Ver', 'Vista Editar', 'Vista Catálogo', 'Sinful Shell']) {
      while (!screen.getByRole('dialog').textContent?.includes(title)) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    }
    tabs.remove()
  })
})
