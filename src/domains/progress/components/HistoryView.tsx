import { ChevronLeft, ChevronRight, FilterX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card } from '../../../shared/components/Card'
import { formatWeight } from '../../../shared/utils/weight'
import type { HistorySessionSummary, HistorySummary, PersonalRecord, RecentSessionSummary } from '../repository'

type HistoryMode = 'list' | 'calendar'
type SessionSummary = HistorySessionSummary | RecentSessionSummary

export function HistoryView({
  filtersActive,
  mode = 'list',
  onClearFilters,
  onModeChange,
  onOpenDate,
  onOpenSession,
  records = [],
  sessions,
  summary,
  unit = 'kg',
}: {
  filtersActive: boolean
  mode?: HistoryMode
  onClearFilters: () => void
  onModeChange?: (mode: HistoryMode) => void
  onOpenDate?: (date: string) => void
  onOpenSession: (sessionId: string) => void
  records?: PersonalRecord[]
  sessions: SessionSummary[]
  summary?: HistorySummary
  unit?: 'kg' | 'lb'
}) {
  const [activeMode, setActiveMode] = useState<HistoryMode>(mode)
  const [page, setPage] = useState(0)
  const pageSize = 20
  const pageCount = Math.max(1, Math.ceil(sessions.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const visibleSessions = sessions.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const [monthDate, setMonthDate] = useState(() => new Date(`${sessions[0]?.date ?? localDateKey(new Date())}T12:00:00`))
  const trainedDates = useMemo(() => new Set(sessions.map((session) => session.date)), [sessions])
  const calendarDays = useMemo(() => monthGrid(monthDate), [monthDate])
  const monthLabel = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(monthDate)
  const totals = summary ?? {
    distinctTrainingDays: trainedDates.size,
    exercises: sessions.reduce((total, session) => total + session.exerciseCount, 0),
    mainSets: sessions.reduce((total, session) => total + ('mainSetCount' in session ? session.mainSetCount : session.setCount), 0),
    sessions: sessions.length,
    volumeKg: sessions.reduce((total, session) => total + session.volumeKg, 0),
  }

  function changeMode(nextMode: HistoryMode) {
    setActiveMode(nextMode)
    onModeChange?.(nextMode)
  }

  return (
    <section aria-label="Historial de entrenamientos" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black">Historial cronológico</h2>
          <p className="mt-1 text-xs text-arsen-muted">{totals.sessions} sesiones · {totals.distinctTrainingDays} días · {formatWeight(totals.volumeKg, unit)} de volumen</p>
        </div>
        {filtersActive ? <button aria-label="Limpiar filtros" className="inline-flex min-h-11 items-center gap-1 rounded-[10px] border border-white/10 px-3 text-xs font-bold text-arsen-purple2" onClick={onClearFilters} type="button"><FilterX aria-hidden="true" className="size-4" />Limpiar</button> : null}
      </div>
      {records.length > 0 ? <Card aria-label="Récords personales" className="space-y-2 p-3"><h3 className="text-sm font-black">Récords personales</h3><div className="grid gap-2">{records.slice(0, 3).map((record) => <div className="flex items-center justify-between gap-2 rounded-[10px] border border-white/10 bg-arsen-bg/50 p-2 text-sm" key={record.canonicalName}><span className="min-w-0 truncate">{record.exerciseName}</span><strong className="shrink-0 text-arsen-acid">{formatWeight(record.weightKg, unit)}</strong></div>)}</div></Card> : null}

      <div aria-label="Modo de historial" className="grid grid-cols-2 gap-1 rounded-[12px] border border-white/10 bg-arsen-bg/60 p-1" role="tablist">
        {(['list', 'calendar'] as const).map((value) => (
          <button aria-selected={activeMode === value} className={['min-h-11 rounded-[10px] text-xs font-black', activeMode === value ? 'bg-arsen-purple/35 text-arsen-ink' : 'text-arsen-muted'].join(' ')} key={value} onClick={() => changeMode(value)} role="tab" type="button">
            {value === 'list' ? 'Lista' : 'Calendario'}
          </button>
        ))}
      </div>

      {activeMode === 'calendar' ? (
        <Card className="space-y-3 p-3">
          <div className="flex items-center justify-between gap-3">
            <button aria-label="Mes anterior" className="grid size-10 place-items-center rounded-[10px] border border-white/10 text-arsen-purple2" onClick={() => moveMonth(setMonthDate, -1)} type="button"><ChevronLeft aria-hidden="true" className="size-5" /></button>
            <strong className="capitalize text-sm">{monthLabel}</strong>
            <button aria-label="Mes siguiente" className="grid size-10 place-items-center rounded-[10px] border border-white/10 text-arsen-purple2" onClick={() => moveMonth(setMonthDate, 1)} type="button"><ChevronRight aria-hidden="true" className="size-5" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-extrabold text-arsen-muted">{['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) => {
              const key = date ? localDateKey(date) : ''
              const hasTraining = key ? trainedDates.has(key) : false
              const enabled = Boolean(key && key <= localDateKey(new Date()))
              return <button aria-label={key ? (hasTraining ? `Ver sesiones del ${formatDateLabel(key)}` : `Crear sesión del ${formatDateLabel(key)}`) : 'Día vacío'} className={['aspect-square rounded-[10px] text-sm font-extrabold', hasTraining ? 'border border-arsen-purple2 bg-arsen-purple/35 text-white' : enabled ? 'border border-white/10 bg-white/[0.06] text-arsen-muted' : 'border border-white/5 bg-white/[0.03] text-arsen-dim'].join(' ')} disabled={!enabled} key={key || `empty-${index}`} onClick={() => { if (key) onOpenDate?.(key) }} type="button">{date?.getDate() ?? ''}</button>
            })}
          </div>
          {sessions.length === 0 ? <Card className="p-3 text-sm text-arsen-muted">No hay sesiones en este periodo.</Card> : null}
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.length > 0 ? visibleSessions.map((session) => <HistorySessionCard key={sessionIdOf(session)} onOpen={() => onOpenSession(sessionIdOf(session))} session={session} unit={unit} />) : <Card className="p-4 text-sm text-arsen-muted">No hay sesiones con estos filtros.</Card>}
          {sessions.length > pageSize ? <div className="flex items-center justify-between gap-2 rounded-[10px] border border-white/10 bg-arsen-bg/50 p-2"><button aria-label="Página anterior" className="min-h-10 rounded-[9px] border border-white/10 px-3 text-xs font-bold text-arsen-purple2 disabled:opacity-40" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button">Anterior</button><span className="text-xs font-bold text-arsen-muted">Mostrando {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, sessions.length)} de {sessions.length}</span><button aria-label="Página siguiente" className="min-h-10 rounded-[9px] border border-white/10 px-3 text-xs font-bold text-arsen-purple2 disabled:opacity-40" disabled={currentPage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} type="button">Siguiente</button></div> : null}
        </div>
      )}
    </section>
  )
}

function HistorySessionCard({ onOpen, session, unit }: { onOpen: () => void; session: SessionSummary; unit: 'kg' | 'lb' }) {
  const mainSets = 'mainSetCount' in session ? session.mainSetCount : session.setCount
  const status = 'status' in session ? session.status : null
  return <button aria-label={`Abrir sesión ${formatDateLabel(session.date)}`} className="grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[12px] border border-white/10 bg-arsen-surface px-2.5 py-2 text-left shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-arsen-acid" onClick={onOpen} type="button"><span className="text-xs font-black text-arsen-ink">{formatDateLabel(session.date)}</span><span className="min-w-0"><strong className="block truncate text-xs">{session.routineName} · {session.dayName}</strong><span className="mt-0.5 block truncate text-xs text-arsen-dim">{mainSets} series · {formatWeight(session.volumeKg, unit)} · {session.exerciseCount} ejercicios</span></span><span className="text-right text-xs text-arsen-muted">{status === 'draft' ? <span className="mb-0.5 block text-orange-300">Borrador</span> : null}<span className="block">Mejor</span><strong className="text-xs text-arsen-ink">{formatBestSetLabel(session.bestSetLabel, unit)}</strong></span></button>
}

function sessionIdOf(session: SessionSummary) { return 'sessionId' in session ? session.sessionId : session.id }
function moveMonth(setMonthDate: (update: (current: Date) => Date) => void, delta: number) { setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12)) }
function monthGrid(monthDate: Date) { const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12); const cells: Array<Date | null> = Array.from({ length: first.getDay() }, () => null); for (let day = 1; day <= new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate(); day += 1) cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day, 12)); while (cells.length % 7 !== 0) cells.push(null); return cells }
function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function formatDateLabel(value: string) { return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)).replace('.', '') }
function formatBestSetLabel(label: string, unit: 'kg' | 'lb') { const match = /^(\d+(?:\.\d+)?) kg x (\d+)$/.exec(label); return match ? `${formatWeight(Number(match[1]), unit)} x ${match[2]}` : label }
