import { useRef, useState, type PropsWithChildren } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChartNoAxesCombined,
  ChevronRight,
  CloudDownload,
  CloudUpload,
  Database,
  FileUp,
  Flame,
  Folder,
  Scale,
  Settings,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '../../../shared/components/Card'
import { PageHeader } from '../../../shared/components/PageHeader'
import {
  exportFullBackup,
  exportProgressCsv,
  exportProgressJson,
  deleteActiveRoutineWorkoutLogs,
  deleteAllWorkoutLogs,
  getAppSettings,
  getStorageOverview,
  importFullBackup,
  requestPersistentStorage,
  updatePreferredUnit,
} from '../services'
import { getDeloadOverview, requestDeloadNotifications } from '../notifications'

const routineActions = [
  { icon: Folder, label: 'Rutinas guardadas', meta: 'Cambiar, duplicar o eliminar' },
  { icon: FileUp, label: 'Importar rutina', meta: 'Agregar o reemplazar seleccionada' },
]

export function SettingsPage() {
  const importInputRef = useRef<HTMLInputElement>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const appSettings = useLiveQuery(() => getAppSettings(), [], undefined)
  const deload = useLiveQuery(() => getDeloadOverview(), [], undefined)
  const storage = useLiveQuery(() => getStorageOverview(), [], undefined)
  const storagePercent = storage?.usage && storage.quota ? Math.min(100, Math.round((storage.usage / storage.quota) * 100)) : 0

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
          busy={busyAction === 'backup-import'}
          icon={CloudDownload}
          label="Importar respaldo"
          meta="Reemplaza datos locales"
          onClick={() => importInputRef.current?.click()}
        />
        <input
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void runAction('backup-import', () => importFullBackup(file), 'Respaldo importado')
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
      </SettingsSection>

      <SettingsSection title="Rutinas">
        {routineActions.map((item) => (
          <ActionRow icon={item.icon} key={item.label} label={item.label} meta={item.meta} />
        ))}
      </SettingsSection>

      <SettingsSection title="Notificaciones">
        <ActionRow
          busy={busyAction === 'notify'}
          icon={Flame}
          label="Deload"
          meta={
            deload?.firstLogDate
              ? `${deload.weeks} semanas · ${appSettings?.notificationPermission ?? 'sin permiso'}`
              : 'Sin registros aun'
          }
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
        <ActionRow
          busy={busyAction === 'delete-active'}
          icon={Trash2}
          label="Borrar logs de rutina activa"
          meta="No borra rutina ni catalogo"
          onClick={() => {
            if (!window.confirm('Borrar registros de la rutina activa?')) return
            void runAction('delete-active', deleteActiveRoutineWorkoutLogs, 'Registros de rutina activa borrados')
          }}
          tone="danger"
        />
        <ActionRow
          busy={busyAction === 'delete-all'}
          icon={Trash2}
          label="Borrar todos los logs"
          meta="Mantiene rutinas guardadas"
          onClick={() => {
            if (!window.confirm('Borrar todos los registros de entrenamiento?')) return
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
      <div className="text-[11px] text-arsen-muted">{label}</div>
    </div>
  )
}

function formatBytes(value?: number | null) {
  if (!value) return '0 MB'

  const gb = value / 1024 / 1024 / 1024
  if (gb >= 1) return `${gb.toFixed(2)} GB`

  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
