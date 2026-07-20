import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const demoRoutinePath = path.join(rootDir, 'src/db/data/demo-routine.json')

const args = parseArgs(process.argv.slice(2))
const endDate = args.end ?? localDateKey(new Date())
const startDate = args.start ?? addMonths(endDate, -3)
const outputPath = path.resolve(rootDir, args.out ?? 'generated/arsen-demo-3-months-backup.json')
const source = JSON.parse(await readFile(demoRoutinePath, 'utf8'))
const backup = buildBackup(source, { endDate, startDate })

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(backup, null, 2)}\n`, 'utf8')

const tables = backup.tables
console.log(`Demo backup generado: ${path.relative(rootDir, outputPath)}`)
console.log(`Rango: ${startDate} -> ${endDate}`)
console.log(`Sesiones: ${tables.workoutSessions.length}`)
console.log(`Ejercicios registrados: ${tables.exerciseLogs.length}`)
console.log(`Series principales: ${tables.setLogs.length}`)
console.log(`Drop sets: ${tables.dropSetLogs.length}`)
console.log('Importa desde Ajustes > Fusionar respaldo o Reemplazar respaldo.')

function buildBackup(demoRoutineSource, { endDate, startDate }) {
  const now = new Date().toISOString()
  const routineId = 'routine-demo-current'
  const weekdayByDemoDay = new Map([
    ['Dia 1', 1],
    ['Dia 3', 3],
    ['Dia 5', 5],
    ['Dia 6', 6],
  ])
  const days = demoRoutineSource.trainingDays.map((name, order) => ({
    createdAt: now,
    description: demoRoutineSource.dayDescriptions[name] ?? '',
    id: `day-demo-${canonicalName(name)}`,
    name,
    order,
    routineId,
    updatedAt: now,
    weekday: weekdayByDemoDay.get(name) ?? null,
  }))
  const dayByName = new Map(days.map((day) => [day.name, day]))
  const routineExercises = demoRoutineSource.routine.map((exercise, index) => {
    const day = dayByName.get(exercise.day)
    if (!day) throw new Error(`Dia faltante en demo: ${exercise.day}`)

    return {
      canonicalName: canonicalName(exercise.name),
      createdAt: now,
      currentWeightKg: exercise.currentWeight,
      dayId: day.id,
      equipment: inferEquipment(exercise.name),
      id: exercise.id,
      mainMuscle: exercise.mainMuscle,
      name: exercise.name,
      order: index,
      progression: exercise.progression,
      recommendedRir: exercise.recommendedRir,
      repRange: exercise.repRange,
      rest: exercise.rest,
      restSeconds: exercise.restSeconds,
      routineId,
      sourceExerciseId: `catalog-${canonicalName(exercise.name)}`,
      targetSets: exercise.targetSets,
      technicalNotes: exercise.technicalNotes,
      updatedAt: now,
      warmupProtocol: exercise.warmupProtocol,
      warmupSets: exercise.warmupSets,
    }
  })
  const exercisesByDay = groupBy(routineExercises, (exercise) => exercise.dayId)
  const catalogByName = new Map(
    routineExercises.map((exercise) => [
      exercise.canonicalName,
      {
        aliases: [],
        assetKind: assetKindForExercise(exercise.canonicalName),
        canonicalName: exercise.canonicalName,
        createdAt: now,
        defaultRecommendedRir: exercise.recommendedRir,
        defaultRepRange: exercise.repRange,
        defaultRestSeconds: exercise.restSeconds,
        defaultTargetSets: exercise.targetSets,
        equipment: exercise.equipment,
        id: `catalog-${exercise.canonicalName}`,
        mainMuscle: exercise.mainMuscle,
        name: exercise.name,
        updatedAt: now,
      },
    ]),
  )
  const workoutSessions = []
  const exerciseLogs = []
  const setLogs = []
  const dropSetLogs = []
  const skipLogs = []
  const dates = datesBetween(startDate, endDate)
  let sessionIndex = 0

  for (const date of dates) {
    const weekday = weekdayOfDateKey(date)
    const day = days.find((item) => item.weekday === weekday)
    if (!day) continue

    const dayExercises = exercisesByDay.get(day.id) ?? []
    const timestamp = `${date}T18:${String(10 + (sessionIndex % 40)).padStart(2, '0')}:00.000Z`
    const sessionId = `session-demo-${date}-${canonicalName(day.name)}`
    const weekNumber = Math.floor(sessionIndex / 4)
    const progression = sessionIndex / Math.max(1, Math.ceil(dates.length / 7) * 4)

    workoutSessions.push({
      createdAt: timestamp,
      date,
      dayId: day.id,
      displayUnit: 'kg',
      id: sessionId,
      notes: sessionNote(day.name, weekNumber, sessionIndex),
      routineId,
      status: 'completed',
      updatedAt: timestamp,
    })

    for (const exercise of dayExercises) {
      const skip = shouldSkip(date, exercise, sessionIndex)
      const exerciseLogId = `elog-demo-${date}-${exercise.id}`
      exerciseLogs.push({
        createdAt: timestamp,
        id: exerciseLogId,
        notes: skip ? 'Saltado por fatiga o falta de tiempo.' : exerciseNote(exercise, sessionIndex),
        routineExerciseId: exercise.id,
        sessionId,
        snapshot: snapshotForExercise(exercise),
        state: skip ? 'skipped' : 'done',
        updatedAt: timestamp,
      })

      if (skip) {
        skipLogs.push({
          createdAt: timestamp,
          id: `skip-demo-${date}-${exercise.id}`,
          reason: 'fatiga/tiempo',
          routineExerciseId: exercise.id,
          sessionId,
        })
        continue
      }

      const repRange = parseRepRange(exercise.repRange)
      const setCount = Math.max(1, exercise.targetSets)
      const baseWeight = projectedWeight(exercise.currentWeightKg, progression, weekNumber, exercise.id)

      for (let order = 0; order < setCount; order += 1) {
        const fatigue = 1 - order * 0.025
        const weightKg = roundToHalf(baseWeight * fatigue)
        const reps = repsForSet(repRange, order, progression, exercise.id)
        const rir = rirForSet(exercise.recommendedRir, order, setCount, sessionIndex)
        const setId = `set-demo-${date}-${exercise.id}-${order + 1}`

        setLogs.push({
          createdAt: timestamp,
          displayUnit: 'kg',
          exerciseLogId,
          id: setId,
          kind: 'main',
          order,
          reps,
          rir,
          updatedAt: timestamp,
          weightKg,
        })

        if (order === setCount - 1 && shouldAddDropSet(exercise, sessionIndex)) {
          dropSetLogs.push({
            createdAt: timestamp,
            displayUnit: 'kg',
            id: `drop-demo-${date}-${exercise.id}-1`,
            order: 0,
            reps: Math.min(repRange.max + 4, reps + 4),
            rir: Math.min(4, rir + 1),
            setLogId: setId,
            updatedAt: timestamp,
            weightKg: roundToHalf(weightKg * 0.78),
          })
        }
      }
    }

    sessionIndex += 1
  }

  return {
    exportedAt: now,
    schemaVersion: 1,
    tables: {
      dropSetLogs,
      exerciseCatalog: [...catalogByName.values()],
      exerciseLogs,
      routineDays: days,
      routineExercises,
      routines: [
        {
          createdAt: now,
          id: routineId,
          isActive: true,
          name: demoRoutineSource.name,
          updatedAt: now,
        },
      ],
      setLogs,
      settings: [
        {
          activeRoutineId: routineId,
          createdAt: now,
          deloadNotifications: true,
          id: 'app',
          lastDeloadNotificationDate: null,
          notificationPermission: 'default',
          preferredUnit: 'kg',
          schemaVersion: 1,
          storagePersisted: null,
          updatedAt: now,
        },
      ],
      skipLogs,
      weeklyVolumeTargets: demoRoutineSource.weeklyVolumeTargets.map((target, index) => ({
        comment: target.comment,
        evaluation: target.evaluation,
        id: `volume-target-demo-${index + 1}-${canonicalName(target.muscle)}`,
        muscle: target.muscle,
        range: target.range,
        routineId,
        sets: target.sets,
      })),
      workoutSessions,
    },
  }
}

function parseArgs(argv) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--start') parsed.start = argv[++index]
    else if (arg === '--end') parsed.end = argv[++index]
    else if (arg === '--out') parsed.out = argv[++index]
  }

  return parsed
}

function canonicalName(value) {
  return value
    .trim()
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function inferEquipment(name) {
  const value = canonicalName(name)
  if (value.includes('mancuerna')) return 'Mancuerna'
  if (value.includes('maquina') || value.includes('hack') || value.includes('prensa') || value.includes('pec-deck')) return 'Maquina'
  if (value.includes('polea') || value.includes('jalon') || value.includes('pullover')) return 'Polea'
  if (value.includes('barra') || value.includes('press') || value.includes('remo-t') || value.includes('rompecraneos')) return 'Barra'

  return 'Otro'
}

function assetKindForExercise(value) {
  if (value.includes('pec-deck')) return 'pecDeck'
  if (value.includes('remo')) return 'row'
  if (value.includes('hack') || value.includes('prensa')) return 'hackSquat'
  if (value.includes('jalon') || value.includes('pullover')) return 'latPulldown'
  if (value.includes('militar') || value.includes('hombro')) return 'shoulderPress'
  if (value.includes('press')) return 'press'

  return null
}

function groupBy(items, keyFn) {
  const groups = new Map()
  for (const item of items) {
    const key = keyFn(item)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }

  return groups
}

function datesBetween(startDate, endDate) {
  const dates = []
  const current = dateFromKey(startDate)
  const end = dateFromKey(endDate)

  while (current <= end) {
    dates.push(localDateKey(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

function addMonths(dateKey, months) {
  const date = dateFromKey(dateKey)
  date.setMonth(date.getMonth() + months)
  date.setDate(date.getDate() + 1)

  return localDateKey(date)
}

function dateFromKey(dateKey) {
  return new Date(`${dateKey}T12:00:00`)
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function weekdayOfDateKey(dateKey) {
  return dateFromKey(dateKey).getDay()
}

function snapshotForExercise(exercise) {
  return {
    canonicalName: exercise.canonicalName,
    equipment: exercise.equipment,
    mainMuscle: exercise.mainMuscle,
    name: exercise.name,
    recommendedRir: exercise.recommendedRir,
    repRange: exercise.repRange,
    restSeconds: exercise.restSeconds,
    targetSets: exercise.targetSets,
  }
}

function parseRepRange(repRange) {
  const values = repRange.match(/\d+/g)?.map(Number) ?? [8, 10]
  const min = values[0] ?? 8
  const max = values[1] ?? min

  return { max: Math.max(min, max), min: Math.min(min, max) }
}

function repsForSet(range, order, progression, seed) {
  const spread = range.max - range.min
  const wave = seededNoise(`${seed}-reps-${order}`) > 0.55 ? 1 : 0
  const reps = range.min + Math.round(spread * (0.35 + progression * 0.45)) + wave - Math.floor(order / 2)

  return clamp(reps, range.min, range.max)
}

function rirForSet(rirRange, order, setCount, sessionIndex) {
  const min = Number(rirRange.match(/\d+/)?.[0] ?? 1)
  const hardSet = order >= setCount - 2
  const tired = sessionIndex % 11 === 0

  return clamp(min + (hardSet ? 0 : 1) + (tired ? 1 : 0), 0, 4)
}

function projectedWeight(currentWeightKg, progression, weekNumber, seed) {
  const deload = weekNumber === 5 || weekNumber === 10 ? 0.92 : 1
  const startFactor = 0.87 + seededNoise(`${seed}-start`) * 0.04
  const endFactor = 1.02 + seededNoise(`${seed}-end`) * 0.04
  const factor = startFactor + (endFactor - startFactor) * clamp(progression, 0, 1)

  return Math.max(1, currentWeightKg * factor * deload)
}

function shouldSkip(date, exercise, sessionIndex) {
  if (exercise.order < 3) return false

  return seededNoise(`${date}-${exercise.id}-skip-${sessionIndex}`) > 0.955
}

function shouldAddDropSet(exercise, sessionIndex) {
  const value = canonicalName(`${exercise.name}-${exercise.mainMuscle}`)
  const isolation =
    value.includes('curl') ||
    value.includes('extension') ||
    value.includes('elevaciones') ||
    value.includes('pec-deck') ||
    value.includes('pullover')

  return isolation && sessionIndex % 3 !== 0
}

function sessionNote(dayName, weekNumber, sessionIndex) {
  const notes = [
    'Sesion solida; tecnica estable y descansos controlados.',
    'Buen rendimiento. Mantener RIR objetivo.',
    'Energia media; priorizar rango limpio antes de subir peso.',
    'Progreso estable. No forzar fallo temprano.',
  ]
  const deload = weekNumber === 5 || weekNumber === 10
  if (deload) return `Semana de descarga: ${dayName}. Menos carga, mas control.`

  return `${dayName}: ${notes[sessionIndex % notes.length]}`
}

function exerciseNote(exercise, sessionIndex) {
  if (sessionIndex % 7 === 0) return 'Subir peso solo si todas las reps salen limpias.'
  if (sessionIndex % 5 === 0) return 'Buen control de tempo.'

  return exercise.technicalNotes ? exercise.technicalNotes.slice(0, 120) : ''
}

function seededNoise(seed) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0) / 4294967295
}

function roundToHalf(value) {
  return Math.round(value * 2) / 2
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
