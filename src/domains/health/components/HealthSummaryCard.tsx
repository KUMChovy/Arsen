import { Activity, ChevronDown, ChevronLeft, ChevronRight, Droplets, Footprints, Flame, HeartPulse, Info, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { Card } from '../../../shared/components/Card'
import type { HealthExerciseSummary, HealthMetricSummary, HealthSummary, HealthWindowSummary } from '../types'

type HealthSlide = {
  key: 'day' | 'session' | 'exercise'
  title: string
  window: HealthWindowSummary
}

export function HealthSummaryCard({
  currentExerciseId,
  currentExerciseName,
  disabled = false,
  isSyncing = false,
  onSync,
  showSync = true,
  summary,
}: {
  currentExerciseId?: string | null
  currentExerciseName?: string | null
  disabled?: boolean
  isSyncing?: boolean
  onSync: () => void
  showSync?: boolean
  summary: HealthSummary | null | undefined
}) {
  const [expanded, setExpanded] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const exercise = summary?.exercises?.find((item) => item.exerciseLogId === currentExerciseId) ?? summary?.exercises?.[0]
  // Las vistas reutilizan la misma respuesta: día, sesión y ejercicio actual.
  const slides = useMemo<HealthSlide[]>(() => {
    if (!summary) return []
    const nextSlides: HealthSlide[] = [{ key: 'day', title: 'Resumen del día', window: summary.day }]
    if (summary.session) nextSlides.push({ key: 'session', title: 'Sesión de entrenamiento', window: summary.session })
    if (exercise) nextSlides.push({ key: 'exercise', title: currentExerciseName ?? exercise.exerciseName, window: exercise })
    return nextSlides
  }, [currentExerciseName, exercise, summary])
  const activeSlide = slides[Math.min(slideIndex, Math.max(slides.length - 1, 0))]

  useEffect(() => {
    setSlideIndex((current) => Math.min(current, Math.max(slides.length - 1, 0)))
  }, [slides.length])

  function moveSlide(direction: -1 | 1) {
    if (slides.length < 2) return
    setSlideIndex((current) => (current + direction + slides.length) % slides.length)
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) < 36) return
    moveSlide(delta < 0 ? 1 : -1)
  }

  return (
    <Card className="space-y-3 border-arsen-purple/35 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-arsen-purple/15 text-arsen-purple2">
            <HeartPulse aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-black">Salud sincronizada</h2>
            <p className="mt-1 text-xs text-arsen-muted">Resumen diario disponible en Health Connect</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="relative">
            <button
              aria-expanded={availabilityOpen}
              aria-label="Información sobre disponibilidad"
              className="grid size-10 place-items-center rounded-[10px] border border-white/10 text-arsen-muted transition-colors hover:bg-white/5"
              onClick={() => setAvailabilityOpen((current) => !current)}
              type="button"
            >
              <Info aria-hidden="true" className="size-4" />
            </button>
            {availabilityOpen ? (
              <div aria-label="Disponibilidad de datos" className="absolute right-0 top-11 z-10 w-64 rounded-[10px] border border-arsen-purple/35 bg-arsen-bg2 p-3 text-xs leading-relaxed text-arsen-muted shadow-xl" role="menu">
                <p role="menuitem">La disponibilidad y frecuencia dependen de la app y el modelo de tu reloj. Mi Fitness, Samsung Health, Fitbit o Garmin Connect pueden necesitar abrirse para publicar los datos.</p>
                <p className="mt-2" role="menuitem">Health Connect puede entregar intervalos de aproximadamente 30 minutos. Arsen consulta también datos anteriores a la conexión.</p>
              </div>
            ) : null}
          </div>
          {showSync ? (
            <button
              aria-label="Sincronizar salud"
              className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-arsen-purple/45 text-arsen-purple2 transition-colors hover:bg-arsen-purple/15 disabled:opacity-50"
              disabled={disabled || isSyncing}
              onClick={onSync}
              type="button"
            >
              <RefreshCw aria-hidden="true" className={['size-4', isSyncing ? 'animate-spin' : ''].join(' ')} />
              <span className="sr-only">Sincronizar salud</span>
            </button>
          ) : null}
          <button
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? 'Expandir' : 'Contraer'} salud sincronizada`}
            className="grid size-10 place-items-center rounded-[10px] border border-white/10 text-arsen-muted transition-colors hover:bg-white/5"
            onClick={() => setCollapsed((current) => !current)}
            type="button"
          >
            <ChevronDown aria-hidden="true" className={['size-4 transition-transform', collapsed ? '-rotate-90' : ''].join(' ')} />
          </button>
        </div>
      </div>

      {!collapsed && summary && activeSlide ? (
        <div className="space-y-3 touch-pan-y" onTouchEnd={handleTouchEnd} onTouchStart={handleTouchStart}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <button
                aria-label="Vista anterior de salud"
                className="grid size-8 shrink-0 place-items-center rounded-[9px] border border-white/10 text-arsen-muted disabled:opacity-30"
                disabled={slides.length < 2}
                onClick={() => moveSlide(-1)}
                type="button"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </button>
            <span aria-live="polite" className="truncate text-xs font-extrabold text-arsen-purple2">{activeSlide.title}</span>
              <button
                aria-label="Siguiente vista de salud"
                className="grid size-8 shrink-0 place-items-center rounded-[9px] border border-white/10 text-arsen-muted disabled:opacity-30"
                disabled={slides.length < 2}
                onClick={() => moveSlide(1)}
                type="button"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </div>
            <button className="shrink-0 text-xs font-extrabold text-arsen-acid" onClick={() => setExpanded((current) => !current)} type="button">
              {expanded ? 'Vista reducida' : 'Ver todos los datos'}
            </button>
          </div>

          {/* La vista reducida prioriza pulso, calorías y pasos; la expandida agrega oxígeno y extremos del pulso. */}
          <HealthWindow
            exercise={activeSlide.key === 'exercise' ? exercise : undefined}
            expanded={expanded}
            title={activeSlide.title}
            window={activeSlide.window}
          />

          <div aria-label="Vistas de salud" className="grid grid-cols-3 gap-1" role="tablist">
            {slides.map((slide, index) => (
              <button
                aria-label={`Ver ${slide.title}`}
                aria-selected={index === slideIndex}
                className={[
                  'min-h-9 rounded-[9px] px-2 text-xs font-extrabold transition-colors',
                  index === slideIndex ? 'bg-arsen-acid/15 text-arsen-acid' : 'bg-white/5 text-arsen-dim',
                ].join(' ')}
                key={slide.key}
                onClick={() => setSlideIndex(index)}
                role="tab"
                type="button"
              >
                {slide.key === 'day' ? 'Día' : slide.key === 'session' ? 'Sesión' : 'Ejercicio'}
              </button>
            ))}
          </div>

          {!hasAnyMetric(summary.day.metrics) ? (
            <p className="rounded-[10px] border border-arsen-acid/25 bg-arsen-acid/10 p-3 text-sm text-arsen-muted">
              Sin datos publicados todavía. Sincroniza primero la app que administra tu reloj con Health Connect y vuelve a intentarlo.
            </p>
          ) : null}
          <p className="text-xs text-arsen-dim">Última lectura: {formatSyncTime(summary.syncedAt)}</p>
        </div>
      ) : !collapsed ? (
        <div className="rounded-[10px] border border-white/10 bg-arsen-bg/45 p-3 text-sm text-arsen-muted">
          <strong className="block text-arsen-ink">Aún no hay una sincronización</strong>
          <span className="mt-1 block">Sincroniza la app de tu reloj con Health Connect y toca el botón para consultar el día.</span>
          <span className="mt-2 block text-xs text-arsen-dim">Sin datos</span>
        </div>
      ) : null}
    </Card>
  )
}

function HealthWindow({ exercise, expanded, title, window }: { exercise?: HealthExerciseSummary; expanded: boolean; title: string; window: HealthWindowSummary }) {
  const metrics = window.metrics
  return (
    <section aria-label={`Resumen ${title.toLowerCase()}`} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-arsen-purple2">{title}</h3>
        <span className="text-xs text-arsen-dim">{formatRange(window.rangeStart, window.rangeEnd)}</span>
      </div>
      {exercise ? <p className="text-xs text-arsen-muted">{exercise.setCount} series principales · {formatDuration(window.rangeStart, window.rangeEnd)}</p> : null}
      <div className={['grid gap-2', expanded ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3'].join(' ')}>
        <Metric icon={Activity} label="Pulso promedio" value={formatValue(metrics.heartRateAvgBpm, ' lpm')} detail={expanded ? heartRateDetail(metrics) : undefined} />
        <Metric icon={Flame} label="Calorías activas" value={formatValue(metrics.activeCaloriesKcal, ' kcal')} />
        <Metric icon={Footprints} label="Pasos" value={formatInteger(metrics.steps)} />
        {expanded ? <Metric icon={Droplets} label="Oxígeno" value={formatValue(metrics.oxygenSaturationAvgPercent, '%')} /> : null}
      </div>
    </section>
  )
}

function Metric({ detail, icon: Icon, label, value }: { detail?: string; icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-white/10 bg-arsen-bg/45 p-2">
      <div className="flex items-center gap-1 text-arsen-muted">
        <Icon aria-hidden="true" className="size-3.5" />
        <span className="truncate text-xs font-bold">{label}</span>
      </div>
      <strong className="mt-1 block truncate text-sm text-arsen-ink">{value}</strong>
      {detail ? <span className="mt-0.5 block truncate text-xs text-arsen-dim">{detail}</span> : null}
    </div>
  )
}

function heartRateDetail(metrics: HealthMetricSummary) {
  const max = formatValue(metrics.heartRateMaxBpm, '')
  const min = formatValue(metrics.heartRateMinBpm, '')
  if (max === '—' && min === '—') return undefined
  return `Máx ${max} · Mín ${min}`
}

function hasAnyMetric(metrics: HealthMetricSummary) {
  return Object.values(metrics).some((value) => value !== null)
}

function formatValue(value: number | null, suffix: string) {
  return value === null ? '—' : `${formatNumber(value)}${suffix}`
}

function formatInteger(value: number | null) {
  return value === null ? '—' : Math.round(value).toLocaleString('es-MX')
}

function formatNumber(value: number) {
  return value.toLocaleString('es-MX', { maximumFractionDigits: 1 })
}

function formatRange(start: string, end: string) {
  const startTime = new Date(start).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  const endTime = new Date(end).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  return `${startTime}–${endTime}`
}

function formatSyncTime(value: string) {
  return new Date(value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(start: string, end: string) {
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
  return `${minutes} min`
}
