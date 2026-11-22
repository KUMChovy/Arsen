// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { startDeloadNow } from '../settings/services'
import { useDeloadOverview } from './hooks'

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
})

afterEach(async () => {
  db.close()
  await db.delete()
})

it('observes deload changes without writing inside a live query', async () => {
  const { result } = renderHook(() => useDeloadOverview())
  await waitFor(() => expect(result.current?.phase).toBe('idle'))
  await startDeloadNow()
  await waitFor(() => expect(result.current?.phase).toBe('active'))
})
