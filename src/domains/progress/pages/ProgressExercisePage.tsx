import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import { formatWeight, kgToUnit } from '../../../shared/utils/weight'
import { getAppSettings } from '../../settings/services'
import { analyzeProgress } from '../analysis'
import { useProgressExerciseDetail } from '../hooks'
import { ProgressChart, type ProgressChartPoint } from '../components/ProgressChart'
import { ProgressInsights } from '../components/ProgressInsights'
import type { ProgressMetricKey, ProgressPeriodKey } from '../calculations'
import type { ProgressExerciseSession } from '../repository'

export function ProgressExercisePage() {
  const { canonicalName = '' } = useParams()
  const settings = useLiveQuery(() => getAppSettings(), [], undefined)
  const unit = settings?.preferredUnit ?? 'kg'
  const [period, setPeriod] = useState<ProgressPeriodKey>('all')
  const [metric, setMetric] = useState<ProgressMetricKey>('estimatedOneRm')
  const detail = useProgressExerciseDetail(canonicalName, { period })
  const metricInfo = metricConfig(metric, unit)
  const chartData = useMemo<ProgressChartPoint[]>(() => detail?.sessions.map((session) => ({ date: session.date, sessionId: session.sessionId, value: metricInfo.value(session) })) ?? [], [detail, metricInfo])
  const insights = detail ? analyzeProgress({ current: { label: periodLabel(period), sessions: detail.sessions.map((session) => ({ date: session.date, estimatedOneRmKg: session.estimatedOneRmKg, volumeKg: session.volumeKg })) }, subject: detail.name }) : []
  const latest = detail?.sessions.at(-1)
  const previous = detail?.sessions.at(-2)

  if (detail === undefined) return <Card className="p-4 text-sm text-arsen-muted">Cargando ejercicio...</Card>
  if (!detail) return <Card className="p-4 text-sm text-arsen-muted">No hay historial para este ejercicio.</Card>

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Detalle de ejercicio" title={detail.name}><Link aria-label="Volver a ejercicios" className="grid size-10 place-items-center rounded-[10px] border border-white/10 bg-arsen-surface text-arsen-purple2" to="/progreso?vista=exercises"><ArrowLeft aria-hidden="true" className="size-5" /></Link></PageHeader>
      <Card className="grid grid-cols-[56px_1fr] gap-3 p-3"><ExerciseArt alt={detail.name} bundledAssetId={detail.bundledAssetId} className="size-14" muscle={detail.mainMuscle} /><div className="min-w-0"><strong className="block truncate text-lg">{detail.name}</strong><span className="text-xs text-arsen-muted">{detail.mainMuscle ?? 'Músculo no disponible'} · {detail.sessionCount} sesiones</span><span className="mt-1 block text-xs text-arsen-muted">Último registro: {detail.lastSessionDate ?? 'Sin fecha'}</span></div></Card>
      <section className="grid grid-cols-2 gap-2"><Card className="p-3"><span className="text-xs text-arsen-muted">Mayor peso</span><strong className="mt-1 block text-lg text-arsen-acid">{formatWeight(detail.maxWeightKg, unit)}</strong></Card><Card className="p-3"><span className="text-xs text-arsen-muted">Mejor 1RM estimada</span><strong className="mt-1 block text-lg text-arsen-acid">{detail.bestEstimatedOneRmKg === null ? 'Sin datos' : formatWeight(detail.bestEstimatedOneRmKg, unit)}</strong></Card></section>
      <Card className="space-y-3 p-3"><div className="grid grid-cols-2 gap-2"><label><span className="mb-1 block text-xs font-bold text-arsen-muted">Métrica</span><select aria-label="Métrica de progreso" className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-bold text-arsen-ink" onChange={(event) => setMetric(event.target.value as ProgressMetricKey)} value={metric}><option value="estimatedOneRm">1RM estimada</option><option value="weight">Peso</option><option value="reps">Repeticiones</option><option value="volume">Volumen</option></select></label><label><span className="mb-1 block text-xs font-bold text-arsen-muted">Periodo</span><select aria-label="Periodo del ejercicio" className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-bold text-arsen-ink" onChange={(event) => setPeriod(event.target.value as ProgressPeriodKey)} value={period}><option value="4w">4 semanas</option><option value="8w">8 semanas</option><option value="12w">12 semanas</option><option value="all">Todo el historial</option></select></label></div><div className="h-52 rounded-[10px] border border-white/10 bg-arsen-bg/50 p-2"><ProgressChart data={chartData} metricLabel={metricInfo.label} unit={metricInfo.unit} /></div></Card>
      {latest && previous ? <Card className="space-y-2 p-3"><h2 className="font-black">Comparación con sesión anterior</h2><div className="grid grid-cols-2 gap-2 text-sm"><div><span className="block text-xs text-arsen-muted">Anterior · {previous.date}</span><strong className="mt-1 block">{formatBestSetLabel(previous.bestSetLabel, unit)}</strong><span className="text-xs text-arsen-muted">{formatWeight(previous.volumeKg, unit)} volumen</span></div><div><span className="block text-xs text-arsen-muted">Más reciente · {latest.date}</span><strong className="mt-1 block text-arsen-acid">{formatBestSetLabel(latest.bestSetLabel, unit)}</strong><span className="text-xs text-arsen-muted">{formatWeight(latest.volumeKg, unit)} volumen</span></div></div><p className="text-xs text-arsen-muted">La lectura considera 1RM estimada y repeticiones; subir peso por sí solo no se marca como mejora.</p></Card> : null}
      {insights.length > 0 ? <ProgressInsights insights={insights} /> : null}
      <section aria-label="Sesiones del ejercicio" className="space-y-2"><h2 className="text-sm font-black">Sesiones originales</h2>{detail.sessions.slice().reverse().map((session) => <Card className="flex items-center justify-between gap-3 p-3" key={session.sessionId}><div><strong className="block text-sm">{session.date}</strong><span className="text-xs text-arsen-muted">{session.routineName} · {session.dayName} · {formatBestSetLabel(session.bestSetLabel, unit)}</span></div><Link aria-label={`Ver sesión ${session.date}`} className="shrink-0 rounded-[10px] border border-white/10 px-3 py-2 text-xs font-bold text-arsen-purple2" to={`/historial/sesion/${session.sessionId}`}>Ver sesión</Link></Card>)}</section>
    </div>
  )
}

function metricConfig(metric: ProgressMetricKey, unit: 'kg' | 'lb'): { label: string; unit: string; value: (session: ProgressExerciseSession) => number | null } {
  if (metric === 'weight') return { label: 'Peso', unit, value: (session) => session.maxWeightKg === null ? null : kgToUnit(session.maxWeightKg, unit) }
  if (metric === 'reps') return { label: 'Repeticiones', unit: 'reps', value: (session) => session.maxReps }
  if (metric === 'volume') return { label: 'Volumen', unit, value: (session) => kgToUnit(session.volumeKg, unit) }
  return { label: '1RM estimada', unit, value: (session) => session.estimatedOneRmKg === null ? null : kgToUnit(session.estimatedOneRmKg, unit) }
}

function periodLabel(period: ProgressPeriodKey) { return period === 'all' ? 'Todo el historial' : `Últimas ${period.replace('w', '')} semanas` }
function formatBestSetLabel(label: string, unit: 'kg' | 'lb') {
  const match = /^(\d+(?:\.\d+)?) kg x (\d+)$/.exec(label)
  return match ? `${formatWeight(Number(match[1]), unit)} x ${match[2]}` : label
}
