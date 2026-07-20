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
import type { PropsWithChildren } from 'react'
import { Card } from '../../../shared/components/Card'
import { PageHeader } from '../../../shared/components/PageHeader'

const dataActions = [
  { icon: CloudUpload, label: 'Exportar respaldo', meta: 'Guarda todos tus datos' },
  { icon: CloudDownload, label: 'Importar respaldo', meta: 'Fusionar o reemplazar' },
  { icon: ChartNoAxesCombined, label: 'Exportar progreso', meta: 'JSON + CSV cronológico' },
  { icon: Scale, label: 'Unidades', meta: 'kg base, vista kg/lb' },
]

const routineActions = [
  { icon: Folder, label: 'Rutinas guardadas', meta: 'Cambiar, duplicar o eliminar' },
  { icon: FileUp, label: 'Importar rutina', meta: 'Agregar o reemplazar seleccionada' },
]

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Datos, respaldos y offline" title="Ajustes">
        <button className="grid size-10 place-items-center rounded-[10px] text-arsen-purple2">
          <Settings aria-hidden="true" className="size-6" />
          <span className="sr-only">Configurar Arsen</span>
        </button>
      </PageHeader>

      <SettingsSection title="Datos">
        {dataActions.map((item) => (
          <ActionRow icon={item.icon} key={item.label} label={item.label} meta={item.meta} />
        ))}
      </SettingsSection>

      <SettingsSection title="Rutinas">
        {routineActions.map((item) => (
          <ActionRow icon={item.icon} key={item.label} label={item.label} meta={item.meta} />
        ))}
      </SettingsSection>

      <SettingsSection title="Notificaciones">
        <Card className="grid grid-cols-[42px_1fr_auto] items-center gap-3 p-3">
          <div className="grid size-10 place-items-center text-arsen-acid">
            <Flame aria-hidden="true" className="size-6" />
          </div>
          <div>
            <strong>Deload</strong>
            <span className="mt-1 block text-xs text-arsen-muted">Avisar semanas 5 a 7</span>
          </div>
          <span className="text-sm font-extrabold text-arsen-acid">on</span>
        </Card>
      </SettingsSection>

      <SettingsSection title="Almacenamiento">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Estado de almacenamiento</h2>
              <p className="text-sm text-arsen-muted">IndexedDB persistente</p>
            </div>
            <Database aria-hidden="true" className="size-8 text-arsen-acid" />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-1/4 rounded-full bg-gradient-to-r from-arsen-acid to-arsen-acid2" />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-arsen-muted">
            <span>1.24 GB usados</span>
            <span>5.00 GB disponibles</span>
          </div>
        </Card>
      </SettingsSection>

      <SettingsSection danger title="Zona de limpieza">
        <Card className="grid grid-cols-[42px_1fr_auto] items-center gap-3 p-3">
          <div className="grid size-10 place-items-center text-red-300">
            <Trash2 aria-hidden="true" className="size-6" />
          </div>
          <div>
            <strong className="text-red-300">Borrar registros</strong>
            <span className="mt-1 block text-xs text-arsen-muted">Por rango o rutina activa</span>
          </div>
          <ChevronRight aria-hidden="true" className="size-5 text-arsen-muted" />
        </Card>
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
  icon: LucideIcon
  label: string
  meta: string
}

function ActionRow({ icon: Icon, label, meta }: ActionRowProps) {
  return (
    <Card className="content-auto grid grid-cols-[42px_1fr_auto] items-center gap-3 p-3">
      <div className="grid size-10 place-items-center text-arsen-purple2">
        <Icon aria-hidden="true" className="size-6" />
      </div>
      <div>
        <strong>{label}</strong>
        <span className="mt-1 block text-xs text-arsen-muted">{meta}</span>
      </div>
      <ChevronRight aria-hidden="true" className="size-5 text-arsen-muted" />
    </Card>
  )
}
