// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductTour } from './ProductTour'

describe('recorrido inicial', () => {
  afterEach(cleanup)
  it('permits advancing, returning and completing even without highlighted targets', () => {
    const finish = vi.fn()
    render(<ProductTour onFinish={finish} />)
    expect(screen.getByRole('dialog', { name: 'Entreno' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('dialog', { name: 'Rutina' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(screen.getByRole('dialog', { name: 'Entreno' })).toBeInTheDocument()
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }))
    expect(finish).toHaveBeenCalledOnce()
  })
  it('allows skipping without advancing', () => {
    const finish = vi.fn()
    render(<ProductTour onFinish={finish} />)
    fireEvent.click(screen.getByRole('button', { name: 'Omitir recorrido' }))
    expect(finish).toHaveBeenCalledOnce()
  })
})
