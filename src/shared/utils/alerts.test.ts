import { beforeEach, describe, expect, it, vi } from 'vitest'

const fire = vi.fn(() => Promise.resolve({ isConfirmed: true }))

vi.mock('sweetalert2', () => ({
  default: { fire },
}))

describe('alert helpers', () => {
  beforeEach(() => {
    fire.mockClear()
  })

  it('keeps SweetAlert popups on an Arsen surface background', async () => {
    const { confirmAction } = await import('./alerts')

    await confirmAction('Reemplazar respaldo', 'Se restaurara este archivo.')

    expect(fire).toHaveBeenCalledWith(expect.objectContaining({ background: 'var(--color-arsen-surface)' }))
  })
})
