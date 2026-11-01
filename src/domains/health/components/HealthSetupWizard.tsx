import { Check, ChevronDown, HeartPulse, Info, Smartphone } from 'lucide-react'
import { useState } from 'react'
import type { HealthAvailabilityStatus } from '../native'
import { Card } from '../../../shared/components/Card'

export type HealthSetupAvailability = HealthAvailabilityStatus | 'not-native' | 'loading'

export function HealthSetupWizard({
  availability,
  busyAction,
  healthEnabled,
  onActivate,
  onOpenAccess,
  permissionsGranted,
}: {
  availability: HealthSetupAvailability
  busyAction: string | null
  healthEnabled: boolean
  onActivate: () => void
  onOpenAccess: () => void
  permissionsGranted: number
}) {
  const hasPermissions = permissionsGranted > 0
  const [collapsed, setCollapsed] = useState(false)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)

  return (
    <Card className="overflow-hidden border-arsen-acid/35 p-0">
      <div className="border-b border-white/10 bg-gradient-to-r from-arsen-purple/25 to-arsen-acid/15 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-arsen-bg/75 text-arsen-acid">
              <HeartPulse aria-hidden="true" className="size-6" />
            </div>
            <div className="min-w-0">
              <strong className="block text-white">Integración de salud</strong>
              <span className="mt-1 block text-xs text-arsen-muted">Lectura diaria bajo demanda</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="relative">
              <button
                aria-expanded={availabilityOpen}
                aria-label="Información sobre disponibilidad"
                className="grid size-9 place-items-center rounded-[9px] border border-white/10 text-arsen-muted"
                onClick={() => setAvailabilityOpen((current) => !current)}
                type="button"
              >
                <Info aria-hidden="true" className="size-4" />
              </button>
              {availabilityOpen ? (
                <div aria-label="Disponibilidad de datos" className="absolute right-0 top-10 z-10 w-64 rounded-[10px] border border-arsen-purple/35 bg-arsen-bg2 p-3 text-xs leading-relaxed text-arsen-muted shadow-xl" role="menu">
                  <p role="menuitem">La actualización no siempre es en tiempo real: algunas apps necesitan abrirse para guardar o publicar datos.</p>
                  <p className="mt-2" role="menuitem">Health Connect puede entregar intervalos de aproximadamente 30 minutos y Arsen consulta también datos anteriores a la conexión.</p>
                </div>
              ) : null}
            </div>
            <span className="rounded-full border border-arsen-acid/35 bg-arsen-acid/10 px-2.5 py-1 text-xs font-black text-arsen-acid">
              {healthEnabled && hasPermissions ? 'Activa' : 'Opcional'}
            </span>
            <button
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? 'Expandir' : 'Contraer'} integración de salud`}
              className="grid size-9 place-items-center rounded-[9px] border border-white/10 text-arsen-muted"
              onClick={() => setCollapsed((current) => !current)}
              type="button"
            >
              <ChevronDown aria-hidden="true" className={['size-4 transition-transform', collapsed ? '-rotate-90' : ''].join(' ')} />
            </button>
          </div>
        </div>
      </div>

      {!collapsed ? <div className="grid gap-3 p-3">
        {/* Cada paso separa proveedor, permisos de Arsen y sincronización de la app del reloj. */}
        <div className="flex items-start gap-3">
          <StepIcon done={availability === 'available'} step="1" />
          <div className="min-w-0 flex-1">
            <strong className="block">Health Connect</strong>
            <p className="mt-1 text-xs leading-relaxed text-arsen-muted">{providerMessage(availability)}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <StepIcon done={hasPermissions} step="2" />
          <div className="min-w-0 flex-1">
            <strong className="block">Permisos de lectura</strong>
            <p className="mt-1 text-xs leading-relaxed text-arsen-muted">
              Arsen solicita solo pulso, calorías activas, pasos y oxígeno. Puedes concederlos de forma parcial.
            </p>
            <span className="mt-1 block text-xs font-bold text-arsen-purple2">
              {hasPermissions ? `${permissionsGranted} de 4 permisos activos` : 'Se solicitarán al activar'}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <StepIcon done={false} step="3" />
          <div className="min-w-0 flex-1">
            <strong className="block">App que administra tu reloj</strong>
            <p className="mt-1 text-xs leading-relaxed text-arsen-muted">
              Sincroniza primero el reloj en la app de su marca y activa allí Health Connect. Ejemplos: Mi Fitness para Xiaomi/Redmi, Samsung Health para Galaxy Watch, Fitbit o Garmin Connect cuando su versión y región lo permitan.
            </p>
            <p className="mt-2 flex gap-1 text-xs text-arsen-dim">
              <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              Arsen no se conecta al reloj directamente. Health Connect puede estar disponible aunque la app del reloj todavía no haya publicado registros.
            </p>
          </div>
        </div>

        {!healthEnabled ? (
          /* Activar comprueba disponibilidad y abre el contrato oficial de permisos. */
          <button
            className="min-h-12 w-full rounded-[10px] bg-gradient-to-b from-arsen-purple2 to-arsen-purple px-4 text-sm font-black text-white disabled:opacity-60"
            disabled={busyAction === 'health-integration'}
            onClick={onActivate}
            type="button"
          >
            {busyAction === 'health-integration' ? 'Comprobando Health Connect…' : 'Activar integración'}
          </button>
        ) : (
          <button
            className="min-h-10 w-full rounded-[10px] border border-arsen-purple/40 px-3 text-sm font-extrabold text-arsen-purple2 disabled:opacity-60"
            disabled={busyAction === 'health-access'}
            onClick={onOpenAccess}
            type="button"
          >
            Gestionar permisos en Health Connect
          </button>
        )}

        <div className="flex items-start gap-2 rounded-[10px] border border-arsen-acid/25 bg-arsen-acid/10 p-3 text-xs text-arsen-muted">
          <Smartphone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-arsen-acid" />
          <span>Después de sincronizar la app del reloj, vuelve a Entreno y toca «Sincronizar salud». Arsen solo muestra lo que Health Connect recibió.</span>
        </div>
      </div> : null}
    </Card>
  )
}

function StepIcon({ done, step }: { done: boolean; step: string }) {
  return (
    <span className={['grid size-7 shrink-0 place-items-center rounded-full border text-xs font-black', done ? 'border-arsen-acid/60 bg-arsen-acid/15 text-arsen-acid' : 'border-white/15 bg-white/5 text-arsen-muted'].join(' ')}>
      {done ? <Check aria-hidden="true" className="size-4" /> : step}
    </span>
  )
}

function providerMessage(availability: HealthSetupAvailability) {
  if (availability === 'available') return 'Health Connect está disponible. La detección se completó al activar la integración.'
  if (availability === 'provider-update-required') return 'Health Connect necesita una actualización. Al activar se abrirá Google Play.'
  if (availability === 'unavailable') return 'Health Connect no está instalado o no está disponible. Al activar se abrirá Google Play.'
  if (availability === 'not-native') return 'Esta conexión solo está disponible en la app Android.'
  return 'Pulsa Activar integración para comprobar Health Connect y solicitar permisos.'
}
