import { ArrowDown, ArrowUp, Copy, EllipsisVertical, Pencil, Trash2, X } from 'lucide-react'
import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDialogFocus } from '../../../shared/components/useDialogFocus'

export function ExerciseActions({ canMoveDown, canMoveUp, days, disabled, exerciseName, onDelete, onDuplicate, onEdit, onMove, onReorder }: {
  canMoveDown: boolean
  canMoveUp: boolean
  days: Array<{ id: string; name: string }>
  disabled: boolean
  exerciseName: string
  onDelete: () => void
  onDuplicate: () => void
  onEdit: () => void
  onMove: (dayId: string) => void
  onReorder: (direction: 'up' | 'down') => void
}) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const dialogRef = useDialogFocus(() => setOpen(false), open)
  const button = 'flex min-h-12 items-center gap-2 rounded-[10px] border px-3 text-left text-sm font-bold transition-colors disabled:text-arsen-muted disabled:opacity-70'
  const secondary = `${button} border-white/10 bg-arsen-surface2 enabled:hover:border-arsen-purple/60 enabled:hover:bg-arsen-purple/20`
  return <>
    <button aria-label={`Acciones de ${exerciseName}`} aria-haspopup="dialog" className="grid size-11 place-items-center rounded-[10px] border border-arsen-purple/30 bg-arsen-purple/10 text-arsen-purple2 hover:bg-arsen-purple/20" disabled={disabled} onClick={() => setOpen(true)} type="button"><EllipsisVertical aria-hidden="true" className="size-5" /></button>
    {open ? createPortal(<div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar acciones" className="absolute inset-0 cursor-default" onClick={() => setOpen(false)} type="button" />
      <section aria-labelledby={titleId} aria-modal="true" className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-[22px] border-t border-arsen-purple/40 bg-arsen-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-arsen-ink shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-arsen-purple2/50" />
        <div className="mb-4 flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-xl font-black" id={titleId}>Acciones de {exerciseName}</h2><p className="mt-1 text-sm text-arsen-muted">Organiza este ejercicio</p></div><button aria-label="Cerrar" className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-arsen-surface2 text-arsen-ink" onClick={() => setOpen(false)} type="button"><X aria-hidden="true" className="size-5" /></button></div>
        <div className="grid grid-cols-2 gap-2">
          <button className={`${button} border-arsen-purple/50 bg-arsen-purple/20 enabled:hover:bg-arsen-purple/30`} disabled={disabled} onClick={() => { setOpen(false); onEdit() }} type="button"><Pencil aria-hidden="true" className="size-4 shrink-0 text-arsen-purple2" />Editar</button>
          <button className={secondary} disabled={disabled} onClick={() => { setOpen(false); onDuplicate() }} type="button"><Copy aria-hidden="true" className="size-4 shrink-0 text-arsen-purple2" />Duplicar</button>
          <button className={secondary} disabled={disabled || !canMoveUp} onClick={() => { setOpen(false); onReorder('up') }} type="button"><ArrowUp aria-hidden="true" className="size-4 shrink-0" />Subir</button>
          <button className={secondary} disabled={disabled || !canMoveDown} onClick={() => { setOpen(false); onReorder('down') }} type="button"><ArrowDown aria-hidden="true" className="size-4 shrink-0" />Bajar</button>
          {days.length ? <label className="col-span-full mt-2 text-xs font-bold text-arsen-muted">Mover {exerciseName} a otro día<select className="mt-2 min-h-12 w-full rounded-[10px] border border-white/10 bg-arsen-bg2 px-3 text-sm font-bold text-arsen-ink" disabled={disabled} onChange={(event) => { if (event.target.value) { const dayId = event.target.value; setOpen(false); onMove(dayId) } }} value=""><option value="">Selecciona un día</option>{days.map((day) => <option key={day.id} value={day.id}>{day.name}</option>)}</select></label> : null}
          <button className={`${button} col-span-full mt-1 border-red-400/30 bg-red-500/10 text-red-200 enabled:hover:border-red-400/50 enabled:hover:bg-red-500/20`} disabled={disabled} onClick={() => { setOpen(false); onDelete() }} type="button"><Trash2 aria-hidden="true" className="size-4 shrink-0" />Quitar ejercicio</button>
        </div>
      </section>
    </div>, document.body) : null}
  </>
}
