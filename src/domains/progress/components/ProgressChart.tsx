import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProgressPoint } from '../repository'

export function ProgressChart({ data }: { data: ProgressPoint[] }) {
  return (
    <ResponsiveContainer height="100%" width="100%">
      <LineChart data={data} margin={{ bottom: 4, left: -28, right: 8, top: 8 }}>
        <XAxis dataKey="date" fontSize={10} stroke="oklch(0.73 0.012 280)" tickLine={false} />
        <YAxis domain={[0, 100]} fontSize={10} stroke="oklch(0.73 0.012 280)" tickLine={false} />
        <Tooltip
          contentStyle={{
            background: 'oklch(0.155 0.016 280)',
            border: '1px solid rgb(255 255 255 / 0.12)',
            borderRadius: '10px',
            color: 'white',
          }}
        />
        <Line
          activeDot={{ fill: 'oklch(0.86 0.20 125)', r: 5 }}
          dataKey="score"
          dot={{ fill: 'oklch(0.86 0.20 125)', r: 4 }}
          stroke="oklch(0.72 0.13 300)"
          strokeWidth={3}
          type="monotone"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
