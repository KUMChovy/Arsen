import { deleteRoutine } from '../domains/routine/services'
import { DEFAULT_DELOAD_SERIES_PERCENT, DEFAULT_DELOAD_WEIGHT_PERCENT } from '../shared/calculations/deload'
import { DEFAULT_AVAILABLE_PLATES_KG } from '../shared/calculations/equipmentLoad'
import { settingsEntitySchema } from '../shared/validation/entities'
import { CURRENT_SCHEMA_VERSION, dataTables, db } from './schema'

export async function initializeApp(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const settings = await db.settings.get('app')
    if (!settings) {
      const counts = await Promise.all(dataTables().map((table) => table.count()))
      if (counts.some((count) => count > 0)) throw new Error('La base de datos contiene datos pero no tiene configuración. No se modificaron los datos.')
      const now = new Date().toISOString()
      await db.settings.add({ id: 'app', schemaVersion: CURRENT_SCHEMA_VERSION, activeRoutineId: null, preferredUnit: 'kg', availablePlateWeightsKg: DEFAULT_AVAILABLE_PLATES_KG, deloadNotifications: true, deloadSeriesReductionPercent: DEFAULT_DELOAD_SERIES_PERCENT, deloadWeightReductionPercent: DEFAULT_DELOAD_WEIGHT_PERCENT, lastDeloadNotificationDate: null, notificationPermission: 'default', storagePersisted: null, createdAt: now, updatedAt: now })
      await db.localMetadata.put({ id: 'productTour', value: 'pending' })
    } else if (!settingsEntitySchema.safeParse(settings).success || settings.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      throw new Error('La configuración guardada no es válida. No se modificaron los datos.')
    }
    if (!(await db.localMetadata.get('emptyRoutineMigration'))) {
      if (await db.routines.get('routine-demo-current')) await deleteRoutine('routine-demo-current')
      if (await db.localMetadata.get('pageTours')) await db.localMetadata.put({ id: 'pageTours', value: [] })
      await db.localMetadata.put({ id: 'emptyRoutineMigration', value: true })
    }
  })
}
