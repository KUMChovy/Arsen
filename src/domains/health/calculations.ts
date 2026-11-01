export type HealthDayRange = {
  rangeStart: string
  rangeEnd: string
}

export type HealthExerciseWindowInput = {
  canonicalName: string
  exerciseLogId: string
  exerciseName: string
  routineExerciseId: string
  setCount: number
  setTimes: string[]
}

export type HealthSessionTimingInput = {
  completedAt?: string | null
  date: string
  lastExerciseAt?: string | null
  startedAt?: string | null
  status: 'draft' | 'completed'
}

export type HealthExerciseWindow = Omit<HealthExerciseWindowInput, 'setTimes'> & HealthDayRange

export type HealthWindows = {
  exercises: HealthExerciseWindow[]
  session: HealthDayRange | null
  sessionEndSource: 'completed' | 'last-exercise' | 'sync-time'
}

// Limita la lectura al día local de la sesión y nunca permite consultar el futuro.
export function resolveHealthDayWindow(date: string, syncTime = new Date()): HealthDayRange {
  const dayStart = new Date(`${date}T00:00:00`)
  if (Number.isNaN(dayStart.getTime())) throw new Error('Fecha de sesión inválida')

  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  const rangeEnd = new Date(Math.min(syncTime.getTime(), dayEnd.getTime()))

  if (dayStart.getTime() > rangeEnd.getTime()) throw new Error('El intervalo diario de salud es inválido')

  return {
    rangeEnd: rangeEnd.toISOString(),
    rangeStart: dayStart.toISOString(),
  }
}

// Construye los rangos que Health Connect leerá para la sesión y cada ejercicio.
export function resolveHealthWindows(
  session: HealthSessionTimingInput,
  exercises: HealthExerciseWindowInput[],
  syncTime = new Date(),
): HealthWindows {
  const day = resolveHealthDayWindow(session.date, syncTime)
  const syncIso = new Date(Math.min(syncTime.getTime(), new Date(day.rangeEnd).getTime())).toISOString()
  const recordedSetTimes = exercises
    .flatMap((exercise) => exercise.setTimes.map(parseIso).filter((value): value is Date => value !== null))
    .sort((a, b) => a.getTime() - b.getTime())
  const firstRecordedSet = recordedSetTimes[0]
  const lastRecordedSet = recordedSetTimes.at(-1)
  const recordedSessionEnd = firstRecordedSet && lastRecordedSet && lastRecordedSet.getTime() > firstRecordedSet.getTime() ? lastRecordedSet : null
  const exerciseWindows = exercises
    .map((exercise) => {
      const setTimes = exercise.setTimes
        .map(parseIso)
        .filter((value): value is Date => value !== null)
        .sort((a, b) => a.getTime() - b.getTime())
      const firstSet = setTimes[0]
      if (!firstSet) return null
      const lastSet = setTimes.at(-1) ?? firstSet
      // Una sola serie no define una duración útil para atribuir datos de salud.
      if (lastSet.getTime() <= firstSet.getTime()) return null

      return {
        canonicalName: exercise.canonicalName,
        exerciseLogId: exercise.exerciseLogId,
        exerciseName: exercise.exerciseName,
        rangeEnd: clampToDay(lastSet.toISOString(), day),
        rangeStart: clampToDay(firstSet.toISOString(), day),
        routineExerciseId: exercise.routineExerciseId,
        setCount: exercise.setCount,
      }
    })
    .filter((window): window is HealthExerciseWindow => window !== null && window.rangeStart <= window.rangeEnd)

  const earliestExercise = exerciseWindows
    .map((exercise) => exercise.rangeStart)
    .sort()[0]
  const hasRecordedSessionRange = recordedSessionEnd !== null
  const hasRecordedSets = recordedSetTimes.length > 0
  const sessionStart = hasRecordedSessionRange
    ? firstRecordedSet
    : hasRecordedSets
      ? null
      : parseIso(session.startedAt) ?? parseIso(earliestExercise)
  if (!sessionStart) {
    return { exercises: exerciseWindows, session: null, sessionEndSource: 'sync-time' }
  }

  const completedAt = parseIso(session.completedAt)
  const sessionEndSource = hasRecordedSessionRange
    ? 'last-exercise'
    : completedAt
      ? 'completed'
      : session.status === 'completed'
        ? 'last-exercise'
        : 'sync-time'
  const requestedEnd = hasRecordedSessionRange
    ? recordedSessionEnd
    : completedAt
      ?? (sessionEndSource === 'last-exercise' ? parseIso(session.lastExerciseAt) ?? parseIso(exerciseWindows.at(-1)?.rangeEnd) : new Date(syncIso))
      ?? new Date(syncIso)
  const sessionEnd = new Date(Math.max(sessionStart.getTime(), Math.min(requestedEnd.getTime(), new Date(day.rangeEnd).getTime())))

  return {
    exercises: exerciseWindows,
    session: {
      rangeEnd: sessionEnd.toISOString(),
      rangeStart: new Date(Math.min(sessionStart.getTime(), sessionEnd.getTime())).toISOString(),
    },
    sessionEndSource,
  }
}

function parseIso(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function clampToDay(value: string, day: HealthDayRange) {
  const date = new Date(value)
  const start = new Date(day.rangeStart)
  const end = new Date(day.rangeEnd)
  return new Date(Math.max(start.getTime(), Math.min(date.getTime(), end.getTime()))).toISOString()
}
