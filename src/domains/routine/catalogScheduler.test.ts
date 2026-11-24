// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestCatalogCheck, startCatalogScheduler } from './catalogScheduler'

describe('catalog update scheduling', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('checks at startup, throttles repeated requests and retries when connectivity returns', async () => {
    vi.useFakeTimers()
    const sync = vi.fn(async () => 'current' as const)
    const scheduler = startCatalogScheduler(sync)
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1))
    scheduler.check()
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(sync).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2))
    scheduler.stop()
    window.dispatchEvent(new Event('online'))
    expect(sync).toHaveBeenCalledTimes(2)
  })

  it('runs a pending connectivity check after an in-flight request finishes', async () => {
    let resolve: (() => void) | undefined
    const sync = vi.fn().mockImplementationOnce(() => new Promise<void>((done) => { resolve = done })).mockResolvedValue(undefined)
    const scheduler = startCatalogScheduler(sync)
    await Promise.resolve()
    window.dispatchEvent(new Event('online'))
    expect(sync).toHaveBeenCalledTimes(1)
    resolve!()
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2))
    scheduler.stop()
  })

  it('checks on entering the catalog when the last check is stale', async () => {
    vi.useFakeTimers()
    const sync = vi.fn(async () => undefined)
    const scheduler = startCatalogScheduler(sync)
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1))
    vi.advanceTimersByTime(15 * 60 * 1000)
    requestCatalogCheck()
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2))
    scheduler.stop()
  })
})
