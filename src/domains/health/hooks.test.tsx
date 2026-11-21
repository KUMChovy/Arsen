// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHealthAutoSync } from './hooks'

const syncCurrentWorkoutHealth = vi.hoisted(() => vi.fn())

vi.mock('./services', () => ({ syncCurrentWorkoutHealth }))

function Harness({ enabled }: { enabled: boolean }) {
  useHealthAutoSync(enabled)
  return null
}

describe('useHealthAutoSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    syncCurrentWorkoutHealth.mockResolvedValue({ syncedSessions: 1 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('syncs immediately and on visible foreground events', async () => {
    const view = render(<Harness enabled />)
    await act(async () => undefined)
    expect(syncCurrentWorkoutHealth).toHaveBeenCalledTimes(1)

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
    })
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(45_000)
      await Promise.resolve()
    })

    expect(syncCurrentWorkoutHealth).toHaveBeenCalledTimes(4)
    view.unmount()
  })

  it('does not overlap reads and cleans up when disabled', async () => {
    let release: (() => void) | undefined
    syncCurrentWorkoutHealth.mockImplementation(() => new Promise<{ syncedSessions: number }>((resolve) => {
      release = () => resolve({ syncedSessions: 1 })
    }))
    const view = render(<Harness enabled />)

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
      vi.advanceTimersByTime(45_000)
    })
    expect(syncCurrentWorkoutHealth).toHaveBeenCalledOnce()

    await act(async () => release?.())
    view.rerender(<Harness enabled={false} />)
    act(() => {
      window.dispatchEvent(new Event('focus'))
      vi.advanceTimersByTime(45_000)
    })

    expect(syncCurrentWorkoutHealth).toHaveBeenCalledOnce()
    view.unmount()
  })
})
