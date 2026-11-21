import { FilterX } from 'lucide-react'
import { Card } from '../../../shared/components/Card'
import { formatWeight } from '../../../shared/utils/weight'
import type { RecentSessionSummary } from '../repository'

export function HistoryView({ filtersActive, onClearFilters, onOpenSession, sessions, unit = 'kg' }: { filtersActive: boolean; onClearFilters: () => void; onOpenSession: (sessionId: string) => void; sessions: RecentSessionSummary[]; unit?: 'kg' | 'lb' }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-black">Historial cronológico</h2><p className="mt-1 text-xs text-arsen-muted">Consulta cualquier sesión sin elegir un día primero.</p></div>{filtersActive ? <button aria-label="Limpiar filtros" className="inline-flex min-h-11 items-center gap-1 rounded-[10px] border border-white/10 px-3 text-xs font-bold text-arsen-purple2" onClick={onClearFilters} type="button"><FilterX aria-hidden="true" className="size-4" />Limpiar</button> : null}</div>
      {sessions.length > 0 ? sessions.map((session) => <button aria-label={`Abrir sesión ${formatDateLabel(session.date)}`} className="grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-3 rounded-[12px] border border-white/10 bg-arsen-surface p-3 text-left shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-arsen-acid" key={session.id} onClick={() => onOpenSession(session.id)} type="button"><span className="min-w-0"><strong className="block truncate text-sm">{formatDateLabel(session.date)}</strong><span className="mt-1 block truncate text-xs text-arsen-muted">{session.routineName} · {session.dayName}</span><span className="mt-1 block truncate text-xs text-arsen-dim">{session.setCount} series · {formatWeight(session.volumeKg, unit)} · {session.exerciseCount} ejercicios</span></span><span className="text-right text-xs text-arsen-muted">Mejor<br /><strong className="text-arsen-ink">{formatBestSetLabel(session.bestSetLabel, unit)}</strong></span></button>) : <Card className="p-4 text-sm text-arsen-muted">No hay sesiones con estos filtros.</Card>}
    </section>
  )
}

function formatDateLabel(value: string) { return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)).replace('.', '') }
function formatBestSetLabel(label: string, unit: 'kg' | 'lb') {
  const match = /^(\d+(?:\.\d+)?) kg x (\d+)$/.exec(label)
  return match ? `${formatWeight(Number(match[1]), unit)} x ${match[2]}` : label
}
