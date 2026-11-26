// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SwipeNotice } from './SwipeNotice'

describe('swipe notice', () => {
  it('dismisses with a horizontal swipe or an accessible button', () => {
    const dismiss = vi.fn()
    render(<SwipeNotice onDismiss={dismiss}><p>Sesión pendiente</p></SwipeNotice>)
    const notice = screen.getByText('Sesión pendiente').parentElement!
    fireEvent.touchStart(notice, { touches: [{ clientX: 160, clientY: 10 }] })
    fireEvent.touchEnd(notice, { changedTouches: [{ clientX: 60, clientY: 12 }] })
    expect(dismiss).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Descartar aviso' }))
    expect(dismiss).toHaveBeenCalledTimes(2)
  })
})
