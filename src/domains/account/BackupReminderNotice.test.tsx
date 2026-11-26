// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BackupReminderNotice } from './BackupReminderNotice'

afterEach(cleanup)
it('offers access to backup without starting a backup and can be dismissed', () => {
  const open = vi.fn()
  const dismiss = vi.fn()
  render(<BackupReminderNotice onOpen={open} onDismiss={dismiss} />)
  fireEvent.click(screen.getByRole('button', { name: /revisar respaldo/i }))
  expect(open).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: /descartar aviso/i }))
  expect(dismiss).toHaveBeenCalledOnce()
})
