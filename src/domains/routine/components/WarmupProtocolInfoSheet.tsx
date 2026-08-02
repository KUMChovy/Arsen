import { X } from 'lucide-react'
import { buildWarmupSets, warmupProtocolLabel, type WarmupProtocol } from '../../../shared/calculations/warmups'
import { Card } from '../../../shared/components/Card'

export function WarmupProtocolInfoSheet({ onClose, protocol }: { onClose: () => void; protocol: WarmupProtocol }) {
  const exampleSets = buildWarmupSets(100, protocol)
  const description = warmupProtocolDescriptions[protocol]

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-[430px] items-end bg-black/60">
      <button aria-label="Cerrar descripcion" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative w-full rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{warmupProtocolLabel(protocol)}</h2>
            <p className="mt-1 text-xs font-semibold text-arsen-muted">Ejemplo con 100 kg de peso de trabajo.</p>
          </div>
          <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>
        <Card className="p-3 text-sm text-arsen-muted">{description}</Card>
        <div className="mt-3 space-y-2">
          {exampleSets.length > 0 ? (
            exampleSets.map((set, index) => (
              <Card className="grid grid-cols-[28px_1fr_1fr_1fr] items-center gap-2 p-3 text-sm" key={`${set.percentage}-${index}`}>
                <span className="grid size-6 place-items-center rounded-full border border-white/15 text-xs text-arsen-muted">{index + 1}</span>
                <strong className="text-arsen-acid">{Math.round(set.percentage * 100)}%</strong>
                <span>{set.weightKg} kg</span>
                <span>
                  {set.reps} reps / RIR {set.rir}
                </span>
              </Card>
            ))
          ) : (
            <Card className="p-3 text-sm text-arsen-muted">No genera series previas.</Card>
          )}
        </div>
      </section>
    </div>
  )
}

const warmupProtocolDescriptions: Record<WarmupProtocol, string> = {
  heavy_low_volume: 'Una aproximacion corta para ejercicios pesados cuando quieres llegar rapido al peso de trabajo sin acumular fatiga.',
  hypertrophy: 'Dos aproximaciones moderadas para preparar articulaciones y patron de movimiento antes de series de 6 a 15 repeticiones.',
  none: 'No agrega calentamientos calculados. Usalo para ejercicios muy ligeros, accesorios simples o cuando ya vienes preparado.',
  progressive: 'Sube de forma gradual y conserva repeticiones controladas. Bueno cuando quieres sentir tecnica y rango antes de trabajar fuerte.',
  strength: 'Tres aproximaciones con menos repeticiones conforme sube el peso. Sirve para cargas altas sin gastar demasiada energia.',
}
