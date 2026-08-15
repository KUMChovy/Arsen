import { useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  ChartNoAxesCombined,
  ChevronRight,
  CloudDownload,
  CloudUpload,
  Database,
  Disc3,
  FileUp,
  Flame,
  Folder,
  Moon,
  Scale,
  Settings,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '../../../shared/components/Card'
import { PageHeader } from '../../../shared/components/PageHeader'
import { importRoutineJson } from '../../routine/importExport'
import { confirmAction, confirmDanger } from '../../../shared/utils/alerts'
import {
  completeActiveDeload,
  exportFullBackup,
  exportProgressCsv,
  exportProgressJson,
  deleteActiveRoutineWorkoutLogs,
  deleteAllWorkoutLogs,
  deleteWorkoutLogsByDateRange,
  getAppSettings,
  getDeloadOverview,
  getStorageOverview,
  importFullBackup,
  requestPersistentStorage,
  resolveAvailablePlateWeightsKg,
  scheduleDeload,
  skipDeloadSuggestion,
  startDeloadNow,
  updateAvailablePlateWeights,
  updateDeloadReductionSettings,
  updatePreferredUnit,
  type BackupImportMode,
} from '../services'
import { requestDeloadNotifications } from '../notifications'
import { localDateKey } from '../../../shared/utils/date'
import { kgToUnit, unitToKg } from '../../../shared/utils/weight'
import type { DeloadPhase } from '../types'

const routineActions = [
  { icon: Folder, label: 'Rutinas guardadas', meta: 'Cambiar, duplicar o eliminar' },
  { icon: FileUp, label: 'Importar rutina', meta: 'Agregar o reemplazar seleccionada' },
]

export function SettingsPage() {
  const importInputRef = useRef<HTMLInputElement>(null)
  const importModeRef = useRef<BackupImportMode>('merge')
  const routineImportInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const today = localDateKey(new Date())
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [cleanupEndDate, setCleanupEndDate] = useState(today)
  const [cleanupStartDate, setCleanupStartDate] = useState(today)
  const [deloadStartDate, setDeloadStartDate] = useState(today)
  const [message, setMessage] = useState<string | null>(null)
  const appSettings = useLiveQuery(() => getAppSettings(), [], undefined)
  const preferredUnit = appSettings?.preferredUnit ?? 'kg'
  const resolvedPlates = resolveAvailablePlateWeightsKg(appSettings)
  const resolvedPlateKey = resolvedPlates.join('|')
  const [platesValue, setPlatesValue] = useState('')
  const [seriesReductionValue, setSeriesReductionValue] = useState('50')
  const [weightReductionValue, setWeightReductionValue] = useState('80')
  const deload = useLiveQuery(() => getDeloadOverview(), [], undefined)
  const storage = useLiveQuery(() => getStorageOverview(), [], undefined)
  const storagePercent = storage?.usage && storage.quota ? Math.min(100, Math.round((storage.usage / storage.quota) * 100)) : 0

  useEffect(() => {
    setPlatesValue(resolvedPlates.map((plate) => formatPlateInputValue(plate, preferredUnit)).join(', '))
  }, [preferredUnit, resolvedPlateKey])

  useEffect(() => {
    if (!deload) return

    setSeriesReductionValue(String(deload.seriesReductionPercent))
    setWeightReductionValue(String(deload.weightReductionPercent))
    setDeloadStartDate(deload.currentCycle?.scheduledStartDate ?? today)
  }, [
    deload?.currentCycle?.scheduledStartDate,
    deload?.seriesReductionPercent,
    deload?.weightReductionPercent,
    today,
  ])

  async function runAction(id: string, action: () => Promise<void | boolean>, success: string) {
    try {
      setBusyAction(id)
      setMessage(null)
      await action()
      setMessage(success)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo completar la accion')
    } finally {
      setBusyAction(null)
    }
  }

  function savePlateWeights() {
    const rawValues = platesValue.split(',').map((value) => value.trim()).filter(Boolean)
    const values = rawValues.map(Number)

    if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
      setMessage('Escribe discos validos separados por coma')
      return
    }

    void runAction(
      'plates',
      () => updateAvailablePlateWeights(values.map((value) => unitToKg(value, preferredUnit))),
      'Discos actualizados',
    )
  }

  function saveDeloadReductions() {
    void runAction(
      'deload-settings',
      async () => {
        await updateDeloadReductionSettings({
          seriesReductionPercent: Number(seriesReductionValue),
          weightReductionPercent: Number(weightReductionValue),
        })
      },
      'Deload actualizado',
    )
  }

  function programDeload() {
    void runAction(
      'deload-schedule',
      async () => {
        await scheduleDeload(deloadStartDate)
      },
      'Deload programado',
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Datos, respaldos y offline" title="Ajustes">
        <button className="grid size-10 place-items-center rounded-[10px] text-arsen-purple2" type="button">
          <Settings aria-hidden="true" className="size-6" />
          <span className="sr-only">Configurar Arsen</span>
        </button>
      </PageHeader>

      {message ? (
        <div className="rounded-[10px] border border-arsen-purple2/40 bg-arsen-purple/15 px-3 py-2 text-sm text-white">
          {message}
        </div>
      ) : null}

      <SettingsSection title="Datos">
        <ActionRow
          busy={busyAction === 'backup-export'}
          icon={CloudUpload}
          label="Exportar respaldo"
          meta="JSON completo de IndexedDB"
          onClick={() => runAction('backup-export', exportFullBackup, 'Respaldo exportado')}
        />
        <ActionRow
          busy={busyAction === 'backup-import-merge'}
          icon={CloudDownload}
          label="Fusionar respaldo"
          meta="Agrega datos sin borrar lo local"
          onClick={() => {
            importModeRef.current = 'merge'
            importInputRef.current?.click()
          }}
        />
        <ActionRow
          busy={busyAction === 'backup-import-replace'}
          icon={CloudDownload}
          label="Reemplazar respaldo"
          meta="Borra datos locales y restaura archivo"
          onClick={() => {
            importModeRef.current = 'replace'
            importInputRef.current?.click()
          }}
        />
        <input
          accept="application/json,.json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            const mode = importModeRef.current
            if (mode === 'replace' && !(await confirmAction('Reemplazar respaldo', 'Se borraran los datos locales y se restaurara este archivo.', 'Reemplazar'))) return
            void runAction(
              `backup-import-${mode}`,
              () => importFullBackup(file, mode),
              mode === 'merge' ? 'Respaldo fusionado' : 'Respaldo reemplazado',
            )
          }}
          ref={importInputRef}
          type="file"
        />
        <ActionRow
          busy={busyAction === 'progress-export'}
          icon={ChartNoAxesCombined}
          label="Exportar progreso"
          meta="JSON + CSV cronologico"
          onClick={() =>
            runAction(
              'progress-export',
              async () => {
                await exportProgressJson()
                await exportProgressCsv()
              },
              'Progreso exportado en JSON y CSV',
            )
          }
        />
        <Card className="grid grid-cols-[42px_1fr_auto] items-center gap-3 p-3">
          <div className="grid size-10 place-items-center text-arsen-purple2">
            <Scale aria-hidden="true" className="size-6" />
          </div>
          <div>
            <strong>Unidades</strong>
            <span className="mt-1 block text-xs text-arsen-muted">kg base, vista kg/lb</span>
          </div>
          <div className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-white/10 text-xs font-black">
            {(['kg', 'lb'] as const).map((unit) => (
              <button
                className={[
                  'min-h-9 px-3',
                  appSettings?.preferredUnit === unit ? 'bg-arsen-purple text-white' : 'bg-white/5 text-arsen-muted',
                ].join(' ')}
                key={unit}
                onClick={() => runAction('unit', () => updatePreferredUnit(unit), `Unidad cambiada a ${unit}`)}
                type="button"
              >
                {unit}
              </button>
            ))}
          </div>
        </Card>
        <Card className="grid gap-3 p-3">
          <div className="grid grid-cols-[42px_1fr] items-center gap-3">
            <div className="grid size-10 place-items-center text-arsen-purple2">
              <Disc3 aria-hidden="true" className="size-6" />
            </div>
            <div>
              <strong>Discos disponibles</strong>
              <span className="mt-1 block text-xs text-arsen-muted">Separados por coma, en {preferredUnit}</span>
            </div>
          </div>
          <label className="block">
            <span className="sr-only">Discos disponibles</span>
            <input
              className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-extrabold text-arsen-ink"
              onChange={(event) => setPlatesValue(event.target.value)}
              type="text"
              value={platesValue}
            />
          </label>
          <button
            className="min-h-10 rounded-[10px] border border-arsen-purple/40 px-3 text-sm font-extrabold text-arsen-purple2 disabled:opacity-50"
            disabled={busyAction === 'plates'}
            onClick={savePlateWeights}
            type="button"
          >
            Guardar discos
          </button>
        </Card>
      </SettingsSection>

      <SettingsSection title="Rutinas">
        <ActionRow
          icon={routineActions[0]!.icon}
          label={routineActions[0]!.label}
          meta={routineActions[0]!.meta}
          onClick={() => navigate('/rutina')}
        />
        <ActionRow
          busy={busyAction === 'routine-import'}
          icon={routineActions[1]!.icon}
          label={routineActions[1]!.label}
          meta={routineActions[1]!.meta}
          onClick={() => routineImportInputRef.current?.click()}
        />
        <input
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void runAction(
              'routine-import',
              async () => {
                await importRoutineJson(file)
              },
              'Rutina importada y activada',
            )
          }}
          ref={routineImportInputRef}
          type="file"
        />
      </SettingsSection>

      <SettingsSection title="Deload">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/10 bg-gradient-to-r from-arsen-purple/25 to-arsen-acid/15 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-arsen-bg/70 text-arsen-acid">
                  <Moon aria-hidden="true" className="size-6" />
                </div>
                <div className="min-w-0">
                  <strong className="block text-white">Semana de descarga</strong>
                  <span className="mt-1 block text-xs text-arsen-muted">
                    {deload?.anchorDate ? `${deload.weeksSinceAnchor} semanas desde referencia` : 'Sin registros aun'}
                  </span>
                </div>
              </div>
              <span className="rounded-full border border-arsen-acid/35 bg-arsen-acid/10 px-2.5 py-1 text-xs font-black text-arsen-acid">
                {deloadStatusLabel(deload?.phase)}
              </span>
            </div>
          </div>
          <div className="grid gap-3 p-3">
            {deload?.phase === 'active' ? (
              <button
                className="min-h-10 rounded-[10px] bg-arsen-acid px-3 text-sm font-black text-arsen-bg disabled:opacity-60"
                disabled={busyAction === 'deload-complete'}
                onClick={() =>
                  runAction(
                    'deload-complete',
                    async () => {
                      await completeActiveDeload()
                    },
                    'Deload finalizado',
                  )
                }
                type="button"
              >
                Finalizar deload
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="min-h-10 rounded-[10px] bg-arsen-acid px-3 text-sm font-black text-arsen-bg disabled:opacity-60"
                  disabled={busyAction === 'deload-start'}
                  onClick={() =>
                    runAction(
                      'deload-start',
                      async () => {
                        await startDeloadNow()
                      },
                      'Deload iniciado',
                    )
                  }
                  type="button"
                >
                  Iniciar deload ahora
                </button>
                <button
                  className="min-h-10 rounded-[10px] border border-white/10 px-3 text-sm font-extrabold text-arsen-muted disabled:opacity-60"
                  disabled={busyAction === 'deload-skip' || deload?.phase !== 'suggested'}
                  onClick={() =>
                    runAction(
                      'deload-skip',
                      async () => {
                        await skipDeloadSuggestion()
                      },
                      'Deload pausado 14 dias',
                    )
                  }
                  type="button"
                >
                  Ahora no
                </button>
              </div>
            )}
            <div>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-arsen-muted">Fecha de inicio deload</span>
                <input
                  className="min-h-10 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-sm font-extrabold text-arsen-ink"
                  min={today}
                  onChange={(event) => setDeloadStartDate(event.target.value)}
                  type="date"
                  value={deloadStartDate}
                />
              </label>

            </div>
            <button
              className="min-h-10 rounded-[10px] border border-arsen-purple/35 px-3 text-sm font-extrabold text-arsen-purple2 disabled:opacity-60"
              disabled={busyAction === 'deload-schedule'}
              onClick={programDeload}
              type="button"
            >
              Programar deload
            </button>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-arsen-muted">Series deload</span>
                <input
                  className="min-h-10 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-sm font-extrabold text-arsen-ink"
                  max={60}
                  min={40}
                  onChange={(event) => setSeriesReductionValue(event.target.value)}
                  type="number"
                  value={seriesReductionValue}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-arsen-muted">Peso deload</span>
                <input
                  className="min-h-10 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-sm font-extrabold text-arsen-ink"
                  max={90}
                  min={70}
                  onChange={(event) => setWeightReductionValue(event.target.value)}
                  type="number"
                  value={weightReductionValue}
                />
              </label>
            </div>
            <button
              className="min-h-10 rounded-[10px] border border-arsen-acid/40 px-3 text-sm font-extrabold text-arsen-acid disabled:opacity-60"
              disabled={busyAction === 'deload-settings'}
              onClick={saveDeloadReductions}
              type="button"
            >
              Guardar deload
            </button>
          </div>
        </Card>
        <ActionRow
          busy={busyAction === 'notify'}
          icon={Flame}
          label="Notificacion deload"
          meta={`${deload?.weeksSinceAnchor ?? 0} semanas - ${appSettings?.notificationPermission ?? 'sin permiso'}`}
          onClick={() =>
            runAction(
              'notify',
              async () => {
                const permission = await requestDeloadNotifications()
                if (permission !== 'granted') throw new Error(`Permiso de notificacion: ${permission}`)
              },
              deload?.shouldNotify ? 'Aviso de deload activado' : 'Notificaciones activadas',
            )
          }
        />
      </SettingsSection>

      <SettingsSection title="Almacenamiento">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Estado de almacenamiento</h2>
              <p className="text-sm text-arsen-muted">
                {storage?.persisted ? 'IndexedDB persistente' : 'Persistencia pendiente'}
              </p>
            </div>
            <Database aria-hidden="true" className="size-8 text-arsen-acid" />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-arsen-acid to-arsen-acid2"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-arsen-muted">
            <span>{formatBytes(storage?.usage)} usados</span>
            <span>{formatBytes(storage?.quota)} cuota</span>
          </div>
          <div className="mt-4 grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-[10px] border border-white/10 text-center">
            <Metric label="Rutinas" value={storage?.routines ?? 0} />
            <Metric label="Sesiones" value={storage?.sessions ?? 0} />
            <Metric label="Series" value={storage?.setLogs ?? 0} />
          </div>
          {!storage?.persisted ? (
            <button
              className="mt-3 w-full rounded-[10px] border border-arsen-acid/40 px-3 py-2 text-sm font-extrabold text-arsen-acid"
              onClick={() => runAction('persist', requestPersistentStorage, 'Persistencia solicitada')}
              type="button"
            >
              Fijar almacenamiento offline
            </button>
          ) : null}
        </Card>
      </SettingsSection>

      <SettingsSection danger title="Zona de limpieza">
        <Card className="p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-arsen-muted">Desde</span>
              <input
                className="min-h-10 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-sm font-extrabold text-arsen-ink"
                onChange={(event) => setCleanupStartDate(event.target.value)}
                type="date"
                value={cleanupStartDate}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-arsen-muted">Hasta</span>
              <input
                className="min-h-10 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-sm font-extrabold text-arsen-ink"
                onChange={(event) => setCleanupEndDate(event.target.value)}
                type="date"
                value={cleanupEndDate}
              />
            </label>
          </div>
          <button
            className="mt-3 w-full rounded-[10px] border border-red-300/35 px-3 py-2 text-sm font-extrabold text-red-300 disabled:opacity-50"
            disabled={busyAction === 'delete-range'}
            onClick={async () => {
              if (!(await confirmDanger('Borrar rango', 'Se borraran los registros dentro del rango seleccionado.'))) return
              void runAction(
                'delete-range',
                () => deleteWorkoutLogsByDateRange(cleanupStartDate, cleanupEndDate),
                'Registros del rango borrados',
              )
            }}
            type="button"
          >
            Borrar rango de fechas
          </button>
        </Card>
        <ActionRow
          busy={busyAction === 'delete-active'}
          icon={Trash2}
          label="Borrar logs de rutina activa"
          meta="No borra rutina ni catalogo"
          onClick={async () => {
            if (!(await confirmDanger('Borrar logs', 'Se borraran los registros de la rutina activa.'))) return
            void runAction('delete-active', deleteActiveRoutineWorkoutLogs, 'Registros de rutina activa borrados')
          }}
          tone="danger"
        />
        <ActionRow
          busy={busyAction === 'delete-all'}
          icon={Trash2}
          label="Borrar todos los logs"
          meta="Mantiene rutinas guardadas"
          onClick={async () => {
            if (!(await confirmDanger('Borrar todos los logs', 'Se borraran todos los registros de entrenamiento.'))) return
            void runAction('delete-all', deleteAllWorkoutLogs, 'Todos los registros borrados')
          }}
          tone="danger"
        />
      </SettingsSection>
    </div>
  )
}

type SettingsSectionProps = PropsWithChildren<{
  danger?: boolean
  title: string
}>

function SettingsSection({ children, danger = false, title }: SettingsSectionProps) {
  return (
    <section>
      <div className={['mb-2 text-xs font-extrabold', danger ? 'text-red-300' : 'text-arsen-purple2'].join(' ')}>
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

type ActionRowProps = {
  busy?: boolean
  icon: LucideIcon
  label: string
  meta: string
  onClick?: () => void
  tone?: 'default' | 'danger'
}

function ActionRow({ busy = false, icon: Icon, label, meta, onClick, tone = 'default' }: ActionRowProps) {
  return (
    <button
      className="content-auto grid w-full grid-cols-[42px_1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-arsen-surface p-3 text-left shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)] disabled:opacity-60"
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      <div className={['grid size-10 place-items-center', tone === 'danger' ? 'text-red-300' : 'text-arsen-purple2'].join(' ')}>
        <Icon aria-hidden="true" className="size-6" />
      </div>
      <div>
        <strong className={tone === 'danger' ? 'text-red-300' : undefined}>{label}</strong>
        <span className="mt-1 block text-xs text-arsen-muted">{busy ? 'Procesando...' : meta}</span>
      </div>
      <ChevronRight aria-hidden="true" className="size-5 text-arsen-muted" />
    </button>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-3">
      <div className="text-lg font-black text-arsen-acid">{value}</div>
      <div className="text-xs text-arsen-muted">{label}</div>
    </div>
  )
}

function deloadStatusLabel(phase?: DeloadPhase) {
  if (phase === 'suggested') return 'Sugerido'
  if (phase === 'scheduled') return 'Programado'
  if (phase === 'active') return 'Activo'
  if (phase === 'completed') return 'Completado'

  return 'Sin sugerencia activa'
}

function formatBytes(value?: number | null) {
  if (!value) return '0 MB'

  const gb = value / 1024 / 1024 / 1024
  if (gb >= 1) return `${gb.toFixed(2)} GB`

  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatPlateInputValue(valueKg: number, unit: 'kg' | 'lb') {
  const value = unit === 'kg' ? valueKg : kgToUnit(valueKg, unit)

  return String(Math.round(value * 100) / 100)
}
