import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getDeloadInputs, getDeloadOverview } from './services'
import type { DeloadOverview } from './types'

export function useDeloadOverview() {
  const inputs = useLiveQuery(() => getDeloadInputs(), [])
  const [overview, setOverview] = useState<DeloadOverview>()
  const [failure, setFailure] = useState<unknown>()

  useEffect(() => {
    if (!inputs) return
    let current = true
    getDeloadOverview().then(
      (value) => { if (current) setOverview(value) },
      (error: unknown) => { if (current) setFailure(error) },
    )
    return () => { current = false }
  }, [inputs])

  if (failure) throw failure
  return overview
}
