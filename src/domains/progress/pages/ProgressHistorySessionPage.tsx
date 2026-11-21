import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../../shared/components/Card'
import { PageHeader } from '../../../shared/components/PageHeader'
import { formatWeight } from '../../../shared/utils/weight'
import { getAppSettings } from '../../settings/services'
import { exportSessionCsv, exportSessionJson } from '../../settings/services'
import { HealthSummaryCard } from '../../health/components/HealthSummaryCard'
import { addDropSet, deleteDropSet, deleteHistoricalExercise, deleteMainSet, deleteWorkoutSession, duplicateSessionAsDraft, updateDropSet, updateHistoricalSession, updateHistoricalSet } from '../../workout/services'
import { EditSetSheet } from '../../workout/components/EditSetSheet'
import { confirmDanger } from '../../../shared/utils/alerts'
import { localDateKey } from '../../../shared/utils/date'
import { EditHistoricalSetSheet, type HistoricalSetEditInput } from '../components/EditHistoricalSetSheet'
import { EditHistoricalSessionSheet, type HistoricalSessionEditInput } from '../components/EditHistoricalSessionSheet'
import { SessionActionMenu } from '../components/SessionActionMenu'
import { SessionExerciseCard } from '../components/SessionExerciseCard'
import { compareSessions } from '../comparison'
import { useHistory, useSessionDetailById } from '../hooks'
import type { HistorySessionSummary, SessionDetail } from '../repository'

export function ProgressHistorySessionPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const detail = useSessionDetailById(sessionId)
  const settings = useLiveQuery(() => getAppSettings(), [], undefined)
  const unit = settings?.preferredUnit ?? detail?.displayUnit ?? 'kg'

  if (detail === undefined) return <Card className="p-4 text-sm text-arsen-muted">Cargando sesión...</Card>
  if (!detail) return <NotFoundState />

  return <SessionContent detail={detail} unit={unit} onBack={() => navigate(-1)} />
}

function SessionContent({ detail, onBack, unit }: { detail: SessionDetail; onBack: () => void; unit: 'kg' | 'lb' }) {
  const [expanded, setExpanded] = useState(() => new Set(detail.exercises.map((exercise) => exercise.exerciseLogId)))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingSet, setEditingSet] = useState<{ exerciseLogId: string; set: SessionDetail['exercises'][number]['sets'][number] } | null>(null)
  const [editingDrop, setEditingDrop] = useState<{ id: string; reps: number; rir: number; weightKg: number } | null>(null)
  const [addingDropForSet, setAddingDropForSet] = useState<string | null>(null)
  const [comparing, setComparing] = useState(false)
  const history = useHistory({ period: 'all', routineId: detail.routineId, status: 'completed' })
  const mainSets = detail.exercises.flatMap((exercise) => exercise.sets)
  const dropSets = mainSets.flatMap((set) => set.dropSets)
  const volumeKg = mainSets.reduce((total, set) => total + set.weightKg * set.reps, 0) + dropSets.reduce((total, set) => total + set.weightKg * set.reps, 0)
  const durationMinutes = detail.startedAt && detail.lastExerciseAt ? Math.round((new Date(detail.lastExerciseAt).getTime() - new Date(detail.startedAt).getTime()) / 60000) : null

  function toggleExercise(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function saveSession(input: HistoricalSessionEditInput) {
    setSaving(true)
    setError(null)
    try {
      await updateHistoricalSession(detail.id, { ...input, dayId: detail.dayId, routineId: detail.routineId })
      setEditing(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la sesión')
    } finally {
      setSaving(false)
    }
  }

  async function saveSet(input: { deletedDropSetIds: string[]; drops: Array<{ id: string | null; reps: number; rir: number; weightKg: number }>; main: { reps: number; rir: number; weightKg: number } }) {
    if (!editingSet) return
    setSaving(true)
    setError(null)
    try {
      await updateHistoricalSet({ ...input.main, setLogId: editingSet.set.id })
      await Promise.all(input.deletedDropSetIds.map((dropSetId) => deleteDropSet(dropSetId)))
      await Promise.all(input.drops.map((dropSet) => dropSet.id
        ? updateDropSet(dropSet.id, { reps: dropSet.reps, rir: dropSet.rir, weightKg: dropSet.weightKg })
        : addDropSet({ displayUnit: detail.displayUnit, reps: dropSet.reps, rir: dropSet.rir, setLogId: editingSet.set.id, weightKg: dropSet.weightKg })))
      setEditingSet(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la serie')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEditingSet() {
    if (!editingSet) return false
    if (!(await confirmDanger('Eliminar serie', 'Se eliminará la serie y sus drops.'))) return false
    setSaving(true)
    setError(null)
    try {
      await deleteMainSet(editingSet.set.id)
      setEditingSet(null)
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar la serie')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveDrop(input: HistoricalSetEditInput) {
    setSaving(true)
    setError(null)
    try {
      if (editingDrop) await updateDropSet(editingDrop.id, input)
      else if (addingDropForSet) await addDropSet({ ...input, displayUnit: detail.displayUnit, setLogId: addingDropForSet })
      setEditingDrop(null)
      setAddingDropForSet(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el drop')
    } finally {
      setSaving(false)
    }
  }

  async function removeSession() {
    if (!(await confirmDanger('Eliminar sesión', 'Se borrará esta sesión con sus ejercicios, series y drops.'))) return
    setSaving(true)
    try {
      await deleteWorkoutSession(detail.id)
      onBack()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar la sesión')
    } finally {
      setSaving(false)
    }
  }

  async function duplicateSession() {
    setSaving(true)
    setError(null)
    try {
      const duplicate = await duplicateSessionAsDraft({ sourceSessionId: detail.id, targetDate: localDateKey(new Date()) })
      window.location.assign(`/historial/sesion/${duplicate.sessionId}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo duplicar la sesión')
    } finally {
      setSaving(false)
    }
  }

  async function removeExercise(exerciseLogId: string) {
    if (!(await confirmDanger('Eliminar ejercicio', 'Se borrarán sus series y drops de esta sesión.'))) return
    setSaving(true)
    try {
      await deleteHistoricalExercise(exerciseLogId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar el ejercicio')
    } finally {
      setSaving(false)
    }
  }

  async function removeSet(setLogId: string) {
    if (!(await confirmDanger('Eliminar serie', 'Se eliminará la serie y sus drops.'))) return
    setSaving(true)
    try {
      await deleteMainSet(setLogId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar la serie')
    } finally {
      setSaving(false)
    }
  }

  async function removeDropSet(dropSetId: string) {
    if (!(await confirmDanger('Eliminar drop', 'Se eliminará este drop set.'))) return
    setSaving(true)
    try {
      await deleteDropSet(dropSetId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar el drop')
    } finally {
      setSaving(false)
    }
  }

  async function exportSession() {
    try {
      await exportSessionCsv(detail.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo exportar la sesión')
    }
  }

  async function exportSessionAsJson() {
    try {
      await exportSessionJson(detail.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo exportar la sesión')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Historial" title={detail.routineName}>
        <div className="flex items-center gap-2"><button aria-label="Volver al historial" className="grid size-10 place-items-center rounded-[10px] border border-white/10 bg-arsen-surface text-arsen-purple2" onClick={onBack} type="button"><ArrowLeft aria-hidden="true" className="size-5" /></button><SessionActionMenu onCompare={() => setComparing(true)} onDelete={removeSession} onDuplicate={duplicateSession} onEdit={() => setEditing(true)} onExport={exportSession} onExportJson={exportSessionAsJson} /></div>
      </PageHeader>
      <Card className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black">{detail.dayName}</h2><p className="mt-1 text-sm text-arsen-muted">{formatDate(detail.date)}</p></div><span className={['rounded-full px-2 py-1 text-xs font-black', detail.status === 'completed' ? 'bg-arsen-acid/15 text-arsen-acid' : 'bg-orange-300/15 text-orange-300'].join('')}>{detail.status === 'completed' ? 'Completada' : 'Borrador'}</span></div>
        {detail.notes ? <p className="rounded-[10px] border border-white/10 bg-arsen-bg/50 p-3 text-sm text-arsen-muted">{detail.notes}</p> : null}
      </Card>
      <section aria-label="Resumen de sesión" className="grid grid-cols-2 gap-2">
        <Stat label="Ejercicios" value={String(detail.exercises.length)} />
        <Stat label="Series principales" value={String(mainSets.length)} />
        <Stat label={`Volumen (${unit})`} value={formatWeight(volumeKg, unit)} />
        <Stat label="Duración" value={durationMinutes === null ? 'Sin dato' : `${durationMinutes} min`} />
      </section>
      {detail.health ? <HealthSummaryCard onSync={() => undefined} showSync={false} summary={detail.health} /> : null}
      {comparing ? <SessionComparisonPanel current={detail} sessions={history?.sessions ?? []} onClose={() => setComparing(false)} /> : null}
      <section aria-label="Ejercicios de la sesión" className="space-y-2">
        <h2 className="text-base font-black">Ejercicios</h2>
        {detail.exercises.map((exercise) => (
          <SessionExerciseCard
            key={exercise.exerciseLogId}
            exercise={exercise}
            expanded={expanded.has(exercise.exerciseLogId)}
            onAddDrop={(setId) => setAddingDropForSet(setId)}
            onEditDrop={(drop) => setEditingDrop({ id: drop.id, reps: drop.reps, rir: drop.rir, weightKg: drop.weightKg })}
            onEditSet={(set) => setEditingSet({ exerciseLogId: exercise.exerciseLogId, set })}
            onRemove={() => void removeExercise(exercise.exerciseLogId)}
            onRemoveDrop={(dropId) => void removeDropSet(dropId)}
            onRemoveSet={(setId) => void removeSet(setId)}
            onToggle={() => toggleExercise(exercise.exerciseLogId)}
            saving={saving}
            unit={unit}
          />
        ))}
        {/* Legacy inline renderer retained only as a migration reference.
        {false && detail.exercises.map((exercise) => {
          const isExpanded = expanded.has(exercise.exerciseLogId)
          const exerciseCanonicalName = exercise.canonicalName ?? canonicalName(exercise.exerciseName)
          return <Card className="p-3" key={exercise.exerciseLogId}><div className="flex items-center gap-3"><ExerciseArt alt={exercise.exerciseName} bundledAssetId={exercise.bundledAssetId} className="size-12" muscle={exercise.mainMuscle} /><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{exercise.exerciseName}</strong><span className="text-xs text-arsen-muted">{exercise.sets.length} series · {exercise.mainMuscle}</span></div><button aria-label={isExpanded ? `Contraer ${exercise.exerciseName}` : `Expandir ${exercise.exerciseName}`} className="grid size-10 place-items-center rounded-[10px] border border-white/10 text-arsen-purple2" onClick={() => toggleExercise(exercise.exerciseLogId)} type="button"><ChevronDown aria-hidden="true" className={['size-4 transition-transform', isExpanded ? 'rotate-180' : ''].join(' ')} /></button></div>{isExpanded ? <div className="mt-3 space-y-2"><div className="flex flex-wrap gap-2"><Link aria-label={`Ver progreso de ${exercise.exerciseName}`} className="inline-flex min-h-10 items-center rounded-[10px] border border-white/10 px-3 text-xs font-bold text-arsen-purple2" to={`/progreso/ejercicio/${encodeURIComponent(exerciseCanonicalName)}`}>Ver progreso del ejercicio</Link><button aria-label={`Eliminar ${exercise.exerciseName}`} className="grid size-10 place-items-center rounded-[9px] border border-red-300/25 text-red-300" disabled={saving} onClick={() => removeExercise(exercise.exerciseLogId)} title="Eliminar ejercicio" type="button"><Trash2 aria-hidden="true" className="size-4" /></button></div>{exercise.sets.map((set) => <div className="rounded-[10px] border border-white/10 bg-arsen-bg/50 p-2 text-sm" key={set.id}><div className="flex items-center justify-between gap-2"><span><strong>Serie {set.order + 1}</strong> · {formatWeight(set.weightKg, unit)} x {set.reps} · RIR {set.rir}</span><div className="flex gap-1"><button aria-label={`Editar serie ${set.order + 1}`} className="grid size-10 place-items-center rounded-[9px] border border-white/10 text-arsen-purple2" disabled={saving} onClick={() => setEditingSet({ exerciseLogId: exercise.exerciseLogId, set })} title="Editar serie" type="button"><Pencil aria-hidden="true" className="size-4" /></button><button aria-label={`Eliminar serie ${set.order + 1}`} className="grid size-10 place-items-center rounded-[9px] border border-red-300/25 text-red-300" disabled={saving} onClick={() => void removeSet(set.id)} title="Eliminar serie" type="button"><Trash2 aria-hidden="true" className="size-4" /></button></div></div><button aria-label={`Agregar drop a serie ${set.order + 1}`} className="mt-2 grid size-10 place-items-center rounded-[9px] border border-white/10 text-arsen-purple2" disabled={saving} onClick={() => setAddingDropForSet(set.id)} title="Agregar drop" type="button"><Plus aria-hidden="true" className="size-4" /></button>{set.dropSets.map((dropSet) => <div className="mt-1 flex items-center justify-between gap-2 pl-3 text-xs text-arsen-muted" key={dropSet.id}><span>Drop {dropSet.order + 1}: {formatWeight(dropSet.weightKg, unit)} x {dropSet.reps} · RIR {dropSet.rir}</span><div className="flex gap-1"><button aria-label={`Editar drop ${dropSet.order + 1}`} className="grid size-9 place-items-center rounded-[9px] border border-white/10 text-arsen-purple2" disabled={saving} onClick={() => setEditingDrop({ id: dropSet.id, reps: dropSet.reps, rir: dropSet.rir, weightKg: dropSet.weightKg })} title="Editar drop" type="button"><Pencil aria-hidden="true" className="size-3.5" /></button><button aria-label={`Eliminar drop ${dropSet.order + 1}`} className="grid size-9 place-items-center rounded-[9px] border border-red-300/25 text-red-300" disabled={saving} onClick={() => void removeDropSet(dropSet.id)} title="Eliminar drop" type="button"><Trash2 aria-hidden="true" className="size-3.5" /></button></div></div>)}</div>)}</div> : null}</Card>
        })}
        */}
        {detail.exercises.length === 0 ? <Card className="p-4 text-sm text-arsen-muted">Sesión sin ejercicios registrados.</Card> : null}
      </section>
      {error ? <p role="alert" className="rounded-[10px] border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-200">{error}</p> : null}
      {editingSet ? <EditSetSheet disabled={saving} dropSets={editingSet.set.dropSets} onClose={() => setEditingSet(null)} onDelete={deleteEditingSet} onSave={saveSet} set={editingSet.set} unit={unit} /> : null}
      {editingDrop || addingDropForSet ? <EditHistoricalSetSheet description="El drop se guarda asociado a su serie principal." initial={editingDrop ?? { reps: 1, rir: 0, weightKg: 0 }} title={editingDrop ? 'Editar drop' : 'Agregar drop'} disabled={saving} onClose={() => { setEditingDrop(null); setAddingDropForSet(null) }} onSave={saveDrop} unit={unit} /> : null}
      {editing ? <EditHistoricalSessionSheet detail={detail} disabled={saving} onClose={() => setEditing(false)} onSave={saveSession} /> : null}
    </div>
  )
}

function NotFoundState() { return <div className="space-y-4"><PageHeader eyebrow="Historial" title="Sesión no encontrada" /><Card className="space-y-3 p-4 text-sm text-arsen-muted"><p>La sesión ya no existe o fue eliminada.</p><Link className="inline-flex min-h-11 items-center rounded-[10px] border border-white/10 px-3 font-bold text-arsen-purple2" to="/historial">Volver al historial</Link></Card></div> }
function Stat({ label, value }: { label: string; value: string }) { return <Card className="p-3"><span className="block text-xs font-bold text-arsen-muted">{label}</span><strong className="mt-1 block text-base">{value}</strong></Card> }
function formatDate(value: string) { return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) }

function SessionComparisonPanel({ current, onClose, sessions }: { current: SessionDetail; onClose: () => void; sessions: HistorySessionSummary[] }) {
  const candidates = sessions.filter((session) => session.sessionId !== current.id)
  const [selectedId, setSelectedId] = useState(candidates[0]?.sessionId ?? '')
  const other = useSessionDetailById(selectedId)
  const comparison = other ? compareSessions(current, other) : null
  return <Card aria-label="Comparación de sesiones" className="space-y-3 border-arsen-purple/40 p-3"><div className="flex items-center justify-between gap-2"><h2 className="text-base font-black">Comparar entrenamiento</h2><button className="min-h-10 rounded-[10px] border border-white/10 px-3 text-xs font-bold" onClick={onClose} type="button">Cerrar</button></div>{candidates.length === 0 ? <p className="text-sm text-arsen-muted">No hay otra sesión comparable de esta rutina.</p> : <><label className="block text-sm font-bold" htmlFor="comparison-session">Sesión de referencia<select className="mt-1 min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3" id="comparison-session" onChange={(event) => setSelectedId(event.target.value)} value={selectedId}>{candidates.map((session) => <option key={session.sessionId} value={session.sessionId}>{formatDate(session.date)} · {session.dayName}</option>)}</select></label>{comparison ? <div className="grid grid-cols-2 gap-2"><Stat label="Sesión actual" value={formatWeight(comparison.rightVolumeKg, current.displayUnit)} /><Stat label="Sesión de referencia" value={formatWeight(comparison.leftVolumeKg, current.displayUnit)} /><p className="col-span-2 text-sm text-arsen-muted">{comparison.comparable ? `${comparison.sharedExercises.length} ejercicios compartidos · diferencia de ${formatWeight(comparison.volumeDeltaKg, current.displayUnit)}` : comparison.limitation}</p></div> : <p className="text-sm text-arsen-muted">Cargando sesión de referencia…</p>}</>}</Card>
}
