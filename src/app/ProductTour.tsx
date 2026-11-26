import { useLayoutEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { useDialogFocus } from '../shared/components/useDialogFocus'

const defaultSteps = [
  { key: 'entreno', title: 'Entreno', text: 'Consulta el ejercicio actual y registra tus series con el botón central.' },
  { key: 'rutina', title: 'Rutina', text: 'Crea y organiza tus días y ejercicios a tu manera.' },
  { key: 'progreso', title: 'Progreso', text: 'Consulta cómo cambian tus registros con el tiempo.' },
  { key: 'ajustes', title: 'Ajustes', text: 'Administra tu cuenta, tus copias y las preferencias de la app.' },
] as const

export function ProductTourHost() {
  const record = useLiveQuery(() => db.localMetadata.get('productTour').catch(() => undefined), [], undefined)
  const [error, setError] = useState(false)
  if (record?.id !== 'productTour' || record.value !== 'pending') return null
  return <ProductTour error={error} onFinish={() => { setError(false); void db.localMetadata.put({ id: 'productTour', value: 'completed' }).catch(() => setError(true)) }} />
}

export function ProductTour({ onFinish, error = false, steps = defaultSteps, scrollToTarget = false }: { onFinish: () => void; error?: boolean; steps?: ReadonlyArray<{ key: string; title: string; text: string; mode?: string }>; scrollToTarget?: boolean }) {
  const [index, setIndex] = useState(0)
  const [target, setTarget] = useState<DOMRect | null>(null)
  const step = steps[index]!
  const dialogRef = useDialogFocus(onFinish)
  useLayoutEffect(() => {
    if (step.mode) window.dispatchEvent(new CustomEvent('arsen:tour-routine-mode', { detail: step.mode }))
    const element = document.querySelector(`[data-tour="${step.key}"]`)
    if (scrollToTarget && element && typeof element.scrollIntoView === 'function') element.scrollIntoView({ block: 'center' })
    const update = () => setTarget(element?.getBoundingClientRect() ?? null)
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [step.key, step.mode, scrollToTarget])
  return <div className="fixed inset-0 z-[60] mx-auto max-w-[430px] bg-black/75">
    {target && target.width > 0 && target.height > 0 ? <div aria-hidden="true" className="pointer-events-none fixed rounded-xl border-2 border-arsen-acid" style={{ top: target.top - 3, left: target.left - 3, width: target.width + 6, height: target.height + 6 }} /> : null}
    <section aria-labelledby="product-tour-title" aria-modal="true" className="absolute inset-x-4 bottom-[max(110px,env(safe-area-inset-bottom))] max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl border border-arsen-purple/50 bg-arsen-surface p-5 shadow-xl" ref={dialogRef} role="dialog" tabIndex={-1}>
      <p className="text-xs font-bold text-arsen-purple2">{index + 1} de {steps.length}</p>
      <h2 className="mt-2 text-xl font-black" id="product-tour-title">{step.title}</h2>
      <p className="mt-2 text-sm leading-6 text-arsen-ink">{step.text}</p>
      {error ? <p className="mt-2 text-sm text-red-300" role="alert">No se pudo guardar tu elección. Inténtalo de nuevo.</p> : null}
      <div className="mt-4 flex items-center justify-between gap-2">
        <button className="min-h-12 px-2 text-sm font-semibold text-arsen-muted" onClick={onFinish} type="button">Omitir recorrido</button>
        <div className="flex gap-2">{index > 0 ? <button className="min-h-12 rounded-lg border border-white/20 px-3 text-sm font-bold" onClick={() => setIndex(index - 1)} type="button">Anterior</button> : null}<button className="min-h-12 rounded-lg bg-arsen-purple2 px-4 text-sm font-bold text-arsen-bg" onClick={() => index === steps.length - 1 ? onFinish() : setIndex(index + 1)} type="button">{index === steps.length - 1 ? 'Terminar' : 'Siguiente'}</button></div>
      </div>
    </section>
  </div>
}
