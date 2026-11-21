import { Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card } from '../../../shared/components/Card'
import type { ProgressExerciseOption } from '../repository'

export function ExerciseExplorer({ onOpen, options }: { onOpen: (canonicalName: string) => void; options: ProgressExerciseOption[] }) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [sort, setSort] = useState<'alpha' | 'recent'>('alpha')
  const muscles = [...new Set(options.map((option) => option.mainMuscle).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b))
  const visible = useMemo(() => options
    .filter((option) => !query.trim() || option.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .filter((option) => !muscle || option.mainMuscle === muscle)
    .sort((a, b) => sort === 'recent'
      ? (b.lastTrainedDate ?? '').localeCompare(a.lastTrainedDate ?? '')
      : a.name.localeCompare(b.name)), [muscle, options, query, sort])

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-3">
        <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-arsen-muted" /><input aria-label="Buscar ejercicio" className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-9 text-sm font-bold text-arsen-ink placeholder:text-arsen-dim focus-visible:outline-2 focus-visible:outline-arsen-acid" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ejercicio" type="search" value={query} /></div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label><span className="mb-1 block text-xs font-bold text-arsen-muted">Músculo</span><select aria-label="Filtrar por músculo" className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-bold text-arsen-ink" onChange={(event) => setMuscle(event.target.value)} value={muscle}><option value="">Todos</option>{muscles.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-bold text-arsen-muted">Orden</span><select aria-label="Ordenar ejercicios" className="min-h-11 rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-bold text-arsen-ink" onChange={(event) => setSort(event.target.value as 'alpha' | 'recent')} value={sort}><option value="alpha">A-Z</option><option value="recent">Recientes</option></select></label>
        </div>
      </Card>
      <div className="flex items-center gap-2 text-xs font-bold text-arsen-muted"><SlidersHorizontal aria-hidden="true" className="size-4" />{visible.length} ejercicios con historial</div>
      <section aria-label="Ejercicios registrados" className="space-y-2">
        {visible.map((option) => <button aria-label={option.name} className="grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-3 rounded-[12px] border border-white/10 bg-arsen-surface p-3 text-left shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-arsen-acid" key={option.canonicalName} onClick={() => onOpen(option.canonicalName)} type="button"><span className="min-w-0"><strong className="block truncate text-sm">{option.name}</strong><span className="mt-1 block truncate text-xs text-arsen-muted">{option.mainMuscle ?? 'Músculo no disponible'} · {option.routineNames.join(', ') || 'Rutina eliminada'}</span></span><span className="text-right text-xs text-arsen-dim"><strong className="block text-arsen-ink">{option.sessions}</strong>{option.lastTrainedDate ?? 'Sin fecha'}</span></button>)}
        {visible.length === 0 ? <Card className="p-4 text-sm text-arsen-muted">No encontramos ejercicios con esos filtros.</Card> : null}
      </section>
    </div>
  )
}
