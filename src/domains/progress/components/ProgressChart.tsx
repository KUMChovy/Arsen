import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type ProgressChartPoint = {
  date: string
  sessionId: string
  value: number | null
}

export function ProgressChart({ data, metricLabel, unit }: { data: ProgressChartPoint[]; metricLabel: string; unit: string }) {
  const values = data.filter((point): point is ProgressChartPoint & { value: number } => Number.isFinite(point.value))
  if (values.length === 0) return <div className="grid h-full place-items-center text-center text-sm text-arsen-muted">Sin datos suficientes para graficar esta métrica.</div>

  const min = Math.min(...values.map((point) => point.value))
  const max = Math.max(...values.map((point) => point.value))
  const padding = Math.max((max - min) * 0.15, max * 0.05, 1)
  const domain: [number, number] = [Math.max(0, min - padding), max + padding]

  return (
    <div aria-label={`Gráfica de ${metricLabel}`} className="h-full" role="img">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={values} margin={{ bottom: 4, left: -20, right: 8, top: 8 }}>
          <XAxis dataKey="date" fontSize={10} stroke="var(--color-arsen-muted)" tickLine={false} />
          <YAxis domain={domain} fontSize={10} stroke="var(--color-arsen-muted)" tickFormatter={(value) => `${value}`} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: 'var(--color-arsen-surface)',
              border: '1px solid var(--color-arsen-line)',
              borderRadius: '10px',
              color: 'var(--color-arsen-ink)',
            }}
            formatter={(value) => [`${value} ${unit}`, metricLabel]}
          />
          <Line
            activeDot={{ fill: 'var(--color-arsen-acid)', r: 5 }}
            dataKey="value"
            dot={{ fill: 'var(--color-arsen-acid)', r: 4 }}
            stroke="var(--color-arsen-purple2)"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
      <ul className="sr-only">
        {values.map((point) => <li key={point.sessionId}>{point.date}: {formatChartValue(point.value, unit)}</li>)}
      </ul>
    </div>
  )
}

function formatChartValue(value: number, unit: string) {
  return `${Math.round(value * 10) / 10} ${unit}`
}
