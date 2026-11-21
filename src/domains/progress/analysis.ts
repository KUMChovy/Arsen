export const MIN_COMPARISON_SESSIONS = 2
export const MIN_TREND_SESSIONS = 3
export const PERFORMANCE_CHANGE_TOLERANCE = 0.05
export const VOLUME_CHANGE_TOLERANCE = 0.1

export type ProgressAnalysisSession = {
  date: string
  estimatedOneRmKg: number | null
  volumeKg: number
}

export type ProgressAnalysisWindow = {
  label: string
  sessions: ProgressAnalysisSession[]
}

export type ProgressAnalysisInput = {
  current: ProgressAnalysisWindow
  previous?: ProgressAnalysisWindow | null
  subject: string
}

export type ProgressInsight = {
  evidenceDates: string[]
  kind: 'decline' | 'improvement' | 'insufficient' | 'stable'
  message: string
  periodLabel: string
  title: string
  trend: 'down' | 'flat' | 'up' | 'unknown'
  values: { current: number | null; reference: number | null }
}

export function analyzeProgress(input: ProgressAnalysisInput): ProgressInsight[] {
  const current = validSessions(input.current.sessions)
  const previous = input.previous ? validSessions(input.previous.sessions) : []
  if (current.length < MIN_COMPARISON_SESSIONS) return [insufficientInsight(input)]

  if (previous.length >= MIN_COMPARISON_SESSIONS) {
    const currentAverage = average(current.map((session) => session.estimatedOneRmKg))
    const previousAverage = average(previous.map((session) => session.estimatedOneRmKg))
    return [buildInsight(input.subject, input.previous?.label ?? input.current.label, current, previous, currentAverage, previousAverage)]
  }

  const first = current[0]!
  const latest = current.at(-1)!
  return [buildInsight(input.subject, input.current.label, [latest], [first], latest.estimatedOneRmKg!, first.estimatedOneRmKg!)]
}

function buildInsight(
  subject: string,
  periodLabel: string,
  current: ProgressAnalysisSession[],
  reference: ProgressAnalysisSession[],
  currentValue: number,
  referenceValue: number,
): ProgressInsight {
  const change = (currentValue - referenceValue) / referenceValue
  const kind = change > PERFORMANCE_CHANGE_TOLERANCE ? 'improvement' : change < -PERFORMANCE_CHANGE_TOLERANCE ? 'decline' : 'stable'
  const trend = kind === 'improvement' ? 'up' : kind === 'decline' ? 'down' : 'flat'
  const currentDate = current.at(-1)?.date ?? ''
  const referenceDate = reference.at(-1)?.date ?? ''
  const currentLabel = formatKg(currentValue)
  const referenceLabel = formatKg(referenceValue)
  const title = kind === 'improvement' ? 'Mejora detectada' : kind === 'decline' ? 'Disminución observada' : 'Rendimiento estable'
  const message = kind === 'stable'
    ? `En ${subject}, tus registros comparables se mantienen cerca de ${currentLabel}; no hay una tendencia clara.`
    : `En ${subject}, la 1RM estimada pasó de ${referenceLabel} a ${currentLabel} entre ${referenceDate} y ${currentDate}.`

  return {
    evidenceDates: [...new Set([...reference.map((session) => session.date), ...current.map((session) => session.date)])].sort(),
    kind,
    message,
    periodLabel,
    title,
    trend,
    values: { current: currentValue, reference: referenceValue },
  }
}

function insufficientInsight(input: ProgressAnalysisInput): ProgressInsight {
  return {
    evidenceDates: validSessions(input.current.sessions).map((session) => session.date),
    kind: 'insufficient',
    message: `Necesitas al menos otra sesión de ${input.subject} para realizar una comparación.`,
    periodLabel: input.current.label,
    title: 'Datos insuficientes',
    trend: 'unknown',
    values: { current: null, reference: null },
  }
}

function validSessions(sessions: ProgressAnalysisSession[]) {
  return sessions
    .filter((session) => Number.isFinite(session.estimatedOneRmKg) && (session.estimatedOneRmKg ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value))
  return valid.reduce((total, value) => total + value, 0) / valid.length
}

function formatKg(value: number) {
  return `${Math.round(value * 10) / 10} kg`
}
