import { localDateKey } from '../../../shared/utils/date'
import type { SessionDetail } from '../repository'

export type HistoricalSessionEditInput = {
  date: string
  notes: string
  status: 'draft' | 'completed'
}

export function EditHistoricalSessionSheet({ detail, disabled = false, onClose, onSave }: { detail: SessionDetail; disabled?: boolean; onClose: () => void; onSave: (input: HistoricalSessionEditInput) => void }) {
  return <div aria-label="Editar sesión" className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-3" role="dialog">
    <form className="w-full max-w-[430px] space-y-4 rounded-2xl border border-white/10 bg-arsen-surface p-4 shadow-2xl" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ date: String(form.get('date') ?? detail.date), notes: String(form.get('notes') ?? ''), status: form.get('status') === 'completed' ? 'completed' : 'draft' }) }}>
      <div><h2 className="text-lg font-black">Editar sesión</h2><p className="mt-1 text-sm text-arsen-muted">Actualiza la fecha, el estado o las notas sin perder sus registros.</p></div>
      <label className="block text-sm font-bold" htmlFor="history-session-date">Fecha de la sesión<input className="mt-1 min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3" defaultValue={detail.date} id="history-session-date" max={localDateKey(new Date())} name="date" required type="date" /></label>
      <label className="block text-sm font-bold" htmlFor="history-session-status">Estado de la sesión<select className="mt-1 min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3" defaultValue={detail.status} id="history-session-status" name="status"><option value="completed">Completada</option><option value="draft">Borrador</option></select></label>
      <label className="block text-sm font-bold" htmlFor="history-session-notes">Notas de la sesión<textarea className="mt-1 min-h-24 w-full rounded-[10px] border border-white/10 bg-arsen-bg p-3" defaultValue={detail.notes} id="history-session-notes" name="notes" /></label>
      <div className="flex gap-2"><button className="min-h-11 flex-1 rounded-[10px] border border-white/10 font-bold" onClick={onClose} type="button">Cancelar</button><button className="min-h-11 flex-1 rounded-[10px] bg-arsen-purple font-black text-white disabled:opacity-50" disabled={disabled} type="submit">{disabled ? 'Guardando…' : 'Guardar sesión'}</button></div>
    </form>
  </div>
}
