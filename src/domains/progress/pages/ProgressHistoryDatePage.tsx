import { useEffect, useState, useTransition } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ArrowUpRight, Plus } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { PageHeader } from '../../../shared/components/PageHeader'
import { localDateKey } from '../../../shared/utils/date'
import { formatWeight } from '../../../shared/utils/weight'
import { registerMainSetForExercise } from '../../workout/services'
import { getAppSettings } from '../../settings/services'
import { useRoutineDayDetail } from '../../routine/hooks'
import { CreateSessionSheet, type ManualSessionSaveInput } from '../components/CreateSessionSheet'
import { useExistingSessionForDateAndDay, useProgressEditOptions, useSessionsForDate } from '../hooks'
import { formatSessionDate } from './ProgressPage'

export function ProgressHistoryDatePage() {
  const { date = '' } = useParams()
  const [searchParams] = useSearchParams()
  const exercise = searchParams.get('exercise')
  const filters = { canonicalName: exercise, dayId: searchParams.get('dayId'), routineId: searchParams.get('routineId') }
  const sessions = useSessionsForDate(date, filters) ?? []
  const editOptions = useProgressEditOptions()
  const shouldOpenCreateSession = searchParams.get('create') === '1'
  const [creatingSession, setCreatingSession] = useState(shouldOpenCreateSession)
  const [createDate, setCreateDate] = useState(date)
  const [createDayId, setCreateDayId] = useState<string | null>(null)
  const appSettings = useLiveQuery(() => getAppSettings(), [], undefined)
  const createDayDetail = useRoutineDayDetail(createDayId)
  const existingCreateSession = useExistingSessionForDateAndDay(createDate, createDayId)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!shouldOpenCreateSession) return
    setCreateDate(date)
    setCreateDayId(editOptions?.days[0]?.id ?? null)
    setCreatingSession(true)
  }, [date, editOptions, shouldOpenCreateSession])

  function openCreateSession() {
    setCreateDate(date)
    setCreateDayId(editOptions?.days[0]?.id ?? null)
    setCreatingSession(true)
  }

  function saveManualSession(input: ManualSessionSaveInput) {
    startTransition(() => {
      ;(async () => {
        for (const set of input.sets) {
          await registerMainSetForExercise({ date: input.date, dayId: input.dayId, displayUnit: appSettings?.preferredUnit ?? 'kg', dropSet: set.dropSet, exercise: set.exercise, reps: set.reps, rir: set.rir, routineId: input.routineId, weightKg: set.weightKg })
        }
        setCreatingSession(false)
      })().then(() => setMessage(input.date === date ? 'Sesión guardada' : 'Sesión guardada; cambia de fecha para verla')).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Acción no completada'))
    })
  }

  const unit = appSettings?.preferredUnit ?? 'kg'
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Historial por fecha" title={date ? formatSessionDate(date) : 'Historial'}><Link aria-label="Volver al historial" className="grid size-10 place-items-center rounded-[10px] border border-white/10 bg-arsen-surface text-arsen-purple2" to="/historial"><ArrowLeft aria-hidden="true" className="size-5" /></Link></PageHeader>
      {message ? <div className="rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 px-3 py-2 text-xs text-arsen-purple2">{message}</div> : null}
      <ActionButton className="w-full" disabled={!editOptions} onClick={openCreateSession} tone="acid" type="button"><Plus aria-hidden="true" className="size-5" />Crear sesion</ActionButton>
      <section aria-label="Sesiones del día" className="space-y-2">
        {sessions.length > 0 ? sessions.map((session) => {
          const query = exercise ? `?${new URLSearchParams({ exercise })}` : ''
          const match = /^(\d+(?:\.\d+)?) kg x (\d+)$/.exec(session.bestSetLabel)
          const best = match ? `${formatWeight(Number(match[1]), unit)} x ${match[2]}` : session.bestSetLabel
          return <Link className="flex min-h-16 items-center justify-between gap-3 rounded-[12px] border border-white/10 bg-arsen-surface p-3 text-left" key={session.id} to={`/historial/sesion/${session.id}${query}`}><span className="min-w-0"><strong className="block truncate">{session.routineName}</strong><span className="mt-1 block text-xs text-arsen-muted">{session.dayName} · {session.setCount} series · {session.exerciseCount} ejercicios</span><span className="mt-1 block text-xs text-arsen-muted">Mejor {best} · {formatWeight(session.volumeKg, unit)} volumen</span></span><ArrowUpRight aria-hidden="true" className="size-5 shrink-0 text-arsen-purple2" /></Link>
        }) : <Card className="p-4 text-sm text-arsen-muted">No hay sesiones para esta fecha con el filtro actual.</Card>}
      </section>
      {creatingSession && editOptions ? <CreateSessionSheet date={createDate} disabled={isPending} displayUnit={unit} existingSession={existingCreateSession} exercisesForDay={createDayDetail?.exercises ?? []} maxDate={localDateKey(new Date())} onClose={() => setCreatingSession(false)} onDateChange={setCreateDate} onDayChange={setCreateDayId} onSave={saveManualSession} options={editOptions} /> : null}
    </div>
  )
}
