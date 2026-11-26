import type { Dispatch, SetStateAction } from 'react'

export type WorkoutActionContext = {
  setWorkoutAction: Dispatch<SetStateAction<(() => void) | null>>
  openAccount?: () => void
}
