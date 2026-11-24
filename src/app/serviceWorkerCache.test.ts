import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

function loadWorker(source: string) {
  const handlers = new Map<string, (event: any) => void>()
  const removed: string[] = []
  const cache = { match: vi.fn(), put: vi.fn(), addAll: vi.fn() }
  const context = {
    URL, Promise,
    self: { location: { origin: 'https://arsen.test' }, addEventListener: (type: string, fn: (event: any) => void) => handlers.set(type, fn), clients: { claim: async () => {} }, skipWaiting: async () => {} },
    caches: { open: async () => cache, keys: async () => ['arsen-v1', 'arsen-abcdef123456', 'arsen-shell-old', 'arsen-catalog-images-v1', 'unrelated'], delete: async (name: string) => { removed.push(name) } },
    fetch: async () => ({ ok: false }),
  }
  runInNewContext(source, context)
  return { handlers, removed }
}

describe('service worker cache boundaries', () => {
  const sources = [
    { name: 'development worker', load: () => readFileSync('public/sw.js', 'utf8') },
    { name: 'generated worker', load: () => {
      const directory = mkdtempSync(join(tmpdir(), 'arsen-worker-'))
      try {
        mkdirSync(join(directory, 'dist'))
        writeFileSync(join(directory, 'dist', 'index.html'), 'test')
        execFileSync(process.execPath, [resolve('scripts/generate-sw.mjs')], { cwd: directory })
        return readFileSync(join(directory, 'dist', 'sw.js'), 'utf8')
      } finally { rmSync(directory, { recursive: true, force: true }) }
    } },
  ]

  for (const source of sources) {
    it(`${source.name} never intercepts API requests`, () => {
      const { handlers } = loadWorker(source.load())
      const respondWith = vi.fn()
      handlers.get('fetch')!({ request: { method: 'GET', url: 'https://arsen.test/api/v1/backups', mode: 'cors' }, respondWith })
      expect(respondWith).not.toHaveBeenCalled()
    })

    it(`${source.name} removes obsolete shell caches but preserves catalog images`, async () => {
      const { handlers, removed } = loadWorker(source.load())
      let work: Promise<void> | undefined
      handlers.get('activate')!({ waitUntil: (value: Promise<void>) => { work = value } })
      await work
      expect(removed.sort()).toEqual(['arsen-abcdef123456', 'arsen-shell-old', 'arsen-v1'])
    })
  }
})
