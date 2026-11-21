import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../../shared/components/PageHeader'
import { HistoryFilters } from '../components/HistoryFilters'
import { HistoryView } from '../components/HistoryView'
import { useHistory, usePersonalRecords, useProgressDayOptions, useProgressExerciseOptions } from '../hooks'
import type { HistoryFilters as HistoryFilterState } from '../repository'

export function HistoryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mode, setMode] = useState<'list' | 'calendar'>(searchParams.get('modo') === 'list' ? 'list' : 'calendar')
  const [filters, setFilters] = useState<HistoryFilterState>({ period: 'all' })
  const dayOptions = useProgressDayOptions() ?? []
  const exerciseOptions = useProgressExerciseOptions({ dayId: filters.dayId ?? null, routineId: filters.routineId ?? null }) ?? []
  const historyResult = useHistory(filters)
  const records = usePersonalRecords({ canonicalName: filters.canonicalName, dayId: filters.dayId, routineId: filters.routineId }) ?? []
  const sessions = historyResult?.sessions ?? []

  function updateFilters(change: Partial<HistoryFilterState>) {
    setFilters((current) => ({ ...current, ...change }))
  }

  function updateMode(nextMode: 'list' | 'calendar') {
    setMode(nextMode)
    const next = new URLSearchParams(searchParams)
    next.set('modo', nextMode)
    setSearchParams(next)
  }

  return <div className="space-y-4"><PageHeader eyebrow="Diario de entrenamiento" title="Historial"><span className="rounded-full border border-white/10 bg-arsen-surface px-3 py-2 text-xs font-extrabold text-arsen-muted">Offline</span></PageHeader><HistoryFilters days={dayOptions.map((option) => ({ id: option.dayId, name: option.name, routineName: option.routineName }))} exercises={exerciseOptions} filters={filters} onChange={updateFilters} onClear={() => setFilters({ period: 'all' })} routines={[...new Map(dayOptions.map((option) => [option.routineId, option.routineName])).entries()].map(([id, name]) => ({ id, name }))} /><HistoryView filtersActive={Boolean(filters.search || filters.startDate || filters.endDate || filters.routineId || filters.dayId || filters.canonicalName || filters.status || filters.period !== 'all')} mode={mode} onClearFilters={() => setFilters({ period: 'all' })} onModeChange={updateMode} onOpenDate={(date) => { const selected = sessions.filter((session) => session.date === date)[0]; navigate(selected ? `/historial/sesion/${selected.sessionId}` : `/progreso/historial/${date}?create=1`) }} onOpenSession={(sessionId) => navigate(`/historial/sesion/${sessionId}`)} records={records} sessions={sessions} summary={historyResult?.summary} /></div>
}
