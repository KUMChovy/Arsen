import { Search, X } from 'lucide-react'
import type { HistoryFilters as HistoryFilterState } from '../repository'

export function HistoryFilters({
  days = [],
  exercises = [],
  filters,
  onChange,
  onClear,
  routines = [],
}: {
  days?: Array<{ id: string; name: string; routineName: string }>
  exercises?: Array<{ canonicalName: string; name: string }>
  filters: HistoryFilterState
  onChange: (change: Partial<HistoryFilterState>) => void
  onClear: () => void
  routines?: Array<{ id: string; name: string }>
}) {
  const active = Boolean(filters.search || filters.startDate || filters.endDate || filters.routineId || filters.dayId || filters.canonicalName || filters.status || filters.period !== 'all')
  return (
    <section aria-label="Filtros del historial" className="space-y-3 rounded-[12px] border border-white/10 bg-arsen-surface p-3">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-arsen-muted">Buscar</span>
          <span className="relative block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-arsen-muted" /><input aria-label="Buscar en historial" className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg pl-9 pr-3 text-sm font-extrabold text-arsen-ink" onChange={(event) => onChange({ search: event.target.value || null })} placeholder="Ejercicio, rutina o día" type="search" value={filters.search ?? ''} /></span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-arsen-muted">Periodo</span>
          <select aria-label="Periodo del historial" className="min-h-11 rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-xs font-extrabold text-arsen-ink" onChange={(event) => onChange({ period: event.target.value as HistoryFilterState['period'] })} value={filters.period ?? 'all'}>
            <option value="all">Todo el historial</option>
            <option value="4w">Últimas 4 semanas</option>
            <option value="8w">Últimas 8 semanas</option>
            <option value="12w">Últimas 12 semanas</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="mb-1 block text-xs font-bold text-arsen-muted">Desde</span><input aria-label="Fecha inicial del historial" className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-xs font-extrabold text-arsen-ink" onChange={(event) => onChange({ startDate: event.target.value || null })} type="date" value={filters.startDate ?? ''} /></label>
        <label className="block"><span className="mb-1 block text-xs font-bold text-arsen-muted">Hasta</span><input aria-label="Fecha final del historial" className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-xs font-extrabold text-arsen-ink" onChange={(event) => onChange({ endDate: event.target.value || null })} type="date" value={filters.endDate ?? ''} /></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Rutina del historial" className="min-h-11 rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-xs font-extrabold text-arsen-ink" onChange={(event) => onChange({ routineId: event.target.value || null })} value={filters.routineId ?? ''}><option value="">Todas las rutinas</option>{routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}</select>
        <select aria-label="Día del historial" className="min-h-11 rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-xs font-extrabold text-arsen-ink" onChange={(event) => onChange({ dayId: event.target.value || null })} value={filters.dayId ?? ''}><option value="">Todos los días</option>{days.map((day) => <option key={day.id} value={day.id}>{day.name} · {day.routineName}</option>)}</select>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select aria-label="Estado del historial" className="min-h-11 rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-xs font-extrabold text-arsen-ink" onChange={(event) => onChange({ status: (event.target.value || null) as HistoryFilterState['status'] })} value={filters.status ?? ''}><option value="">Todos los estados</option><option value="completed">Completadas</option><option value="draft">Borradores</option></select>
        {active ? <button aria-label="Limpiar filtros del historial" className="inline-flex min-h-11 items-center gap-1 rounded-[10px] border border-white/10 px-3 text-xs font-bold text-arsen-purple2" onClick={onClear} type="button"><X aria-hidden="true" className="size-4" />Limpiar</button> : null}
      </div>
      {exercises.length > 0 ? <label className="block"><span className="mb-1 block text-xs font-bold text-arsen-muted">Ejercicio</span><select aria-label="Ejercicio del historial" className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-xs font-extrabold text-arsen-ink" onChange={(event) => onChange({ canonicalName: event.target.value || null })} value={filters.canonicalName ?? ''}><option value="">Todos los ejercicios</option>{exercises.map((exercise) => <option key={exercise.canonicalName} value={exercise.canonicalName}>{exercise.name}</option>)}</select></label> : null}
    </section>
  )
}
