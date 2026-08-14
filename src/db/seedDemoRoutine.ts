import type { Equipment, RoutineDay, RoutineExercise } from '../domains/routine/types'
import type { AppSettings } from '../domains/settings/types'
import { DEFAULT_AVAILABLE_PLATES_KG, loadSettingsForEquipment } from '../shared/calculations/equipmentLoad'
import { bundledAssetIdForExercise } from '../shared/assets/exerciseImages'
import { createId } from '../shared/utils/id'
import { canonicalName } from '../shared/utils/normalize'
import { db } from './schema'
import { demoRoutineSource } from './demoRoutineSource'

const weekdayByDemoDay: Record<string, RoutineDay['weekday']> = {
  'Dia 1': 1,
  'Dia 3': 3,
  'Dia 5': 5,
  'Dia 6': 6,
}

export async function ensureDemoData() {
  const existingSettings = await db.settings.get('app')
  if (existingSettings) return

  const now = new Date().toISOString()
  const routineId = 'routine-demo-current'
  const days = demoRoutineSource.trainingDays.map((name, order): RoutineDay => ({
    id: `day-demo-${canonicalName(name)}`,
    routineId,
    name,
    description: demoRoutineSource.dayDescriptions[name] ?? '',
    weekday: weekdayByDemoDay[name] ?? null,
    order,
    createdAt: now,
    updatedAt: now,
  }))
  const dayByName = new Map(days.map((day) => [day.name, day]))

  const routineExercises: RoutineExercise[] = demoRoutineSource.routine.map((exercise, index) => {
    const day = dayByName.get(exercise.day)
    if (!day) throw new Error(`Demo routine references missing day: ${exercise.day}`)
    const loadSettings = loadSettingsForEquipment({ equipment: inferEquipment(exercise.name) })

    return {
      assetKind: null,
      bundledAssetId: bundledAssetIdForExercise(exercise.name, exercise.mainMuscle),
      customAssetId: null,
      id: exercise.id,
      routineId,
      dayId: day.id,
      sourceExerciseId: `catalog-${canonicalName(exercise.name)}`,
      name: exercise.name,
      canonicalName: canonicalName(exercise.name),
      mainMuscle: exercise.mainMuscle,
      equipment: loadSettings.equipment,
      loadMode: loadSettings.loadMode,
      barWeightKg: loadSettings.barWeightKg,
      targetSets: exercise.targetSets,
      repsMin: exercise.repsMin,
      repsMax: exercise.repsMax,
      recommendedRir: exercise.recommendedRir,
      rest: exercise.rest,
      restSeconds: exercise.restSeconds,
      warmupSets: exercise.warmupSets,
      warmupProtocol: exercise.warmupProtocol,
      technicalNotes: exercise.technicalNotes,
      currentWeightKg: exercise.currentWeight,
      order: index,
      createdAt: now,
      updatedAt: now,
    }
  })

  const catalogByName = new Map(
    routineExercises.map((exercise) => [
      exercise.canonicalName,
      {
        id: `catalog-${exercise.canonicalName}`,
        name: exercise.name,
        canonicalName: exercise.canonicalName,
        mainMuscle: exercise.mainMuscle,
        equipment: exercise.equipment,
        loadMode: exercise.loadMode,
        barWeightKg: exercise.barWeightKg,
        aliases: [],
        technicalNotes: exercise.technicalNotes,
        warmupProtocol: exercise.warmupProtocol,
        defaultTargetSets: exercise.targetSets,
        defaultRepsMin: exercise.repsMin,
        defaultRepsMax: exercise.repsMax,
        defaultRecommendedRir: exercise.recommendedRir,
        defaultRestSeconds: exercise.restSeconds,
        assetKind: null,
        bundledAssetId: bundledAssetIdForExercise(exercise.name, exercise.mainMuscle),
        customAssetId: null,
        createdAt: now,
        updatedAt: now,
      },
    ]),
  )

  const appSettings: AppSettings = {
    id: 'app',
    schemaVersion: 5,
    activeRoutineId: routineId,
    preferredUnit: 'kg',
    availablePlateWeightsKg: DEFAULT_AVAILABLE_PLATES_KG,
    deloadNotifications: true,
    lastDeloadNotificationDate: null,
    notificationPermission: 'default',
    storagePersisted: null,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction(
    'rw',
    [db.settings, db.routines, db.routineDays, db.routineExercises, db.exerciseCatalog, db.weeklyVolumeTargets],
    async () => {
      await db.routines.add({
        id: routineId,
        name: demoRoutineSource.name,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      await db.routineDays.bulkAdd(days)
      await db.routineExercises.bulkAdd(routineExercises)
      await db.exerciseCatalog.bulkAdd([...catalogByName.values()])
      await db.weeklyVolumeTargets.bulkAdd(
        demoRoutineSource.weeklyVolumeTargets.map((target) => ({
          id: createId('volume-target'),
          routineId,
          ...target,
        })),
      )
      await db.settings.add(appSettings)
    },
  )
}

function inferEquipment(name: string): Equipment {
  const value = canonicalName(name)
  if (value.includes('mancuerna')) return 'Mancuerna'
  if (value.includes('maquina') || value.includes('hack') || value.includes('prensa') || value.includes('pec-deck')) {
    return 'Maquina'
  }
  if (value.includes('polea') || value.includes('jalon') || value.includes('pullover')) return 'Maquina de polea'
  if (value.includes('barra') || value.includes('press') || value.includes('remo-t') || value.includes('rompecraneos')) {
    return 'Barra'
  }

  return 'Otro'
}
