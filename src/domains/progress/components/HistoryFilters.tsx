import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import type { HistoryFilters as HistoryFilterState } from '../repository'

export function HistoryFilters({ days = [], exercises = [], filters, onChange, onClear, routines = [] }: {
  days?: Array<{ id: string; name: string; routineName: string }>
  exercises?: Array<{ canonicalName: string; name: string }>
  filters: HistoryFilterState
  onChange: (change: Partial<HistoryFilterState>) => void
  onClear: () => void
  routines?: Array<{ id: string; name: string }>
}) {
  const active = Boolean(filters.startDate || filters.endDate || filters.routineId || filters.dayId || filters.canonicalName || filters.period !== 'all')
  const field = 'min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-sm font-bold text-arsen-ink'
  return (
    <details className="group rounded-[12px] border border-white/10 bg-arsen-surface">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 text-sm font-black"><SlidersHorizontal aria-hidden="true" className="size-4 text-arsen-purple2" /><span>Filtros</span>{active ? <span className="text-xs text-arsen-purple2">Activos</span> : null}<ChevronDown aria-hidden="true" className="ml-auto size-4 text-arsen-muted group-open:rotate-180" /></summary>
      <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-3">
        <label className="block text-xs font-bold text-arsen-muted">Periodo<select aria-label="Periodo del historial" className={`${field} mt-1`} onChange={(event) => onChange({ period: event.target.value as HistoryFilterState['period'] })} value={filters.period ?? 'all'}><option value="all">Todo el historial</option><option value="4w">Últimas 4 semanas</option><option value="8w">Últimas 8 semanas</option><option value="12w">Últimas 12 semanas</option></select></label>
        <label className="block min-w-0 text-xs font-bold text-arsen-muted">Fecha<input aria-label="Fecha del historial" className={`${field} mt-1 min-w-0`} onChange={(event) => onChange({ startDate: event.target.value || null, endDate: event.target.value || null })} type="date" value={filters.startDate ?? ''} /></label>
        <label className="block text-xs font-bold text-arsen-muted">Rutina<select aria-label="Rutina del historial" className={`${field} mt-1`} onChange={(event) => onChange({ routineId: event.target.value || null, dayId: null, canonicalName: null })} value={filters.routineId ?? ''}><option value="">Todas</option>{routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}</select></label>
        <label className="block text-xs font-bold text-arsen-muted">Día<select aria-label="Día del historial" className={`${field} mt-1`} onChange={(event) => onChange({ dayId: event.target.value || null, canonicalName: null })} value={filters.dayId ?? ''}><option value="">Todos</option>{days.map((day) => <option key={day.id} value={day.id}>{day.name} · {day.routineName}</option>)}</select></label>
        <label className="col-span-2 block text-xs font-bold text-arsen-muted">Ejercicio<select aria-label="Ejercicio del historial" className={`${field} mt-1`} onChange={(event) => onChange({ canonicalName: event.target.value || null })} value={filters.canonicalName ?? ''}><option value="">Todos los ejercicios</option>{exercises.map((exercise) => <option key={exercise.canonicalName} value={exercise.canonicalName}>{exercise.name}</option>)}</select></label>
        {active ? <button className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1 rounded-[10px] border border-white/10 text-xs font-bold text-arsen-purple2" onClick={onClear} type="button"><X aria-hidden="true" className="size-4" />Limpiar filtros</button> : null}
      </div>
    </details>
  )
}
