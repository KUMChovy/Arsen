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
  const [filters, setFilters] = useState<HistoryFilterState>(() => ({ period: 'all', routineId: searchParams.get('rutina') }))
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

  function openDate(date: string) {
    const params = new URLSearchParams()
    if (filters.canonicalName) params.set('exercise', filters.canonicalName)
    if (filters.dayId) params.set('dayId', filters.dayId)
    if (filters.routineId) params.set('routineId', filters.routineId)
    if (!sessions.some((session) => session.date === date)) params.set('create', '1')
    const query = params.toString()
    navigate(`/progreso/historial/${date}${query ? `?${query}` : ''}`)
  }

  return <div className="space-y-4"><PageHeader eyebrow="Diario de entrenamiento" title="Historial"><span className="rounded-full border border-white/10 bg-arsen-surface px-3 py-2 text-xs font-extrabold text-arsen-muted">Offline</span></PageHeader><HistoryFilters days={dayOptions.filter((option) => !filters.routineId || option.routineId === filters.routineId).map((option) => ({ id: option.dayId, name: option.name, routineName: option.routineName }))} exercises={exerciseOptions} filters={filters} onChange={updateFilters} onClear={() => setFilters({ period: 'all' })} routines={[...new Map(dayOptions.map((option) => [option.routineId, option.routineName])).entries()].map(([id, name]) => ({ id, name }))} /><HistoryView key={JSON.stringify(filters)} filtersActive={Boolean(filters.startDate || filters.endDate || filters.routineId || filters.dayId || filters.canonicalName || filters.period !== 'all')} mode={mode} onClearFilters={() => setFilters({ period: 'all' })} onModeChange={updateMode} onOpenDate={openDate} onOpenSession={(sessionId) => { const session = sessions.find((item) => item.sessionId === sessionId); if (session && filters.canonicalName) openDate(session.date); else navigate(`/historial/sesion/${sessionId}`) }} records={records} sessions={sessions} summary={historyResult?.summary} /></div>
}
