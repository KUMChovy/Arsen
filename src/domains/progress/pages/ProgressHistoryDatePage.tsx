import { useState, useTransition } from 'react'
import { ArrowLeft, ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import { confirmDanger } from '../../../shared/utils/alerts'
import { deleteMainSet, deleteWorkoutSession, moveMainSetToExercise, updateMainSet, updateWorkoutSession } from '../../workout/services'
import { useProgressEditOptions, useSessionDetail, useSessionsForDate } from '../hooks'
import type { RecentSessionSummary, SessionDetail } from '../repository'
import { EditSetSheet, formatSessionDate, type EditSetState } from './ProgressPage'

export function ProgressHistoryDatePage() {
  const { date = '' } = useParams()
  const sessions = useSessionsForDate(date) ?? []
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const expandedDetail = useSessionDetail(expandedSessionId)
  const editOptions = useProgressEditOptions()
  const [editingSet, setEditingSet] = useState<EditSetState | null>(null)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function runHistoryAction(action: () => Promise<void>, success: string) {
    startTransition(() => {
      action()
        .then(() => setMessage(success))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Accion no completada'))
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Historial por fecha" title={date ? formatSessionDate(date) : 'Historial'}>
        <Link
          aria-label="Volver a rendimiento"
          className="grid size-10 place-items-center rounded-[10px] border border-white/10 bg-arsen-surface text-arsen-purple2"
          to="/progreso"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
      </PageHeader>

      {message ? (
        <div className="rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 px-3 py-2 text-xs text-arsen-purple2">
          {message}
        </div>
      ) : null}

      <section className="space-y-2">
        {sessions.length > 0 ? (
          sessions.map((session) => (
            <div className="space-y-2" key={session.id}>
              <HistorySessionCard
                disabled={isPending}
                expanded={expandedSessionId === session.id}
                onDelete={async () => {
                  if (!(await confirmDanger('Eliminar sesion', 'Se borrara esta sesion con sus series y drop sets.'))) return
                  runHistoryAction(async () => {
                    await deleteWorkoutSession(session.id)
                    setExpandedSessionId(null)
                  }, 'Sesion eliminada')
                }}
                onToggle={() => setExpandedSessionId((current) => (current === session.id ? null : session.id))}
                session={session}
              />
              {expandedSessionId === session.id ? (
                <SessionDetailInline
                  detail={expandedDetail}
                  disabled={isPending}
                  onDeleteSet={async (setLogId) => {
                    if (!(await confirmDanger('Eliminar serie', 'Se borrara esta serie desde la sesion.'))) return
                    runHistoryAction(() => deleteMainSet(setLogId), 'Serie eliminada')
                  }}
                  onEditSet={(set) => setEditingSet(set)}
                />
              ) : null}
            </div>
          ))
        ) : (
          <Card className="p-4 text-sm text-arsen-muted">No hay sesiones registradas en esta fecha.</Card>
        )}
      </section>

      {editingSet && editOptions ? (
        <EditSetSheet
          disabled={isPending}
          editOptions={editOptions}
          initial={editingSet}
          onClose={() => setEditingSet(null)}
          onSave={(input) => {
            runHistoryAction(async () => {
              await updateWorkoutSession(input.sessionId, {
                date: input.date,
                dayId: input.dayId,
                routineId: input.routineId,
              })
              await moveMainSetToExercise(input.setLogId, input.routineExerciseId)
              await updateMainSet(input.setLogId, {
                reps: input.reps,
                rir: input.rir,
                weightKg: input.weightKg,
              })
            }, 'Serie actualizada')
            setEditingSet(null)
          }}
        />
      ) : null}
    </div>
  )
}

function HistorySessionCard({
  disabled,
  expanded,
  onDelete,
  onToggle,
  session,
}: {
  disabled: boolean
  expanded: boolean
  onDelete: () => void
  onToggle: () => void
  session: RecentSessionSummary
}) {
  return (
    <Card className="grid grid-cols-[1fr_auto] items-center gap-3 p-3">
      <button className="min-w-0 text-left" disabled={disabled} onClick={onToggle} type="button">
        <div className="flex items-center gap-2">
          <strong className="truncate">{session.routineName}</strong>
          <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-arsen-muted">{session.setCount} series</span>
        </div>
        <p className="mt-1 text-xs text-arsen-muted">{session.dayName}</p>
        <p className="mt-1 text-xs text-arsen-muted">
          Mejor {session.bestSetLabel} - {Math.round(session.volumeKg)} kg volumen - {session.exerciseCount} ejercicios
        </p>
      </button>
      <div className="flex items-center gap-1">
        <button
          aria-label={expanded ? 'Contraer sesion' : 'Expandir sesion'}
          className="grid size-9 place-items-center rounded-[10px] border border-white/10 text-arsen-purple2 disabled:opacity-40"
          disabled={disabled}
          onClick={onToggle}
          type="button"
        >
          <ChevronDown aria-hidden="true" className={['size-4 transition-transform', expanded ? 'rotate-180' : ''].join(' ')} />
        </button>
        <button
          className="grid size-9 place-items-center rounded-[10px] border border-red-300/25 text-red-300 disabled:opacity-40"
          disabled={disabled}
          onClick={onDelete}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          <span className="sr-only">Eliminar sesion</span>
        </button>
      </div>
    </Card>
  )
}

function SessionDetailInline({
  detail,
  disabled,
  onDeleteSet,
  onEditSet,
}: {
  detail: SessionDetail | null | undefined
  disabled: boolean
  onDeleteSet: (setLogId: string) => void
  onEditSet: (set: EditSetState) => void
}) {
  if (!detail) return <Card className="p-4 text-sm text-arsen-muted">Cargando sesion...</Card>

  return (
    <div className="space-y-2">
      {detail.exercises.map((exercise) => (
        <Card className="p-3" key={exercise.exerciseLogId}>
          <div className="mb-2 flex items-center gap-2">
            <ExerciseArt alt={exercise.exerciseName} className="size-10" muscle={exercise.mainMuscle} />
            <div className="min-w-0">
              <strong className="block truncate text-sm">{exercise.exerciseName}</strong>
              <span className="text-xs text-arsen-muted">{exercise.sets.length} series principales</span>
            </div>
          </div>
          <div className="space-y-2">
            {exercise.sets.map((set) => (
              <div className="rounded-[10px] border border-white/10 bg-arsen-bg/55 p-2" key={set.id}>
                <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <div>
                    <strong className="text-sm">
                      Serie {set.order + 1}: {set.weightKg} kg x {set.reps}
                    </strong>
                    <span className="ml-2 text-xs text-arsen-muted">RIR {set.rir}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="grid size-8 place-items-center rounded-[9px] border border-white/10 text-arsen-purple2 disabled:opacity-40"
                      disabled={disabled}
                      onClick={() =>
                        onEditSet({
                          date: detail.date,
                          dayId: detail.dayId,
                          reps: set.reps,
                          rir: set.rir,
                          routineExerciseId: exercise.routineExerciseId,
                          routineId: detail.routineId,
                          sessionId: detail.id,
                          setLogId: set.id,
                          weightKg: set.weightKg,
                        })
                      }
                      type="button"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                      <span className="sr-only">Editar serie</span>
                    </button>
                    <button
                      className="grid size-8 place-items-center rounded-[9px] border border-red-300/25 text-red-300 disabled:opacity-40"
                      disabled={disabled}
                      onClick={() => onDeleteSet(set.id)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      <span className="sr-only">Eliminar serie</span>
                    </button>
                  </div>
                </div>
                {set.dropSets.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs text-arsen-muted">
                    {set.dropSets.map((dropSet) => (
                      <div key={dropSet.id}>
                        Drop {dropSet.order + 1}: {dropSet.weightKg} kg x {dropSet.reps} - RIR {dropSet.rir}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ))}
      {detail.exercises.length === 0 ? <Card className="p-4 text-sm text-arsen-muted">Sesion sin series.</Card> : null}
    </div>
  )
}
