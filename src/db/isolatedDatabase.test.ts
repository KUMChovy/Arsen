import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import { ArsenDatabase } from './schema'

it('uses only the explicitly supplied in-memory IndexedDB instance', async () => {
  expect(new ArsenDatabase().name).toBe('arsen')
  const factory = new IDBFactory()
  const first = new ArsenDatabase('arsen-isolated-test', { indexedDB: factory, IDBKeyRange })
  const other = new ArsenDatabase('arsen-isolated-test', { indexedDB: new IDBFactory(), IDBKeyRange })
  try {
    await first.open()
    await first.localMetadata.put({ id: 'revision', value: 42 })
    await other.open()
    expect((await first.localMetadata.get('revision'))?.value).toBe(42)
    expect((await other.localMetadata.get('revision'))?.value).toBe(0)
  } finally { first.close(); other.close() }
})
