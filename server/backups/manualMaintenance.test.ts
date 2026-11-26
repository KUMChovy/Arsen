import { describe, expect, it, vi } from 'vitest'
import { runManualMaintenance } from './manualMaintenance'

describe('manual backup maintenance', () => {
  const request = (token?: string, method = 'POST') => new Request('https://api.test/api/v1/admin/maintenance', { method, headers: token ? { authorization: `Bearer ${token}` } : {} })
  it('allows only an authenticated administrator to run one bounded operation', async () => {
    const run = vi.fn(async () => ({ status: 'pending', deleted: 2 }))
    const auth = { verify: async (token: string) => token, role: async (id: string) => id === 'admin' ? 'admin' as const : 'user' as const }
    expect(await runManualMaintenance(request(), { auth, run })).toEqual({ status: 401 })
    expect(await runManualMaintenance(request('user'), { auth, run })).toEqual({ status: 403 })
    expect(await runManualMaintenance(request('admin', 'GET'), { auth, run })).toEqual({ status: 405 })
    expect(run).not.toHaveBeenCalled()
    expect(await runManualMaintenance(request('admin'), { auth, run })).toEqual({ status: 200, result: 'pending', deleted: 2 })
    expect(run).toHaveBeenCalledOnce()
  })
})
